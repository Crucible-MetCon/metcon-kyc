import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import CaseEditForm, { type SerializedCase } from './CaseEditForm';

export const dynamic = 'force-dynamic';

export default async function AdminCaseDetailPage({ params }: { params: { id: string } }) {
  const kycCase = await prisma.case.findUnique({
    where: { id: params.id },
    include: {
      counterparty: { include: { associated_persons: true } },
      documents: { orderBy: { created_at: 'asc' } },
      messages: { select: { id: true }, orderBy: { created_at: 'asc' } },
    },
  });

  if (!kycCase) notFound();

  // Serialize: convert Date objects to strings so the client component can receive them
  const serialized = JSON.parse(JSON.stringify(kycCase)) as SerializedCase;

  return <CaseEditForm kycCase={serialized} />;
}
