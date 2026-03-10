import { prisma } from '@/lib/prisma';
import AdminNav from '../AdminNav';
import UserManagement from './UserManagement';

export const dynamic = 'force-dynamic';

type AdminUserRow = {
  id: string;
  username: string;
  display_name: string | null;
  created_at: Date;
};

export default async function AdminUsersPage() {
  const users = (await prisma.adminUser.findMany({
    select: { id: true, username: true, display_name: true, created_at: true },
    orderBy: { created_at: 'asc' },
  })) as AdminUserRow[];

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Users</h1>
        <UserManagement initialUsers={users} />
      </main>
    </div>
  );
}
