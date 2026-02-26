'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export const STATUS_OPTIONS = [
  { value: 'new',          label: 'New',          cls: 'bg-gray-100   text-gray-600'   },
  { value: 'in_progress',  label: 'In Progress',  cls: 'bg-blue-100   text-blue-700'   },
  { value: 'needs_review', label: 'Needs Review', cls: 'bg-amber-100  text-amber-700'  },
  { value: 'approved',     label: 'Approved',     cls: 'bg-green-100  text-green-700'  },
  { value: 'medium_risk',  label: 'Medium Risk',  cls: 'bg-orange-100 text-orange-700' },
  { value: 'high_risk',    label: 'High Risk',    cls: 'bg-red-100    text-red-700'    },
] as const;

export type StatusValue = typeof STATUS_OPTIONS[number]['value'];

export function statusMeta(status: string) {
  return STATUS_OPTIONS.find((o) => o.value === status)
    ?? { value: status, label: status, cls: 'bg-gray-100 text-gray-600' };
}

export function StatusBadge({ status }: { status: string }) {
  const { cls, label } = statusMeta(status);
  return (
    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

export default function StatusDropdown({ caseId, current }: { caseId: string; current: string }) {
  const router = useRouter();
  const [value,   setValue]   = useState(current);
  const [saving,  setSaving]  = useState(false);

  async function handleChange(next: string) {
    if (next === value) return;
    setSaving(true);
    try {
      await fetch(`/api/admin/cases/${caseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseData: { status: next } }),
      });
      setValue(next);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const { cls } = statusMeta(value);

  return (
    <div className="relative inline-block">
      <select
        value={value}
        disabled={saving}
        onChange={(e) => handleChange(e.target.value)}
        className={`appearance-none text-xs font-medium rounded-full px-2.5 py-0.5 pr-6 border-0
          cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-400
          disabled:opacity-60 disabled:cursor-wait ${cls}`}
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {/* Custom chevron */}
      <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] opacity-60">
        ▾
      </span>
    </div>
  );
}
