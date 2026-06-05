import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getLiveDashboardData } from "@/lib/moe/liveDashboard";
import { verifyLiveToken } from "@/lib/moe/liveToken";
import LiveDashboardClient from "@/components/moe/LiveDashboardClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "LiberiaLearn — Live",
};

type Props = {
  searchParams: { token?: string };
};

export default async function MoeLivePage({ searchParams }: Props) {
  const token = searchParams.token ?? null;

  let authorized = false;

  if (token && verifyLiveToken(token)) {
    authorized = true;
  } else {
    const session = await getServerSession(authOptions);
    const user = session?.user as { role?: string; isPlatformAdmin?: boolean } | null;
    authorized =
      user?.role === "MOE_OFFICIAL" ||
      user?.role === "MOE_SUPER_ADMIN" ||
      user?.isPlatformAdmin === true;
  }

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
    <LiveDashboardClient initialData={initialData} token={token} />
  );
}
