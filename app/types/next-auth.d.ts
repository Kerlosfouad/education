import NextAuth, { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: string;
      status: string;
      student?: any;
      doctorProfile?: any;
      adminProfile?: any;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    role: string;
    status: string;
    student?: any;
    doctorProfile?: any;
    adminProfile?: any;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
    status: string;
    studentId?: string | null;
    hasStudent?: boolean;
    student?: any;
    doctorProfile?: any;
    adminProfile?: any;
  }
}
