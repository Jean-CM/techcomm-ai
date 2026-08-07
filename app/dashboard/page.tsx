import { redirect } from "next/navigation";

// The old "initiatives" tracker lived here from an earlier, unrelated
// version of this project. It showed no real data and added confusion, so
// /dashboard now just sends people straight to the real operational tool.
export default function DashboardPage() {
  redirect("/crm");
}
