import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  // Find all STUDENT users that have no student record (deleted students)
  const orphanUsers = await db.user.findMany({
    where: {
      role: 'STUDENT',
      student: null,
    },
    select: { id: true, email: true, name: true, status: true },
  });

  console.log(`Found ${orphanUsers.length} orphan student users:`);
  orphanUsers.forEach(u => console.log(`  - ${u.email} (${u.status}) ${u.name || '(no name)'}`));

  if (orphanUsers.length === 0) {
    console.log('Nothing to clean up.');
    return;
  }

  const ids = orphanUsers.map(u => u.id);

  // Delete related data first
  await db.notification.deleteMany({ where: { userId: { in: ids } } });
  console.log('Deleted notifications');

  // Delete the user accounts
  await db.user.deleteMany({ where: { id: { in: ids } } });
  console.log(`Deleted ${ids.length} orphan user accounts`);

  console.log('Cleanup complete.');
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
