import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/server/auth/constants";

/**
 * Proxy (ex-middleware en Next 16).
 *
 * Il ne fait QUE de la redirection optimiste : présence d'un cookie. Aucune
 * requête en base, aucun contrôle de permission — la doc Next 16 est explicite
 * sur ce point, et un cookie peut être périmé ou forgé.
 *
 * La vérification réelle a lieu dans les layouts (`requireSession`) et dans
 * chaque action serveur.
 */
export function proxy(request: NextRequest) {
  const hasSessionCookie = Boolean(
    request.cookies.get(SESSION_COOKIE)?.value,
  );

  if (!hasSessionCookie) {
    const loginUrl = new URL("/login", request.url);
    if (request.nextUrl.pathname !== "/admin/index") {
      loginUrl.searchParams.set("next", request.nextUrl.pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
