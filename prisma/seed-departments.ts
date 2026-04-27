import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

// Only the 4 departments shown in the app
const departments = [
  { name: 'Level 0', code: 'PREP',  level: 1 },
  { name: 'Architecture',         code: 'ARCH',  level: 2 },
  { name: 'Civil Engineering',    code: 'CIVIL', level: 2 },
  { name: 'Computer Engineering', code: 'COMP',  level: 2 },
];

async function main() {
  console.log('Seeding departments...');

  // Remove extra departments that were added previously
  const keepCodes = departments.map(d => d.code);
  const deleted = await db.department.deleteMany({
    where: { code: { notIn: keepCodes } },
  });
  console.log(`  Removed ${deleted.count} extra departments`);

  for (const dept of departments) {
    await db.department.upsert({
      where: { code: dept.code },
      update: { name: dept.name, level: dept.level },
      create: { name: dept.name, code: dept.code, level: dept.level, isActive: true },
    });
    console.log(`  ✓ ${dept.name}`);
  }
  console.log('Done.');
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
