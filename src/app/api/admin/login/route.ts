import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME, COOKIE_MAX_AGE, signSession } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  const { username, password } = (await req.json()) as {
    username: string;
    password: string;
  };

  // Try database first
  const dbUser = await prisma.adminUser.findUnique({ where: { username } });

  if (dbUser) {
    const match = await bcrypt.compare(password, dbUser.password_hash);
    if (!match) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
  } else {
    // Fallback to env vars if no DB users exist (migration safety)
    const dbCount = await prisma.adminUser.count();
    if (dbCount > 0) {
      // DB has users but this username wasn't found
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // No DB users yet — check env vars
    const validUser = process.env.ADMIN_USERNAME ?? 'admin';
    const validPass = process.env.ADMIN_PASSWORD ?? 'admin';
    if (username !== validUser || password !== validPass) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
  }

  const sessionValue = await signSession(username);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, sessionValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });

  return response;
}
