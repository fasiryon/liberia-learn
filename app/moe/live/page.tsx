import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getLiveDashboardData } from "@/lib/moe/liveDashboard";
import LiveDashboardClient from "@/components/moe/LiveDashboardClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "LiberiaLearn — Live",
};

// The live display requires an authenticated MOE session. Signed display
// tokens are not accepted until a governed kiosk/display credential is
// separately approved.
export default async function MoeLivePage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string; isPlatformAdmin?: boolean } | null;
  const authorized =
    user?.role === "MOE_OFFICIAL" ||
    user?.role === "MOE_SUPER_ADMIN" ||
    user?.isPlatformAdmin === true;

  if (!authorized) {
    redirect("/moe/login");
  }

  // Fetch initial data server-side for zero-flicker first paint
  let initialData = null;
  try {
    initialData = await getLiveDashboardData();
  } catch {
    // Client will refetch
  }

  return (
    <LiveDashboardClient initialData={initialData} token={null} />
  );
}
