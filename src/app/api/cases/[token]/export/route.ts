import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/cases/[token]/export — export full case as JSON for compliance review
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const kycCase = await prisma.case.findUnique({
      where: { token: params.token },
      include: {
        counterparty: {
          include: { associated_persons: true },
        },
        documents: {
          select: {
            id: true,
            doc_type: true,
            original_name: true,
            file_size: true,
            mime_type: true,
            status: true,
            associated_person_id: true,
            notes: true,
            created_at: true,
            // Exclude storage_path from export for security
          },
        },
        messages: {
          select: {
            id: true,
            role: true,
            content: true,
            created_at: true,
          },
          orderBy: { created_at: 'asc' },
        },
      },
    });

    if (!kycCase) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const exportData = {
      export_metadata: {
        exported_at: new Date().toISOString(),
        case_token: kycCase.token,
        purpose: 'FICA KYC Compliance Review',
        system: 'MetCon KYC Onboarding v0.1',
      },
      case_summary: {
        id: kycCase.id,
        status: kycCase.status,
        completion_percent: kycCase.completion_percent,
        entity_type: kycCase.entity_type,
        risk_flag: kycCase.risk_flag,
        created_at: kycCase.created_at,
        updated_at: kycCase.updated_at,
      },
      counterparty: kycCase.counterparty,
      documents: kycCase.documents,
      conversation_summary: {
        message_count: kycCase.messages.length,
        first_message_at: kycCase.messages[0]?.created_at ?? null,
        last_message_at: kycCase.messages[kycCase.messages.length - 1]?.created_at ?? null,
      },
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="kyc-case-${kycCase.id.slice(0, 8)}-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (error) {
    console.error('[export] Error:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
