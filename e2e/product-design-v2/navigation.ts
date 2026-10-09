export const usePathname = () => window.location.pathname;
export const useRouter = () => ({ push: (href: string) => window.location.assign(href) });
