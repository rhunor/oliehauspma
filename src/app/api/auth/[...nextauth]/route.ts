// src/app/api/auth/[...nextauth]/route.ts
// This file handles the NextAuth.js authentication routes
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };