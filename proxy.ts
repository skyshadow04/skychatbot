import { NextResponse, type NextRequest } from "next/server";
import { isValidSession, SESSION_COOKIE } from "./lib/auth";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/login" || pathname === "/api/auth/login" || pathname === "/api/auth/logout") {
    return NextResponse.next();
  }

  if (isValidSession(request.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return Response.json({ error: "Please sign in to use Skychat." }, { status: 401 });
  }

  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
