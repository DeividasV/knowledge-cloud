import { signOut } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  await signOut({ redirectTo: "/login" });
  return NextResponse.redirect(new URL("/login", "http://localhost:44258"));
}
