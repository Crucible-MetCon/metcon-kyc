import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { ChatInterface } from '@/components/ChatInterface';
import { calculateDualProgress } from '@/lib/progress';
import type { CaseStatus, MessageData, DocumentData } from '@/types/kyc';

interface ChatPageProps {
  params: { token: string };
}

export default async function ChatPage({ params }: ChatPageProps) {
  const include = {
    messages: { orderBy: { created_at: 'asc' } as const },
    counterparty: { include: { associated_persons: true } },
    documents: true,
  };

  // Try token first (normal path), then fall back to id (for old copied case IDs)
  const kycCase =
    (await prisma.case.findUnique({ where: { token: params.token }, include })) ??
    (await prisma.case.findUnique({ where: { id: params.token }, include }));

  if (!kycCase) {
    notFound();
  }

  // Recalculate progress on load (ensures fresh state)
  const progress = kycCase.counterparty
    ? calculateDualProgress(kycCase.counterparty, kycCase.documents)
    : { mandatory_percent: 0, docs_percent: 0, overall: 0, can_submit: false, status: 'in_progress' as CaseStatus, mandatory_missing: [], docs_missing: [], sections: [], hasRequiredPerson: false, docs_uploaded: [] };

  const messages: MessageData[] = kycCase.messages.map((m) => ({
    id: m.id,
    role: m.role as 'user' | 'assistant',
    content: m.content,
    metadata: m.metadata,
    created_at: m.created_at,
  }));

  const documents: DocumentData[] = kycCase.documents.map((d) => ({
    id: d.id,
    doc_type: d.doc_type,
    original_name: d.original_name,
    file_size: d.file_size,
    mime_type: d.mime_type,
    status: d.status,
    created_at: d.created_at,
  }));

  return (
    <ChatInterface
      token={kycCase.token}
      caseId={kycCase.id}
      initialMessages={messages}
      initialMandatoryPercent={progress.mandatory_percent}
      initialDocsPercent={progress.docs_percent}
      initialStatus={kycCase.status as CaseStatus}
      initialCanSubmit={progress.can_submit}
      entityType={kycCase.entity_type}
      submittedToCompliance={kycCase.submitted_to_compliance}
      initialDocuments={documents}
    />
  );
}
