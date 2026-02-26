'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DeleteCaseButton({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [confirm,   setConfirm]  = useState(false);
  const [deleting,  setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await fetch(`/api/admin/cases/${caseId}`, { method: 'DELETE' });
      router.refresh();
    } catch {
      setDeleting(false);
      setConfirm(false);
    }
  }

  if (confirm) {
    return (
      <span className="flex items-center gap-1">
        <button
          onClick={() => setConfirm(false)}
          disabled={deleting}
          className="px-2 py-0.5 text-xs border border-gray-300 text-gray-500 rounded hover:bg-gray-50 transition-colors"
        >
          No
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="px-2 py-0.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors font-medium disabled:opacity-60"
        >
          {deleting ? '…' : 'Yes'}
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirm(true)}
      className="px-2 py-0.5 text-xs border border-red-200 text-red-500 rounded hover:bg-red-50 hover:border-red-400 hover:text-red-700 transition-colors"
    >
      Delete
    </button>
  );
}
