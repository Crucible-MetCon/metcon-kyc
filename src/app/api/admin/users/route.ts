import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// GET /api/admin/users — list all admin users
export async function GET() {
  const users = await prisma.adminUser.findMany({
    select: { id: true, username: true, display_name: true, created_at: true },
    orderBy: { created_at: 'asc' },
  });
  return NextResponse.json({ users });
}

// POST /api/admin/users — create a new admin user
export async function POST(req: NextRequest) {
  const { username, password, display_name } = (await req.json()) as {
    username: string;
    password: string;
    display_name?: string;
  };

  if (!username?.trim() || !password?.trim()) {
    return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
  }

  const existing = await prisma.adminUser.findUnique({ where: { username: username.trim() } });
  if (existing) {
    return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
  }

  const hash = await bcrypt.hash(password, 12);

  const user = await prisma.adminUser.create({
    data: {
      username: username.trim(),
      password_hash: hash,
      display_name: display_name?.trim() || null,
    },
    select: { id: true, username: true, display_name: true, created_at: true },
  });

  return NextResponse.json({ user }, { status: 201 });
}
