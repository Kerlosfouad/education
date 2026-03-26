import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { db } from './db';

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
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

        let dbUser = await db.user.findUnique({
          where: { email },
          include: { student: true },
        });

        if (!dbUser) {
          dbUser = await db.user.create({
            data: {
              email,
              name: user.name || email.split('@')[0],
              image: user.image,
              role: 'STUDENT',
              status: 'PENDING',
            },
            include: { student: true },
          });
        } else {
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
        (user as any).status = dbUser.status;
        (user as any).studentId = dbUser.student?.id ?? null;
        (user as any).hasStudent = !!dbUser.student;

        return true;
      }
      return true;
    },

    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.status = (user as any).status;
        token.studentId = (user as any).studentId ?? null;
        token.hasStudent = (user as any).hasStudent ?? false;
      }

      // Manual session refresh
      if (trigger === 'update' && token.email) {
        const dbUser = await db.user.findUnique({
          where: { email: token.email as string },
          include: { student: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.status = dbUser.status;
          token.studentId = dbUser.student?.id ?? null;
          token.hasStudent = !!dbUser.student;
        }
      }

      // Auto-refresh when PENDING to catch approval
      if (token.status === 'PENDING' && token.email && !user) {
        const dbUser = await db.user.findUnique({
          where: { email: token.email as string },
          include: { student: true },
        });
        if (dbUser && dbUser.status !== 'PENDING') {
          token.status = dbUser.status;
          token.role = dbUser.role;
          token.studentId = dbUser.student?.id ?? null;
          token.hasStudent = !!dbUser.student;
        }
      }

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
