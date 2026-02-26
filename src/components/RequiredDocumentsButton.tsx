'use client';

import { FileText } from 'lucide-react';

interface RequiredDocumentsButtonProps {
  uploadedCount: number;
  totalCount: number;
  onClick: () => void;
}

export function RequiredDocumentsButton({ uploadedCount, totalCount, onClick }: RequiredDocumentsButtonProps) {
  const allDone = totalCount > 0 && uploadedCount >= totalCount;

  return (
    <button
      onClick={onClick}
      title="Required Documents"
      className={`fixed bottom-20 right-4 z-30 flex items-center gap-2 rounded-full shadow-lg px-4 py-2.5 transition-all
        ${allDone
          ? 'bg-green-600 text-white hover:bg-green-700'
          : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:shadow-xl'
        }`}
    >
      <FileText className="w-4.5 h-4.5 shrink-0" />
      <span className="text-sm font-medium">
        Docs{' '}
        <span className={`tabular-nums ${allDone ? 'text-green-100' : 'text-gray-500'}`}>
          {uploadedCount}/{totalCount}
        </span>
      </span>
    </button>
  );
}
