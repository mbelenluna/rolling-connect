import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';
import { sendWelcomeEmail, sendInterpreterWelcomeEmail } from './email';

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

const googleProviderConfig = {
  clientId: googleClientId!,
  clientSecret: googleClientSecret!,
  authorization: { params: { prompt: 'consent' } },
};

export const authOptions: NextAuthOptions = {
  providers: [
    ...(googleClientId && googleClientSecret
      ? [
          GoogleProvider({ ...googleProviderConfig, id: 'google-client' }),
          GoogleProvider({ ...googleProviderConfig, id: 'google-interpreter' }),
        ]
      : []),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({ where: { email: credentials.email } });
        if (!user) return null;
        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      const isGoogle = account?.provider === 'google-client' || account?.provider === 'google-interpreter';
      if (isGoogle) {
        const email = user.email;
        if (!email) return false;

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
          if (existing.role !== 'client' && existing.role !== 'interpreter') {
            return '/login?error=GoogleSignInClientOnly';
          }
          return true;
        }

        const isInterpreter = account.provider === 'google-interpreter';
        const role = isInterpreter ? 'interpreter' : 'client';
        const name = user.name ?? email.split('@')[0];

        const passwordHash = await bcrypt.hash(
          `oauth_${Math.random().toString(36).slice(2)}_${Date.now()}`,
          10
        );
        const newUser = await prisma.user.create({
          data: {
            email,
            passwordHash,
            name,
            role,
          },
        });

        if (isInterpreter) {
          await prisma.interpreterProfile.create({
            data: {
              userId: newUser.id,
              languagePairs: [],
              specialties: [],
            },
          });
          await prisma.interpreterAvailability.create({
            data: { userId: newUser.id, status: 'offline' },
          });
          sendInterpreterWelcomeEmail(email, name).catch((e) => console.error('Interpreter welcome email failed:', e));
        } else {
          const org = await prisma.organization.create({
            data: {
              name: `${newUser.name}'s Organization`,
              billingEmail: email,
            },
          });
          await prisma.organizationMember.create({
            data: { organizationId: org.id, userId: newUser.id, role: 'owner' },
          });
          sendWelcomeEmail(email, newUser.name).catch((e) => console.error('Welcome email failed:', e));
        }
        return true;
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user && account?.provider === 'credentials') {
        token.id = (user as { id?: string }).id;
        token.role = (user as { role?: string }).role;
      }
      if ((account?.provider === 'google-client' || account?.provider === 'google-interpreter') && token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email as string },
        });
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  debug: process.env.NEXTAUTH_DEBUG === '1',
  session: { strategy: 'jwt', maxAge: 24 * 60 * 60 },
  secret: process.env.NEXTAUTH_SECRET,
};
