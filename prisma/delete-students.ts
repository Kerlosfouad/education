import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  // Delete in order to respect foreign key constraints
  const deletedAttempts = await db.quizAttempt.deleteMany({});
  console.log(`Deleted ${deletedAttempts.count} quiz attempts`);

  const deletedSubmissions = await db.assignmentSubmission.deleteMany({});
  console.log(`Deleted ${deletedSubmissions.count} assignment submissions`);

  const deletedAttendances = await db.attendance.deleteMany({});
  console.log(`Deleted ${deletedAttendances.count} attendance records`);

  const deletedStudents = await db.student.deleteMany({});
  console.log(`Deleted ${deletedStudents.count} student profiles`);

  // Delete user accounts with STUDENT role
  const deletedUsers = await db.user.deleteMany({
    where: { role: 'STUDENT' },
  });
  console.log(`Deleted ${deletedUsers.count} student user accounts`);

  console.log('Done! All student accounts have been removed.');
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
