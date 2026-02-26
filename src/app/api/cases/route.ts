import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WELCOME_MESSAGE } from '@/lib/conversation';

// POST /api/cases — create a new onboarding case
export async function POST() {
  try {
    const kycCase = await prisma.case.create({
      data: {
        counterparty: { create: {} },
        messages: {
          create: {
            role: 'assistant',
            content: WELCOME_MESSAGE,
            metadata: JSON.stringify({ type: 'welcome', progress: 0 }),
          },
        },
      },
      include: { messages: true, counterparty: true, documents: true },
    });

    return NextResponse.json({
      token: kycCase.token,
      caseId: kycCase.id,
    });
  } catch (error) {
    console.error('[cases] Create error');
    return NextResponse.json({ error: 'Failed to create case' }, { status: 500 });
  }
}

// GET /api/cases — list cases (admin)
export async function GET() {
  try {
    const cases = await prisma.case.findMany({
      select: {
        id: true, token: true, status: true,
        mandatory_percent: true, docs_percent: true, completion_percent: true,
        entity_type: true, risk_flag: true,
        submitted_to_compliance: true, submitted_at: true,
        created_at: true, updated_at: true,
        _count: { select: { messages: true, documents: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 50,
    });

    return NextResponse.json({ cases });
  } catch {
    return NextResponse.json({ error: 'Failed to list cases' }, { status: 500 });
  }
}
