const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('password123', 10);

  // Languages (Chinese: only Mandarin and Cantonese; no duplicates)
  const languages = [
    { code: 'es', name: 'Spanish' },
    { code: 'zh-cmn', name: 'Chinese Mandarin' },
    { code: 'yue', name: 'Chinese Cantonese' },
    { code: 'ar', name: 'Arabic' },
    { code: 'vi', name: 'Vietnamese' },
    { code: 'ko', name: 'Korean' },
    { code: 'ru', name: 'Russian' },
    { code: 'fr', name: 'French' },
    { code: 'sq', name: 'Albanian' },
    { code: 'am', name: 'Amharic' },
    { code: 'hy', name: 'Armenian' },
    { code: 'az', name: 'Azerbaijani' },
    { code: 'bah', name: 'Bahamian' },
    { code: 'bn', name: 'Bengali' },
    { code: 'bs', name: 'Bosnian' },
    { code: 'bg', name: 'Bulgarian' },
    { code: 'my', name: 'Burmese' },
    { code: 'ca', name: 'Catalan' },
    { code: 'cs', name: 'Czech' },
    { code: 'prs', name: 'Dari' },
    { code: 'nl', name: 'Dutch' },
    { code: 'fa', name: 'Farsi' },
    { code: 'fj', name: 'Fijian' },
    { code: 'fi', name: 'Finnish' },
    { code: 'de', name: 'German' },
    { code: 'el', name: 'Greek' },
    { code: 'gu', name: 'Gujarati' },
    { code: 'ht', name: 'Haitian Creole' },
    { code: 'ha', name: 'Hausa' },
    { code: 'he', name: 'Hebrew' },
    { code: 'hi', name: 'Hindi' },
    { code: 'hmn', name: 'Hmong' },
    { code: 'hu', name: 'Hungarian' },
    { code: 'ig', name: 'Ibibio (Ibo)' },
    { code: 'ilo', name: 'Ilocano' },
    { code: 'id', name: 'Indonesian' },
    { code: 'it', name: 'Italian' },
    { code: 'ja', name: 'Japanese' },
    { code: 'km', name: 'Khmer' },
    { code: 'lo', name: 'Lao' },
    { code: 'lt', name: 'Lithuanian' },
    { code: 'ms', name: 'Malay' },
    { code: 'mn', name: 'Mongolian' },
    { code: 'ne', name: 'Nepali' },
    { code: 'pl', name: 'Polish' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'pa', name: 'Punjabi' },
    { code: 'ro', name: 'Romanian' },
    { code: 'sr', name: 'Serbian' },
    { code: 'si', name: 'Sinhalese' },
    { code: 'so', name: 'Somali' },
    { code: 'sw', name: 'Swahili' },
    { code: 'sv', name: 'Swedish' },
    { code: 'tl', name: 'Tagalog' },
    { code: 'ta', name: 'Tamil' },
    { code: 'th', name: 'Thai' },
    { code: 'to', name: 'Tongan' },
    { code: 'tr', name: 'Turkish' },
    { code: 'uk', name: 'Ukrainian' },
    { code: 'ur', name: 'Urdu' },
  ];
  for (const l of languages) {
    await prisma.language.upsert({ where: { code: l.code }, update: { name: l.name }, create: l });
  }

  // Specialties
  const specialties = [
    { code: 'medical', name: 'Medical' },
    { code: 'legal', name: 'Legal' },
    { code: 'customer_service', name: 'Customer Service' },
    { code: 'education', name: 'Education' },
    { code: 'general', name: 'General' },
    { code: 'other', name: 'Other' },
  ];
  for (const s of specialties) {
    await prisma.specialty.upsert({ where: { code: s.code }, update: {}, create: s });
  }

  // Rates
  const rates = [
    { serviceType: 'OPI', specialty: 'medical', perMinuteCents: 150, minimumMinutes: 15, minimumChargeCents: 2250, rushFeePercent: 25, effectiveFrom: new Date() },
    { serviceType: 'VRI', specialty: 'medical', perMinuteCents: 200, minimumMinutes: 15, minimumChargeCents: 3000, rushFeePercent: 25, effectiveFrom: new Date() },
    { serviceType: 'OPI', specialty: 'general', perMinuteCents: 100, minimumMinutes: 15, minimumChargeCents: 1500, rushFeePercent: 25, effectiveFrom: new Date() },
    { serviceType: 'OPI', specialty: 'other', perMinuteCents: 100, minimumMinutes: 15, minimumChargeCents: 1500, rushFeePercent: 25, effectiveFrom: new Date() },
    { serviceType: 'VRI', specialty: 'other', perMinuteCents: 150, minimumMinutes: 15, minimumChargeCents: 2250, rushFeePercent: 25, effectiveFrom: new Date() },
  ];
  for (const r of rates) {
    await prisma.rate.create({ data: r });
  }

  // Admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@rolling-connect.com' },
    update: {},
    create: { email: 'admin@rolling-connect.com', passwordHash: hash, role: 'admin', name: 'Admin User' },
  });

  // Client user + org
  const clientUser = await prisma.user.upsert({
    where: { email: 'client@example.com' },
    update: {},
    create: { email: 'client@example.com', passwordHash: hash, role: 'client', name: 'Jane Client' },
  });
  const org = await prisma.organization.upsert({
    where: { id: 'org-default-001' },
    update: {},
    create: { id: 'org-default-001', name: 'Acme Healthcare', billingEmail: 'billing@acme.com' },
  });
  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: clientUser.id } },
    update: {},
    create: { organizationId: org.id, userId: clientUser.id, role: 'owner' },
  });

  // Interpreter users
  const interp1 = await prisma.user.upsert({
    where: { email: 'interpreter1@example.com' },
    update: {},
    create: { email: 'interpreter1@example.com', passwordHash: hash, role: 'interpreter', name: 'Maria Interpreter' },
  });
  await prisma.interpreterProfile.upsert({
    where: { userId: interp1.id },
    update: {},
    create: {
      userId: interp1.id,
      languagePairs: [{ source: 'en', target: 'es', proficiency: 'native' }],
      specialties: ['medical', 'general'],
      certifications: [{ level: 'certified', name: 'CCHI' }],
      timeZone: 'America/Los_Angeles',
      yearsExperience: 5,
      securityClearance: false,
    },
  });
  await prisma.interpreterAvailability.upsert({
    where: { userId: interp1.id },
    update: { status: 'online' },
    create: { userId: interp1.id, status: 'online' },
  });

  const interp2 = await prisma.user.upsert({
    where: { email: 'interpreter2@example.com' },
    update: {},
    create: { email: 'interpreter2@example.com', passwordHash: hash, role: 'interpreter', name: 'Carlos Interpreter' },
  });
  await prisma.interpreterProfile.upsert({
    where: { userId: interp2.id },
    update: {},
    create: {
      userId: interp2.id,
      languagePairs: [{ source: 'en', target: 'es', proficiency: 'native' }],
      specialties: ['medical', 'legal', 'general'],
      certifications: [{ level: 'certified', name: 'CCHI' }],
      timeZone: 'America/New_York',
      yearsExperience: 8,
      securityClearance: false,
    },
  });
  await prisma.interpreterAvailability.upsert({
    where: { userId: interp2.id },
    update: { status: 'online' },
    create: { userId: interp2.id, status: 'online' },
  });

  console.log('Seed complete. Test users:');
  console.log('  Admin: admin@rolling-connect.com / password123');
  console.log('  Client: client@example.com / password123');
  console.log('  Interpreter 1: interpreter1@example.com / password123');
  console.log('  Interpreter 2: interpreter2@example.com / password123');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
