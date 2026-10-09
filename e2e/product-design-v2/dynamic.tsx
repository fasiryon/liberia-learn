import { lazy, Suspense, type ComponentType } from "react";
export default function dynamic(loader: () => Promise<{ default: ComponentType<any> }>) {
  const Component = lazy(loader);
  return function Loaded(props: any) { return <Suspense fallback={<p>Loading tool…</p>}><Component {...props} /></Suspense>; };
}
