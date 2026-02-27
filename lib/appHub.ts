import type { SessionUser } from "@/lib/auth";

export function resolveAppRedirect(user: SessionUser): string {
  if (user.isPlatformAdmin || user.role === "DISTRICT_ADMIN") return "/platform";
  switch (user.role) {
    case "ADMIN":
      return "/admin";
    case "TEACHER":
      return "/teacher";
    case "GUARDIAN":
      return "/guardian";
    default:
      return "/dashboard";
  }
}
