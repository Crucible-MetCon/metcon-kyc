import { ReactNode } from 'react';

// Minimal layout wrapper — protected pages include <AdminNav /> themselves
// so that the login page can have a clean full-screen layout without a nav bar.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-gray-50">{children}</div>;
}
