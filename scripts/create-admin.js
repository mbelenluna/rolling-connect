/**
 * Create or reset an admin user. Generates a random password and prints credentials.
 * Usage: node scripts/create-admin.js [email]
 * Default email: admin@rolling-connect.com
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let pwd = '';
  for (let i = 0; i < 14; i++) {
    pwd += chars[crypto.randomInt(0, chars.length)];
  }
  return pwd;
}

async function main() {
  const email = process.argv[2] || 'admin@rolling-connect.com';
  const password = generatePassword();
  const hash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash: hash, role: 'admin', name: 'Admin User' },
    create: {
      email,
      passwordHash: hash,
      role: 'admin',
      name: 'Admin User',
    },
  });

  console.log('\nAdmin account created/updated successfully.\n');
  console.log('  Email:    ' + email);
  console.log('  Password: ' + password);
  console.log('\nSign in at /login with these credentials. Save the password - it will not be shown again.\n');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
