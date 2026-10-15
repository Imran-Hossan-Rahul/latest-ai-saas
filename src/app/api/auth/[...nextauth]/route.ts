// NextAuth configuration.
// Two providers:
//   1. Google OAuth — for quick sign-in
//   2. Credentials — email + bcrypt password for users who prefer email/password
//
// The Prisma adapter handles session persistence and account linking automatically.

import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import type { SessionUser } from "@/types";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const authOptions: NextAuthOptions = {
  // Cast needed because @auth/prisma-adapter and next-auth v4 have a minor
  // type mismatch on the Adapter interface — functionally compatible.
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],

  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });

        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    // Attach the DB user id to the JWT so we can use it in server components
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        (session.user as SessionUser).id = token.id as string;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/error",
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
