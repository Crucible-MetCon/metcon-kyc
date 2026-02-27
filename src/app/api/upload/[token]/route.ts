import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractFromDocument } from '@/lib/extraction';
import { uploadFile } from '@/lib/storage';
import { DOC_TYPE_LABELS } from '@/lib/document-checklist';
import path from 'path';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
]);

const DOC_TYPE_MAP = DOC_TYPE_LABELS;

// ─────────────────────────────────────────────
// Background extraction — runs after response is returned.
// Does NOT block the upload response.
// ─────────────────────────────────────────────
async function runDocumentIntelligence(
  caseId: string,
  docId: string,
  filename: string,
  fileBuffer: Buffer,
  mimeType: string,
  entityType: string | null,
) {
  try {
    const canExtract = mimeType === 'application/pdf' || mimeType.startsWith('image/');
    if (!canExtract || fileBuffer.length >= 20 * 1024 * 1024) return;

    const base64 = fileBuffer.toString('base64');
    const extracted = await extractFromDocument(base64, mimeType, entityType, filename);

    const meaningfulKeys = Object.keys(extracted).filter((k) => {
      if (k === 'associated_persons') return (extracted.associated_persons?.length ?? 0) > 0;
      const v = extracted[k as keyof typeof extracted];
      return v !== undefined && v !== null && v !== '';
    });

    if (meaningfulKeys.length === 0) return;

    const fieldSummary = meaningfulKeys
      .filter((k) => k !== 'associated_persons')
      .slice(0, 8)
      .map((k) => {
        const v = extracted[k as keyof typeof extracted];
        const label = k.replace(/_/g, ' ');
        const display = typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v);
        return `  • **${label}**: ${display}`;
      })
      .join('\n');

    const personSummary = extracted.associated_persons?.length
      ? `\n  • **Associated persons**: ${extracted.associated_persons.map((p) => `${p.person_full_name ?? '?'} (${p.person_role_type ?? '?'})`).join(', ')}`
      : '';

    const msg = `I've analysed **"${filename}"** and found the following information:\n\n${fieldSummary}${personSummary}\n\n**Can you confirm this relates to the entity being onboarded?** Reply **"yes"** to save these details, or **"no"** to ignore them.`;

    await prisma.pendingExtraction.create({
      data: {
        case_id: caseId,
        document_id: docId,
        document_name: filename,
        extracted_fields_json: JSON.stringify(extracted),
        confirmation_message: msg,
        status: 'pending',
      },
    });

    await prisma.message.create({
      data: { case_id: caseId, role: 'assistant', content: msg },
    });
  } catch {
    // Non-fatal — extraction failure is silent
  }
}

// POST /api/upload/[token]
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const kycCase = await prisma.case.findUnique({
      where: { token: params.token },
      select: { id: true, entity_type: true },
    });

    if (!kycCase) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const docType = (formData.get('doc_type') as string) || 'other';
    const associatedPersonId = (formData.get('associated_person_id') as string) || undefined;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large (max 50 MB)' }, { status: 413 });
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload PDF, JPEG, PNG, or WebP.' },
        { status: 415 }
      );
    }

    if (!DOC_TYPE_MAP[docType]) {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }

    // Sanitise filename and build R2 object key: {caseId}/{timestamp}-{filename}
    const safeOriginalName = path.basename(file.name).replace(/[^a-zA-Z0-9._\-]/g, '_');
    const timestamp = Date.now();
    const storagePath = `${kycCase.id}/${timestamp}-${safeOriginalName}`;

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);
    await uploadFile(storagePath, fileBuffer, file.type);

    // Save document record
    const doc = await prisma.document.create({
      data: {
        case_id: kycCase.id,
        doc_type: docType,
        original_name: safeOriginalName,
        storage_path: storagePath,
        file_size: file.size,
        mime_type: file.type,
        status: 'received',
        associated_person_id: associatedPersonId || null,
      },
    });

    // Immediate chat confirmation (shown before extraction completes)
    const docLabel = DOC_TYPE_MAP[docType];
    const aiMessage = `📎 **Document received**: ${docLabel} — \`${safeOriginalName}\` (${(file.size / 1024).toFixed(1)} KB). The AI is reading this document and will confirm any extracted information shortly.`;

    await prisma.message.create({
      data: { case_id: kycCase.id, role: 'assistant', content: aiMessage },
    });

    // Recalculate docs progress (fast — no AI call)
    const freshDocs = await prisma.document.findMany({ where: { case_id: kycCase.id } });
    const freshCounterparty = await prisma.counterparty.findUnique({
      where: { case_id: kycCase.id },
      include: { associated_persons: true },
    });

    let mandatoryPercent: number | undefined;
    let docsPercent: number | undefined;

    if (freshCounterparty) {
      const { calculateDualProgress } = await import('@/lib/progress');
      const progress = calculateDualProgress(freshCounterparty, freshDocs);
      mandatoryPercent = progress.mandatory_percent;
      docsPercent = progress.docs_percent;
      await prisma.case.update({
        where: { id: kycCase.id },
        data: {
          mandatory_percent: progress.mandatory_percent,
          docs_percent: progress.docs_percent,
          completion_percent: progress.overall,
          status: progress.status,
        },
      });
    }

    // Fire extraction in background — does NOT block this response.
    // When done it saves a new PendingExtraction + follow-up chat message,
    // which the client picks up on the next message send or 30s poll.
    void runDocumentIntelligence(
      kycCase.id,
      doc.id,
      safeOriginalName,
      fileBuffer,
      file.type,
      kycCase.entity_type,
    );

    return NextResponse.json({
      success: true,
      document: {
        id: doc.id,
        doc_type: doc.doc_type,
        original_name: doc.original_name,
        file_size: doc.file_size,
        status: doc.status,
      },
      aiMessage,
      mandatoryPercent,
      docsPercent,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[upload] Error:', msg);
    return NextResponse.json({ error: msg.includes('R2') ? 'File storage is not configured. Please contact support.' : 'Upload failed' }, { status: 500 });
  }
}

// GET /api/upload/[token] — list documents
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const kycCase = await prisma.case.findUnique({
      where: { token: params.token },
      select: { id: true },
    });

    if (!kycCase) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const documents = await prisma.document.findMany({
      where: { case_id: kycCase.id },
      select: {
        id: true, doc_type: true, original_name: true,
        file_size: true, mime_type: true, status: true,
        associated_person_id: true, notes: true, created_at: true,
      },
      orderBy: { created_at: 'desc' },
    });

    return NextResponse.json({ documents });
  } catch {
    return NextResponse.json({ error: 'Failed to list documents' }, { status: 500 });
  }
}
