import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function csvEscape(value: string | null | undefined): string {
  const str = value ?? '';
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function bool(val: boolean | null | undefined): string {
  if (val == null) return '';
  return val ? 'Yes' : 'No';
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format') ?? 'json';
  const caseId = searchParams.get('id');

  const cases = await prisma.case.findMany({
    where: caseId ? { id: caseId } : undefined,
    include: {
      counterparty: { include: { associated_persons: true } },
      documents: {
        select: {
          id: true, doc_type: true, original_name: true,
          file_size: true, mime_type: true, status: true, notes: true, created_at: true,
        },
      },
      messages: {
        select: { id: true, role: true, content: true, created_at: true },
        orderBy: { created_at: 'asc' },
      },
    },
    orderBy: { created_at: 'desc' },
  });

  const timestamp = new Date().toISOString().split('T')[0];
  const filename = caseId
    ? `kyc-case-${caseId.slice(0, 8)}-${timestamp}`
    : `kyc-cases-${timestamp}`;

  if (format === 'csv') {
    const headers = [
      'case_id', 'token', 'status', 'mandatory_percent', 'docs_percent', 'entity_type', 'risk_flag', 'created_at',
      'registered_name', 'registration_or_id_number', 'business_address', 'email_address',
      'business_phone_work', 'business_phone_cell', 'website', 'tax_number', 'vat_number',
      'contact_person_name', 'contact_person_email',
      'pep_related', 'bank_name', 'account_name', 'account_number', 'branch_code',
      'source_of_funds_description', 'business_activity_description',
      'holds_license', 'subject_to_aml_law', 'has_anti_bribery_policy',
      'payment_method_primary', 'popia_consent', 'info_true_declaration',
      'submitted_to_compliance', 'message_count', 'document_count', 'associated_person_count',
    ];

    const rows: string[] = [headers.join(',')];

    for (const c of cases) {
      const cp = c.counterparty;
      rows.push([
        c.id, c.token, c.status, c.mandatory_percent, c.docs_percent,
        c.entity_type ?? '', bool(c.risk_flag), c.created_at.toISOString(),
        csvEscape(cp?.registered_name), csvEscape(cp?.registration_or_id_number),
        csvEscape(cp?.business_address), csvEscape(cp?.email_address),
        csvEscape(cp?.business_phone_work), csvEscape(cp?.business_phone_cell),
        csvEscape(cp?.website), csvEscape(cp?.tax_number), csvEscape(cp?.vat_number),
        csvEscape(cp?.contact_person_name), csvEscape(cp?.contact_person_email),
        bool(cp?.pep_related),
        csvEscape(cp?.bank_name), csvEscape(cp?.account_name), csvEscape(cp?.account_number),
        csvEscape(cp?.branch_code), csvEscape(cp?.source_of_funds_description),
        csvEscape(cp?.business_activity_description),
        bool(cp?.holds_license), bool(cp?.subject_to_aml_law), bool(cp?.has_anti_bribery_policy),
        csvEscape(cp?.payment_method_primary),
        bool(cp?.popia_consent), bool(cp?.info_true_declaration),
        bool(c.submitted_to_compliance),
        c.messages.length, c.documents.length,
        cp?.associated_persons?.length ?? 0,
      ].join(','));
    }

    return new NextResponse(rows.join('\n'), {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}.csv"`,
      },
    });
  }

  const exportData = {
    export_metadata: {
      exported_at: new Date().toISOString(),
      total_cases: cases.length,
      system: 'MetCon KYC Onboarding',
    },
    cases,
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}.json"`,
    },
  });
}
