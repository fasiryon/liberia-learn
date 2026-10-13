export const usePathname = () => window.location.pathname;
// Stable like Next's router: client effects may list it as a dependency.
const router = { push: (href: string) => window.location.assign(href), replace: (href: string) => window.location.replace(href) };
export const useRouter = () => router;
export const useSearchParams = () => new URLSearchParams(window.location.search);
/** Dynamic segments for the student lesson routes the harness mounts. */
export const useParams = () => {
  const lesson = window.location.pathname.match(/^\/student\/lesson\/([^/]+)$/);
  return lesson ? { contentId: decodeURIComponent(lesson[1]) } : {};
};
