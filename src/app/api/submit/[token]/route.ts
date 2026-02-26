import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateDualProgress } from '@/lib/progress';
import { sendComplianceEmail } from '@/lib/email';
import path from 'path';

export const runtime = 'nodejs';

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? './uploads';

// POST /api/submit/[token] — send onboarding pack to compliance team
export async function POST(_req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const kycCase = await prisma.case.findUnique({
      where: { token: params.token },
      include: {
        counterparty: { include: { associated_persons: true } },
        documents: { orderBy: { created_at: 'asc' } },
      },
    });

    if (!kycCase || !kycCase.counterparty) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    if (kycCase.submitted_to_compliance) {
      return NextResponse.json({ error: 'Case already submitted to compliance' }, { status: 409 });
    }

    const progress = calculateDualProgress(kycCase.counterparty, kycCase.documents);

    // Require minimum fields to be met before submitting
    if (!progress.can_submit) {
      return NextResponse.json({
        error: 'Minimum required fields not complete',
        missingFields: progress.mandatory_missing.map((f) => f.label),
      }, { status: 422 });
    }

    // Build document attachments (only if files exist and total < 20 MB)
    let totalSize = 0;
    const attachments: Array<{ filename: string; path: string }> = [];

    for (const doc of kycCase.documents) {
      const fullPath = path.join(UPLOAD_DIR, doc.storage_path);
      totalSize += doc.file_size;
      if (totalSize < 20 * 1024 * 1024) {
        attachments.push({ filename: doc.original_name, path: fullPath });
      }
    }

    await sendComplianceEmail({
      caseId: kycCase.id,
      token: kycCase.token,
      registeredName: kycCase.counterparty.registered_name ?? '',
      entityType: kycCase.counterparty.entity_type ?? kycCase.entity_type ?? 'Unknown',
      registrationNumber: kycCase.counterparty.registration_or_id_number ?? '',
      progress,
      uploadedDocuments: kycCase.documents.map((d) => ({
        doc_type: d.doc_type,
        original_name: d.original_name,
        file_size: d.file_size,
      })),
      documentAttachments: attachments.length > 0 ? attachments : undefined,
    });

    // Mark case as submitted
    await prisma.case.update({
      where: { id: kycCase.id },
      data: {
        submitted_to_compliance: true,
        submitted_at: new Date(),
        status: 'submitted_to_compliance',
      },
    });

    // Add a chat message
    await prisma.message.create({
      data: {
        case_id: kycCase.id,
        role: 'assistant',
        content: `✅ **Onboarding pack submitted to compliance!**\n\nYour application has been sent to the MetCon compliance team. They will review your information and documents and be in touch within **2 business days**.\n\nIf you have any questions in the meantime, email **compliance@metcon.co.za** and quote your Case ID: \`${kycCase.id}\`.`,
      },
    });

    return NextResponse.json({
      success: true,
      submittedAt: new Date().toISOString(),
      mandatoryPercent: progress.mandatory_percent,
      docsPercent: progress.docs_percent,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    if (msg.includes('SMTP not configured')) {
      return NextResponse.json({
        error: 'Email not configured. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in your .env file.',
      }, { status: 503 });
    }
    console.error('[submit] Error (non-sensitive)');
    return NextResponse.json({ error: 'Failed to submit. Please try again.' }, { status: 500 });
  }
}
