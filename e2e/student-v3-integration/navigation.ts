import { useSyncExternalStore } from "react";
const subscribe = (callback: () => void) => { window.addEventListener("popstate", callback); return () => window.removeEventListener("popstate", callback); };
export const usePathname = () => useSyncExternalStore(subscribe, () => window.location.pathname);
export const useSearchParams = () => new URLSearchParams(window.location.search);
export function navigate(href: string) { history.pushState({}, "", href); window.dispatchEvent(new PopStateEvent("popstate")); }
const router = { push: navigate, replace: (href: string) => { history.replaceState({}, "", href); window.dispatchEvent(new PopStateEvent("popstate")); } };
export const useRouter = () => router;
export const useParams = () => ({ contentId: decodeURIComponent(window.location.pathname.split("/").at(-1) ?? "") });
