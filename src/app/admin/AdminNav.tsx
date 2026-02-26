'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function AdminNav() {
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
    router.refresh();
  }

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-bold text-gray-900">MetCon Admin</span>
          <span className="text-gray-300">|</span>
          <Link href="/admin" className="text-sm text-gray-500 hover:text-blue-600 transition-colors">
            Cases
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <a
            href="/api/admin/export?format=json"
            className="text-xs text-gray-500 hover:text-gray-800 transition-colors"
          >
            Export JSON
          </a>
          <a
            href="/api/admin/export?format=csv"
            className="text-xs text-gray-500 hover:text-gray-800 transition-colors"
          >
            Export CSV
          </a>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-red-600 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}
