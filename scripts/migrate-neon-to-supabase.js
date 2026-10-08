const { PrismaClient: NeonClient } = require('@prisma/client');
const { PrismaClient: SupabaseClient } = require('@prisma/client');

const NEON_URL = "postgresql://neondb_owner:npg_HP8VAXBs5Mxg@ep-purple-queen-airueo41-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&connection_limit=1";
const SUPABASE_URL = "postgresql://postgres.fwwznmgovjagmqfwoime:012116326mrneonmx10Supabase%23@aws-0-eu-west-1.pooler.supabase.com:5432/postgres";

const neon = new NeonClient({ datasources: { db: { url: NEON_URL } } });
const supabase = new SupabaseClient({ datasources: { db: { url: SUPABASE_URL } } });

async function migrate() {
  console.log('🚀 Starting Full Migration from Neon to Supabase...');

  try {
    // 1. Departments
    console.log('Migrating Departments...');
    const depts = await neon.department.findMany();
    for (const d of depts) {
      await supabase.department.upsert({ where: { id: d.id }, update: d, create: d });
    }
    console.log(`✓ Departments: ${depts.length}`);

    // 2. Users
    console.log('Migrating Users...');
    const users = await neon.user.findMany();
    for (const u of users) {
      await supabase.user.upsert({ where: { id: u.id }, update: u, create: u });
    }
    console.log(`✓ Users: ${users.length}`);

    // 3. Accounts & Sessions
    console.log('Migrating Accounts & Profiles...');
    const accounts = await neon.account.findMany();
    for (const a of accounts) {
      await supabase.account.upsert({ where: { id: a.id }, update: a, create: a });
    }

    const docProfiles = await neon.doctorProfile.findMany();
    for (const dp of docProfiles) {
      await supabase.doctorProfile.upsert({ where: { id: dp.id }, update: dp, create: dp });
    }

    const adminProfiles = await neon.adminProfile.findMany();
    for (const ap of adminProfiles) {
      await supabase.adminProfile.upsert({ where: { id: ap.id }, update: ap, create: ap });
    }

    // 4. Students
    console.log('Migrating Students...');
    const students = await neon.student.findMany();
    for (const s of students) {
      await supabase.student.upsert({ where: { id: s.id }, update: s, create: s });
    }
    console.log(`✓ Students: ${students.length}`);

    // 5. Subjects
    console.log('Migrating Subjects...');
    const subjects = await neon.subject.findMany();
    for (const sub of subjects) {
      await supabase.subject.upsert({ where: { id: sub.id }, update: sub, create: sub });
    }
    console.log(`✓ Subjects: ${subjects.length}`);

    // 6. Student Subjects
    console.log('Migrating StudentSubject enrollments...');
    const enrollments = await neon.studentSubject.findMany();
    for (const e of enrollments) {
      await supabase.studentSubject.upsert({
        where: { studentId_subjectId: { studentId: e.studentId, subjectId: e.subjectId } },
        update: e,
        create: e
      });
    }

    // 7. Assignments & Submissions
    console.log('Migrating Assignments & Submissions...');
    const assignments = await neon.assignment.findMany();
    for (const a of assignments) {
      await supabase.assignment.upsert({ where: { id: a.id }, update: a, create: a });
    }
    console.log(`✓ Assignments: ${assignments.length}`);

    const submissions = await neon.assignmentSubmission.findMany();
    for (const sub of submissions) {
      await supabase.assignmentSubmission.upsert({
        where: { assignmentId_studentId: { assignmentId: sub.assignmentId, studentId: sub.studentId } },
        update: sub,
        create: sub
      });
    }
    console.log(`✓ Submissions: ${submissions.length}`);

    // 8. Attendance Sessions & Records
    console.log('Migrating Attendance...');
    const attSessions = await neon.attendanceSession.findMany();
    for (const s of attSessions) {
      await supabase.attendanceSession.upsert({ where: { id: s.id }, update: s, create: s });
    }
    const attendances = await neon.attendance.findMany();
    for (const att of attendances) {
      await supabase.attendance.upsert({
        where: { studentId_sessionId: { studentId: att.studentId, sessionId: att.sessionId } },
        update: att,
        create: att
      });
    }
    console.log(`✓ Attendance Sessions: ${attSessions.length}, Records: ${attendances.length}`);

    // 9. Quizzes, Questions & Attempts
    console.log('Migrating Quizzes & Questions...');
    const quizzes = await neon.quiz.findMany();
    for (const q of quizzes) {
      await supabase.quiz.upsert({ where: { id: q.id }, update: q, create: q });
    }
    const questions = await neon.question.findMany();
    for (const qn of questions) {
      await supabase.question.upsert({ where: { id: qn.id }, update: qn, create: qn });
    }
    const quizAttempts = await neon.quizAttempt.findMany();
    for (const qa of quizAttempts) {
      await supabase.quizAttempt.upsert({ where: { id: qa.id }, update: qa, create: qa });
    }
    console.log(`✓ Quizzes: ${quizzes.length}, Questions: ${questions.length}`);

    // 10. Lectures, Library & Books
    console.log('Migrating Lectures, Slides & Library...');
    const zoomLectures = await neon.zoomLecture.findMany();
    for (const z of zoomLectures) {
      await supabase.zoomLecture.upsert({ where: { id: z.id }, update: z, create: z });
    }
    const slides = await neon.lectureSlide.findMany();
    for (const sl of slides) {
      await supabase.lectureSlide.upsert({ where: { id: sl.id }, update: sl, create: sl });
    }
    const library = await neon.eLibraryItem.findMany();
    for (const el of library) {
      await supabase.eLibraryItem.upsert({ where: { id: el.id }, update: el, create: el });
    }
    const books = await neon.book.findMany();
    for (const b of books) {
      await supabase.book.upsert({ where: { id: b.id }, update: b, create: b });
    }

    // 11. Notifications, Results & System Configs
    console.log('Migrating Notifications, Exam Results & Configs...');
    const examResults = await neon.examResult.findMany();
    for (const er of examResults) {
      await supabase.examResult.upsert({
        where: { subjectId_studentId_examType_semester_academicYear: {
          subjectId: er.subjectId,
          studentId: er.studentId,
          examType: er.examType,
          semester: er.semester,
          academicYear: er.academicYear
        }},
        update: er,
        create: er
      });
    }

    const notifs = await neon.notification.findMany();
    for (const n of notifs) {
      await supabase.notification.upsert({ where: { id: n.id }, update: n, create: n });
    }

    const configs = await neon.systemConfig.findMany();
    for (const c of configs) {
      await supabase.systemConfig.upsert({ where: { key: c.key }, update: c, create: c });
    }

    const roleRules = await neon.roleRule.findMany();
    for (const rr of roleRules) {
      await supabase.roleRule.upsert({ where: { id: rr.id }, update: rr, create: rr });
    }

    console.log('\n🎉 ALL DATA SUCCESSFULLY MIGRATED TO SUPABASE!');
  } catch (err) {
    console.error('Migration Error:', err.message);
  } finally {
    await neon.$disconnect();
    await supabase.$disconnect();
  }
}

migrate();
