import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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

  const { data: { user } } = await supabase.auth.getUser();
  const isCrmArea = request.nextUrl.pathname.startsWith("/dashboard")
    || request.nextUrl.pathname.startsWith("/crm")
    || request.nextUrl.pathname.startsWith("/admin");
  const isTecnicoArea = request.nextUrl.pathname.startsWith("/tecnico") && !request.nextUrl.pathname.startsWith("/api/tecnico");
  const isProtected = isCrmArea || isTecnicoArea;
  const isLogin = request.nextUrl.pathname.startsWith("/login");
  const isCrmApi = request.nextUrl.pathname.startsWith("/api/crm");
  const isChangePassword = request.nextUrl.pathname.startsWith("/change-password");
  const mustChangePassword = Boolean(user?.user_metadata?.must_change_password);
  const isTechnicianAccount = user?.user_metadata?.app_role === "technician";

  if (isCrmApi && !user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
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
