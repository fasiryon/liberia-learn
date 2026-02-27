import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { resolveAppRedirect } from "@/lib/appHub";

export default async function AppHubPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!user?.id) {
    redirect("/login?next=/app");
  }

  const destination = resolveAppRedirect({
    id: user.id,
    email: user.email ?? null,
    name: user.name ?? null,
    role: user.role ?? "STUDENT",
    schoolId: user.schoolId ?? null,
    isPlatformAdmin: user.isPlatformAdmin ?? false,
  });

  redirect(destination);
}
