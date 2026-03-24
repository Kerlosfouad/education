import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  // Create departments
  const departments = await Promise.all([
    prisma.department.upsert({
      where: { code: 'PREP' },
      update: {},
      create: {
        name: 'Preparatory Year',
        nameAr: 'السنة التحضيرية',
        code: 'PREP',
        description: 'Foundation year for all engineering students',
        level: 0,
      },
    }),
    prisma.department.upsert({
      where: { code: 'CIVIL' },
      update: {},
      create: {
        name: 'Civil Engineering',
        nameAr: 'الهندسة المدنية',
        code: 'CIVIL',
        description: 'Civil Engineering Department',
        level: 1,
      },
    }),
    prisma.department.upsert({
      where: { code: 'COMP' },
      update: {},
      create: {
        name: 'Computer Engineering',
        nameAr: 'هندسة الحاسبات',
        code: 'COMP',
        description: 'Computer Engineering Department',
        level: 1,
      },
    }),
    prisma.department.upsert({
      where: { code: 'ARCH' },
      update: {},
      create: {
        name: 'Architecture',
        nameAr: 'العمارة',
        code: 'ARCH',
        description: 'Architecture Department',
        level: 1,
      },
    }),
  ]);

  console.log('Created departments:', departments.length);

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@dr-emad-edu.com' },
    update: {},
    create: {
      name: 'System Administrator',
      email: 'admin@dr-emad-edu.com',
      password: adminPassword,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  await prisma.adminProfile.upsert({
    where: { userId: admin.id },
    update: {},
    create: {
      userId: admin.id,
      permissions: ['all'],
    },
  });

  console.log('Created admin user:', admin.email);

  // Create doctor user
  const doctorPassword = await bcrypt.hash('doctor123', 12);
  const doctor = await prisma.user.upsert({
    where: { email: 'doctor@dr-emad-edu.com' },
    update: {},
    create: {
      name: 'Dr. Emad Bayuome',
      email: 'doctor@dr-emad-edu.com',
      password: doctorPassword,
      role: UserRole.DOCTOR,
      status: UserStatus.ACTIVE,
    },
  });

  await prisma.doctorProfile.upsert({
    where: { userId: doctor.id },
    update: {},
    create: {
      userId: doctor.id,
      title: 'Professor',
      bio: 'Experienced professor with expertise in engineering education',
      specialties: ['Engineering', 'Education', 'Research'],
    },
  });

  console.log('Created doctor user:', doctor.email);

  // Create sample subjects
  const compDept = departments.find((d) => d.code === 'COMP');
  if (compDept) {
    const subjects = await Promise.all([
      prisma.subject.upsert({
        where: { code: 'CS101' },
        update: {},
        create: {
          name: 'Introduction to Computer Science',
          code: 'CS101',
          description: 'Fundamentals of computer science and programming',
          departmentId: compDept.id,
          academicYear: 1,
          semester: 1,
          doctorId: doctor.id,
        },
      }),
      prisma.subject.upsert({
        where: { code: 'CS201' },
        update: {},
        create: {
          name: 'Data Structures and Algorithms',
          code: 'CS201',
          description: 'Advanced data structures and algorithm design',
          departmentId: compDept.id,
          academicYear: 2,
          semester: 1,
          doctorId: doctor.id,
        },
      }),
      prisma.subject.upsert({
        where: { code: 'CS301' },
        update: {},
        create: {
          name: 'Database Systems',
          code: 'CS301',
          description: 'Database design and management systems',
          departmentId: compDept.id,
          academicYear: 3,
          semester: 1,
          doctorId: doctor.id,
        },
      }),
    ]);

    console.log('Created subjects:', subjects.length);
  }

  // Create role detection rules
  const roleRules = await Promise.all([
    prisma.roleRule.upsert({
      where: { id: '1' },
      update: {},
      create: {
        id: '1',
        pattern: 'admin',
        role: UserRole.ADMIN,
        priority: 100,
        isActive: true,
        description: 'Auto-assign admin role to emails containing "admin"',
      },
    }),
    prisma.roleRule.upsert({
      where: { id: '2' },
      update: {},
      create: {
        id: '2',
        pattern: 'doctor|dr\\.|prof',
        role: UserRole.DOCTOR,
        priority: 90,
        isActive: true,
        description: 'Auto-assign doctor role to emails containing doctor-related keywords',
      },
    }),
    prisma.roleRule.upsert({
      where: { id: '3' },
      update: {},
      create: {
        id: '3',
        pattern: '\\.edu$',
        role: UserRole.DOCTOR,
        priority: 80,
        isActive: true,
        description: 'Auto-assign doctor role to .edu email domains',
      },
    }),
  ]);

  console.log('Created role rules:', roleRules.length);

  // Create system config
  await prisma.systemConfig.upsert({
    where: { key: 'registration' },
    update: {},
    create: {
      key: 'registration',
      value: {
        enabled: true,
        requireApproval: true,
        allowedDomains: [],
      },
      description: 'Registration system settings',
    },
  });

  await prisma.systemConfig.upsert({
    where: { key: 'attendance' },
    update: {},
    create: {
      key: 'attendance',
      value: {
        enabled: true,
        defaultDuration: 60,
        allowMultipleDevices: false,
      },
      description: 'Attendance system settings',
    },
  });

  await prisma.systemConfig.upsert({
    where: { key: 'quiz' },
    update: {},
    create: {
      key: 'quiz',
      value: {
        enabled: true,
        defaultTimeLimit: 30,
        allowRetake: false,
        showCorrectAnswers: true,
      },
      description: 'Quiz system settings',
    },
  });

  console.log('Created system configs');

  console.log('Database seed completed successfully!');
  console.log('\nDefault credentials:');
  console.log('Admin: admin@dr-emad-edu.com / admin123');
  console.log('Doctor: doctor@dr-emad-edu.com / doctor123');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
