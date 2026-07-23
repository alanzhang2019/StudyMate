import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { db } from "./lib/db"
import bcrypt from "bcryptjs"

// NextAuth config.
//
// `authorize` looks up the user by email, verifies the bcrypt
// hash, and returns the basic profile (id, email, name, role).
// `role` is one of: 'student' (direct-login student account
// for /csp-lecture), 'parent' (legacy parent account with
// student_profiles children), or 'admin' (backstage).
//
// The `jwt` callback hoists name + role from the authorize()
// return into the token so they survive subsequent requests
// without another DB hit. The DB read in `authorize` is the
// only place we touch the users table per login.
//
// The `session` callback copies the token's id/name/role onto
// session.user so server components and API routes can read
// them via `auth()`. We deliberately do NOT expose the bcrypt
// passwordHash on the session — only fields the client needs.
//
// Backward compat: if the user row has no `name` or `role`
// (older accounts predating the schema migration), we default
// role to 'parent' so login still works and the user lands
// on /select-profile like before.
//
// Type-safety note: NextAuth's User type only declares
// id/email/name/image by default. We extend it via the
// `as any` cast below to carry a custom `role` field — a
// module-augmentation file would be cleaner but adds another
// file for one extra field. If a future refactor adds more
// custom fields, switch to a `types/next-auth.d.ts`.

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const email = (credentials.email as string).toLowerCase()
        const user = await db.user.findUnique({
          where: { email }
        })

        if (!user) return null

        const passwordsMatch = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        )

        if (!passwordsMatch) return null

        return {
          id: user.id,
          email: user.email,
          name: (user as any).name ?? null,
          // Carry role through authorize()'s User type. We use a
          // typed cast so the rest of the file can read it
          // without `as any` gymnastics at every call site.
          role: ((user as any).role ?? 'parent') as 'student' | 'parent' | 'admin',
        } as any
      }
    })
  ],
  pages: {
    signIn: "/auth/login",
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // On initial sign-in `user` is set; copy fields onto the
      // token. On subsequent requests `user` is undefined and
      // the token already carries the values, so we skip.
      if (user) {
        token.sub = (user as any).id ?? token.sub
        if ((user as any).name) token.name = (user as any).name
        if ((user as any).role) (token as any).role = (user as any).role
      }
      // Support client-triggered session updates (e.g. user
      // edited their profile). We just re-emit whatever the
      // client sent.
      if (trigger === 'update' && session) {
        if ((session as any).name) token.name = (session as any).name
        if ((session as any).role) (token as any).role = (session as any).role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub
        // Project the token's name/role onto session.user.
        // Both are nullable for backward compat with older
        // tokens that didn't have them.
        if ((token as any).name) (session.user as any).name = (token as any).name
        if ((token as any).role) (session.user as any).role = (token as any).role
      }
      return session
    }
  }
})
