import { redirect } from "next/navigation";
import { requireOrgRole } from "@/lib/require-org-role";

export default async function HealthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const auth = await requireOrgRole(["owner", "admin"]);
  if (auth.error) {
    redirect(auth.error.status === 401 ? "/login" : "/crm");
  }

  return children;
}
