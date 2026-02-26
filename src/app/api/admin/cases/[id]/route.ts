import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateDualProgress } from '@/lib/progress';
import { deleteAllCaseFiles } from '@/lib/storage';

export const runtime = 'nodejs';

// Fields on the Counterparty model that are JSON-encoded comma-separated lists
const COMMA_TO_JSON = ['business_type_checkboxes', 'license_types', 'metal_forms_json', 'association_memberships_json'];

// PATCH /api/admin/cases/[id]
// Body: { caseData?: { status?, risk_flag? }, counterparty?: { ...fields } }
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json() as {
      caseData?: { status?: string; risk_flag?: boolean };
      counterparty?: Record<string, unknown>;
    };

    // Update case-level fields
    if (body.caseData && Object.keys(body.caseData).length > 0) {
      await prisma.case.update({
        where: { id: params.id },
        data: body.caseData,
      });
    }

    // Update counterparty fields
    if (body.counterparty) {
      const cpData = { ...body.counterparty };

      // Convert comma-separated strings back to JSON arrays
      for (const field of COMMA_TO_JSON) {
        if (typeof cpData[field] === 'string') {
          const raw = (cpData[field] as string).trim();
          cpData[field] = raw ? JSON.stringify(raw.split(',').map((s) => s.trim()).filter(Boolean)) : null;
        }
      }

      // Coerce empty strings to null for optional fields
      for (const [k, v] of Object.entries(cpData)) {
        if (v === '') cpData[k] = null;
      }

      const exists = await prisma.counterparty.findUnique({ where: { case_id: params.id } });
      if (exists) {
        await prisma.counterparty.update({
          where: { case_id: params.id },
          data: cpData,
        });

        // Recalculate progress
        const fresh = await prisma.counterparty.findUnique({
          where: { case_id: params.id },
          include: { associated_persons: true },
        });
        const docs = await prisma.document.findMany({ where: { case_id: params.id } });
        if (fresh) {
          const progress = calculateDualProgress(fresh, docs);
          await prisma.case.update({
            where: { id: params.id },
            data: {
              mandatory_percent:  progress.mandatory_percent,
              docs_percent:       progress.docs_percent,
              completion_percent: progress.overall,
              status:             body.caseData?.status ?? progress.status,
            },
          });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[admin/cases PATCH]', msg);
    return NextResponse.json({ error: 'Failed to update case', detail: msg }, { status: 500 });
  }
}

// DELETE /api/admin/cases/[id]
// Permanently deletes the case, all related DB records (cascade), and all R2 files.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Delete R2 files first (non-fatal if bucket is empty or R2 not configured)
    try {
      await deleteAllCaseFiles(params.id);
    } catch (storageErr) {
      console.warn('[admin/cases DELETE] R2 cleanup skipped:', storageErr);
    }

    await prisma.case.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[admin/cases DELETE]', msg);
    return NextResponse.json({ error: 'Failed to delete case', detail: msg }, { status: 500 });
  }
}
