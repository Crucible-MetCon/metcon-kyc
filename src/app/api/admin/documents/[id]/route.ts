import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { downloadFile } from '@/lib/storage';

export const runtime = 'nodejs';

// GET /api/admin/documents/[id]
// Downloads a document from R2 and streams it to the browser.
// Protected by middleware (admin session required).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const doc = await prisma.document.findUnique({
      where: { id: params.id },
      select: { original_name: true, storage_path: true, mime_type: true },
    });

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const { body, contentType } = await downloadFile(doc.storage_path);

    return new NextResponse(body as unknown as BodyInit, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${doc.original_name}"`,
        'Content-Length': String(body.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[admin/documents GET]', msg);
    return NextResponse.json({ error: 'Failed to download document', detail: msg }, { status: 500 });
  }
}
