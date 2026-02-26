import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateKYCPdf } from '@/lib/pdf-generator';

export const runtime = 'nodejs';

// GET /api/pdf/[token] — generate and download filled KYC PDF
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
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

    const pdfBytes = await generateKYCPdf(
      kycCase.id,
      kycCase.token,
      kycCase.counterparty,
      kycCase.documents,
      kycCase.mandatory_percent,
      kycCase.docs_percent
    );

    const filename = `MetCon-KYC-${kycCase.counterparty.registered_name?.replace(/[^a-zA-Z0-9]/g, '_') ?? kycCase.id.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.pdf`;

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[pdf] Generation error:', msg);
    return NextResponse.json({ error: 'Failed to generate PDF', detail: msg }, { status: 500 });
  }
}
