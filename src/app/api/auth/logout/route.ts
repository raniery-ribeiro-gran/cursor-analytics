import { NextResponse } from "next/server";
import {
  clearImpersonatorCookieOptions,
  clearSessionCookieOptions,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(clearSessionCookieOptions());
  response.cookies.set(clearImpersonatorCookieOptions());
  return response;
}
