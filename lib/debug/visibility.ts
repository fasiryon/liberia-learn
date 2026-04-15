import { isDemo, isDevelopment } from "@/lib/environment";

type ViewerRole =
  | "ADMIN"
  | "TEACHER"
  | "STUDENT"
  | "GUARDIAN"
  | "MOE_OFFICIAL"
  | string
  | null
  | undefined;

export function shouldShowDemoCredentials(viewerRole?: ViewerRole): boolean {
  if (isDemo()) {
    return true;
  }

  return isDevelopment() && viewerRole === "ADMIN";
}

export function shouldShowAdminDebugUi(viewerRole?: ViewerRole): boolean {
  return isDevelopment() && viewerRole === "ADMIN";
}
