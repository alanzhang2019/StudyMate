import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { db } from "./lib/db"
import bcrypt from "bcryptjs"

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
        
        if (passwordsMatch) return { id: user.id, email: user.email }
        return null
      }
    })
  ],
  pages: {
    signIn: "/auth/login",
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub
      }
      return session
    }
  }
})