import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// PUT /api/admin/users/[id] — update an admin user
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { display_name, password } = (await req.json()) as {
    display_name?: string;
    password?: string;
  };

  const user = await prisma.adminUser.findUnique({ where: { id: params.id } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const data: { display_name?: string | null; password_hash?: string } = {};

  if (display_name !== undefined) {
    data.display_name = display_name.trim() || null;
  }

  if (password) {
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }
    data.password_hash = await bcrypt.hash(password, 12);
  }

  const updated = await prisma.adminUser.update({
    where: { id: params.id },
    data,
    select: { id: true, username: true, display_name: true, created_at: true },
  });

  return NextResponse.json({ user: updated });
}

// DELETE /api/admin/users/[id] — delete an admin user
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const count = await prisma.adminUser.count();
  if (count <= 1) {
    return NextResponse.json({ error: 'Cannot delete the last admin user' }, { status: 400 });
  }

  const user = await prisma.adminUser.findUnique({ where: { id: params.id } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  await prisma.adminUser.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}
