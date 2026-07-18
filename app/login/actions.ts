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

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?error=Credenciales%20inválidas");

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient().catch(() => null);
  if (supabase) await supabase.auth.signOut();
  redirect("/login");
}
