import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import AdminNav from './AdminNav';
import DeleteCaseButton from './DeleteCaseButton';
import StatusDropdown from './StatusDropdown';

export const dynamic = 'force-dynamic';

// Local type that mirrors the Prisma select below — keeps TS happy before prisma generate runs
type CaseRow = {
  id: string;
  token: string;
  case_number: number;
  status: string;
  entity_type: string | null;
  mandatory_percent: number;
  docs_percent: number;
  completion_percent: number;
  risk_flag: boolean;
  submitted_to_compliance: boolean;
  created_at: Date;
  counterparty: { registered_name: string | null; email_address: string | null } | null;
  _count: { messages: number; documents: number };
};

export default async function AdminDashboardPage() {
  const cases = (await prisma.case.findMany({
    select: {
      id: true, token: true, case_number: true, status: true, entity_type: true,
      mandatory_percent: true, docs_percent: true, completion_percent: true,
      risk_flag: true, submitted_to_compliance: true, created_at: true,
      counterparty: { select: { registered_name: true, email_address: true } },
      _count: { select: { messages: true, documents: true } },
    },
    orderBy: { created_at: 'desc' },
  } as Parameters<typeof prisma.case.findMany>[0])) as unknown as CaseRow[];

  const total       = cases.length;
  const complete    = cases.filter((c) => c.status === 'complete').length;
  const inProgress  = cases.filter((c) => c.status === 'in_progress').length;
  const needsReview = cases.filter((c) => c.status === 'needs_review').length;
  const flagged     = cases.filter((c) => c.risk_flag).length;

  return (
    <>
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">KYC Cases</h1>
          <div className="flex gap-2">
            <a
              href="/api/admin/export?format=json"
              className="px-3 py-1.5 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              ↓ Export JSON
            </a>
            <a
              href="/api/admin/export?format=csv"
              className="px-3 py-1.5 text-sm bg-emerald-700 text-white rounded-lg hover:bg-emerald-600 transition-colors"
            >
              ↓ Export CSV
            </a>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Total',        value: total,       cls: 'bg-blue-50   text-blue-700'  },
            { label: 'Complete',     value: complete,    cls: 'bg-green-50  text-green-700' },
            { label: 'In Progress',  value: inProgress,  cls: 'bg-sky-50    text-sky-700'   },
            { label: 'Needs Review', value: needsReview, cls: 'bg-amber-50  text-amber-700' },
            { label: 'Risk Flagged', value: flagged,     cls: 'bg-red-50    text-red-700'   },
          ].map((s) => (
            <div key={s.label} className={`rounded-lg px-4 py-3 ${s.cls}`}>
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs font-medium mt-0.5 opacity-80">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Entity</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Progress</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Msgs</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Docs</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
                <th className="px-4 py-3 font-medium text-gray-600">Downloads</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {cases.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                    No KYC cases yet. Start one from the{' '}
                    <Link href="/" className="text-blue-600 underline">home page</Link>.
                  </td>
                </tr>
              )}
              {cases.map((c) => (
                <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {c.risk_flag && (
                        <span title="Risk flagged" className="text-red-500 text-base leading-none">⚑</span>
                      )}
                      <div>
                        <div className="font-medium text-gray-900 leading-tight">
                          {c.counterparty?.registered_name ?? (
                            <span className="text-gray-400 italic font-normal">Unnamed</span>
                          )}
                        </div>
                        {c.counterparty?.email_address && (
                          <div className="text-xs text-gray-400">{c.counterparty.email_address}</div>
                        )}
                      </div>
                    </div>
                    <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                      KYC-{String(c.case_number).padStart(4, '0')}
                    </div>
                  </td>

                  <td className="px-4 py-3 text-gray-600">{c.entity_type ?? '—'}</td>

                  <td className="px-4 py-3">
                    <StatusDropdown caseId={c.id} current={c.status} />
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-200 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full"
                          style={{
                            width: `${c.completion_percent}%`,
                            backgroundColor:
                              c.completion_percent >= 80 ? '#16a34a' :
                              c.completion_percent >= 40 ? '#2563eb' : '#94a3b8',
                          }}
                        />
                      </div>
                      <span className="text-gray-600 tabular-nums">{c.completion_percent}%</span>
                    </div>
                  </td>

                  <td className="px-4 py-3 text-gray-500 tabular-nums">{c._count.messages}</td>
                  <td className="px-4 py-3 text-gray-500 tabular-nums">{c._count.documents}</td>

                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(c.created_at).toLocaleDateString('en-ZA')}
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <a
                        href={`/api/pdf/${c.token}`}
                        target="_blank"
                        rel="noreferrer"
                        title="Download PDF"
                        className="px-2 py-1 text-xs font-medium rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        ↓ PDF
                      </a>
                      <a
                        href={`/api/admin/export?id=${c.id}&format=csv`}
                        title="Download CSV"
                        className="px-2 py-1 text-xs font-medium rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition-colors"
                      >
                        ↓ CSV
                      </a>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/cases/${c.id}`}
                        className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                      >
                        View →
                      </Link>
                      <DeleteCaseButton caseId={c.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
