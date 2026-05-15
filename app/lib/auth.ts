import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { db } from './db';
import { isDoctorEmail } from './role-rules';

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60,
      },
    },
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          const user = await db.user.findUnique({
            where: { email: credentials.email.toLowerCase() },
            include: { student: true },
          });

          if (!user || !user.password) return null;
          if (user.status === 'SUSPENDED') throw new Error('Account suspended');
          if (user.status === 'REJECTED') throw new Error('Account rejected');

          const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
          if (!isPasswordValid) return null;

          db.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date(), loginCount: { increment: 1 } },
          }).catch(() => {});

          db.loginHistory.create({
            data: { userId: user.id, status: 'SUCCESS' },
          }).catch(() => {});

          // Only store minimal data in token - never store base64 images
          const image = user.image?.startsWith('data:') ? null : user.image;
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image,
            role: user.role,
            status: user.status,
            studentId: user.student?.id ?? null,
            hasStudent: !!user.student,
          } as any;
        } catch (err: any) {
          if (err.message === 'Account suspended' || err.message === 'Account rejected') {
            throw err;
          }
          console.error('Auth error:', err);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        const email = user.email!;
        const normalizedEmail = email.toLowerCase();
        const doctorByWhitelist = isDoctorEmail(normalizedEmail);

        let dbUser = await db.user.findUnique({
          where: { email: normalizedEmail },
          include: { student: true },
        });

        if (!dbUser) {
          dbUser = await db.user.create({
            data: {
              email: normalizedEmail,
              name: user.name || email.split('@')[0],
              image: user.image,
              role: doctorByWhitelist ? 'DOCTOR' : 'STUDENT',
              status: doctorByWhitelist ? 'ACTIVE' : 'PENDING',
            },
            include: { student: true },
          });
        } else {
          if (doctorByWhitelist && dbUser.role !== 'DOCTOR') {
            await db.user.update({
              where: { id: dbUser.id },
              data: { role: 'DOCTOR', status: 'ACTIVE' },
            });
            dbUser.role = 'DOCTOR';
            dbUser.status = 'ACTIVE';
          }

          // Always reset to PENDING if no student record (re-registration case)
          // But don't override REJECTED or SUSPENDED status
          if (!dbUser.student && dbUser.role === 'STUDENT' && dbUser.status !== 'REJECTED' && dbUser.status !== 'SUSPENDED') {
            await db.user.update({
              where: { id: dbUser.id },
              data: { status: 'PENDING' },
            });
            dbUser.status = 'PENDING';
          }

          // Block suspended users from logging in via Google too
          if (dbUser.status === 'SUSPENDED') {
            throw new Error('Account suspended');
          }
          if (user.image && dbUser.image !== user.image) {
            await db.user.update({
              where: { id: dbUser.id },
              data: { image: user.image },
            });
          }
        }

        // Store minimal data only
        (user as any).id = dbUser.id;
        (user as any).role = dbUser.role;
        (user as any).studentId = dbUser.student?.id ?? null;
        (user as any).hasStudent = !!dbUser.student;

        // For students: status depends on whether they have a student record
        // Doctors/Admins always use their DB status
        if (dbUser.role === 'STUDENT') {
          if (!dbUser.student) {
            // No student record = must complete profile, force PENDING
            (user as any).status = 'PENDING';
          } else {
            // Has student record, use actual DB status
            (user as any).status = dbUser.status;
          }
        } else {
          (user as any).status = dbUser.status;
        }

        return true;
      }
      return true;
    },

    async jwt({ token, user, trigger }) {
      // First sign-in: populate token from signIn callback data
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.status = (user as any).status;
        token.studentId = (user as any).studentId ?? null;
        token.hasStudent = (user as any).hasStudent ?? false;
        // Token is fresh from signIn - no DB query needed
        return token;
      }

      // No token id = empty/invalid token
      if (!token.id) return token;

      // Manual refresh triggered by update() call (e.g. after complete-profile or approval check)
      if (trigger === 'update') {
        const dbUser = await db.user.findUnique({
          where: { id: token.id as string },
          include: { student: true },
        });
        if (!dbUser) return {} as any;
        token.role = dbUser.role;
        token.studentId = dbUser.student?.id ?? null;
        token.hasStudent = !!dbUser.student;
        token.status = (dbUser.role === 'STUDENT' && !dbUser.student)
          ? 'PENDING'
          : dbUser.status;
        return token;
      }

      // Periodic sync on every request - keeps token in sync with DB
      const dbUser = await db.user.findUnique({
        where: { id: token.id as string },
        include: { student: true },
      });
      if (!dbUser) return {} as any;

      token.role = dbUser.role;
      token.studentId = dbUser.student?.id ?? null;
      token.hasStudent = !!dbUser.student;
      token.status = (dbUser.role === 'STUDENT' && !dbUser.student)
        ? 'PENDING'
        : dbUser.status;

      return token;
    },

    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.status = token.status as string;
        // Keep student as minimal object for middleware checks
        session.user.student = token.hasStudent
          ? { id: token.studentId as string } as any
          : null;
      }
      return session;
    },
  },
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}
