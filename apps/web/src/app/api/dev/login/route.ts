import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@baby-atlas/db";

/**
 * Local development only: signs in as DEV_LOGIN_EMAIL without a magic link.
 * Creates the user if needed and a database session, the same shape
 * NextAuth's database strategy uses, then sets the session cookie.
 * Returns 404 outside `next dev` or when DEV_LOGIN_EMAIL is not set.
 */
export async function GET(request: Request) {
  // ?as=someone@example.com signs in as another local user, to test sharing
  const as = new URL(request.url).searchParams.get("as");
  const email = as ?? process.env.DEV_LOGIN_EMAIL;
  if (process.env.NODE_ENV !== "development" || !process.env.DEV_LOGIN_EMAIL || !email) {
    return new NextResponse(null, { status: 404 });
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, emailVerified: new Date() },
  });

  const sessionToken = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await prisma.session.create({ data: { sessionToken, userId: user.id, expires } });

  const requested = new URL(request.url).searchParams.get("callbackUrl");
  const target = requested?.startsWith("/") && !requested.startsWith("//") ? requested : "/dashboard";
  const response = NextResponse.redirect(new URL(target, request.url));
  // Plain http on localhost, so NextAuth uses the unprefixed cookie name
  response.cookies.set("authjs.session-token", sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires,
  });
  return response;
}
