/**
 * Seed the initial admin user from environment variables.
 * Only creates a user if the AdminUser table is empty.
 * Run: npx ts-node prisma/seed-admin.ts
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.adminUser.count();
  if (count > 0) {
    console.log(`[seed-admin] ${count} admin user(s) already exist — skipping seed.`);
    return;
  }

  const username = process.env.ADMIN_USERNAME ?? 'admin';
  const password = process.env.ADMIN_PASSWORD ?? 'admin';

  const hash = await bcrypt.hash(password, 12);

  await prisma.adminUser.create({
    data: {
      username,
      password_hash: hash,
      display_name: 'Administrator',
    },
  });

  console.log(`[seed-admin] Created initial admin user: "${username}"`);
}

main()
  .catch((e) => {
    console.error('[seed-admin] Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
