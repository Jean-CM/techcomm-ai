"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const CONFIG_ERROR =
  "Supabase no está configurado en Vercel. Agrega NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY y vuelve a desplegar.";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) redirect("/login?error=Completa%20correo%20y%20contraseña");

  const supabase = await createClient().catch(() => null);
  if (!supabase) redirect(`/login?error=${encodeURIComponent(CONFIG_ERROR)}`);

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?error=Credenciales%20inválidas");

  if (data.user?.user_metadata?.must_change_password) redirect("/change-password");
  redirect("/dashboard");
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) redirect("/change-password?error=La%20contraseña%20debe%20tener%20al%20menos%208%20caracteres");
  if (password !== confirm) redirect("/change-password?error=Las%20contraseñas%20no%20coinciden");

  const supabase = await createClient().catch(() => null);
  if (!supabase) redirect(`/change-password?error=${encodeURIComponent(CONFIG_ERROR)}`);

  const { error } = await supabase.auth.updateUser({
    password,
    data: { must_change_password: false }
  });
  if (error) redirect(`/change-password?error=${encodeURIComponent(error.message)}`);

  redirect("/dashboard");
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) redirect("/forgot-password?error=Ingresa%20tu%20correo");

  const supabase = await createClient().catch(() => null);
  if (!supabase) redirect(`/forgot-password?error=${encodeURIComponent(CONFIG_ERROR)}`);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${appUrl}/auth/callback` });
  // Always show the same confirmation, whether or not the email exists —
  // this avoids leaking which addresses have accounts.
  redirect("/forgot-password?sent=1");
}

export async function signOut() {
  const supabase = await createClient().catch(() => null);
  if (supabase) await supabase.auth.signOut();
  redirect("/login");
}
