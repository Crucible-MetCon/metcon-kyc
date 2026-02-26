import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/cases/[token] — fetch full case
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const kycCase = await prisma.case.findUnique({
      where: { token: params.token },
      include: {
        counterparty: { include: { associated_persons: true } },
        messages: { orderBy: { created_at: 'asc' } },
        documents: { orderBy: { created_at: 'desc' } },
      },
    });

    if (!kycCase) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    return NextResponse.json({ case: kycCase });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch case' }, { status: 500 });
  }
}
