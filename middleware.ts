import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function clearSupabaseCookies(request: NextRequest) {
  const redirect = NextResponse.redirect(new URL("/login?session=expired", request.url));
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith("sb-") || cookie.name.includes("auth-token")) {
      redirect.cookies.set(cookie.name, "", { path: "/", maxAge: 0 });
    }
  }
  return redirect;
}

function clearSupabaseCookiesWithoutRedirect(request: NextRequest) {
  const response = NextResponse.next({ request });
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith("sb-") || cookie.name.includes("auth-token")) {
      response.cookies.set(cookie.name, "", { path: "/", maxAge: 0 });
    }
  }
  return response;
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  const isCrmArea = request.nextUrl.pathname.startsWith("/dashboard")
    || request.nextUrl.pathname.startsWith("/crm")
    || request.nextUrl.pathname.startsWith("/admin");
  const isTecnicoArea = request.nextUrl.pathname.startsWith("/tecnico") && !request.nextUrl.pathname.startsWith("/api/tecnico");
  const isProtected = isCrmArea || isTecnicoArea;
  const isLogin = request.nextUrl.pathname.startsWith("/login");
  const isCrmApi = request.nextUrl.pathname.startsWith("/api/crm");
  const isChangePassword = request.nextUrl.pathname.startsWith("/change-password");

  if (authError) {
    if (isCrmApi) return NextResponse.json({ ok: false, error: "Session expired" }, { status: 401 });

    // Critical: never redirect /login back to /login when the session is stale.
    // Clear invalid Supabase cookies in-place so the login page can render normally.
    if (isLogin) return clearSupabaseCookiesWithoutRedirect(request);

    if (isProtected || isChangePassword) return clearSupabaseCookies(request);
  }

  const mustChangePassword = Boolean(user?.user_metadata?.must_change_password);
  const isTechnicianAccount = user?.user_metadata?.app_role === "technician";

  if (isCrmApi && !user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (isProtected && !user) return NextResponse.redirect(new URL("/login", request.url));
  if (isProtected && mustChangePassword) return NextResponse.redirect(new URL("/change-password", request.url));
  if (isCrmArea && isTechnicianAccount) return NextResponse.redirect(new URL("/tecnico", request.url));
  if (isChangePassword && !user) return NextResponse.redirect(new URL("/login", request.url));
  if (isLogin && user) {
    if (mustChangePassword) return NextResponse.redirect(new URL("/change-password", request.url));
    return NextResponse.redirect(new URL(isTechnicianAccount ? "/tecnico" : "/dashboard", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/crm/:path*", "/admin/:path*", "/tecnico/:path*", "/login", "/change-password", "/api/crm/:path*"]
};
