import { lazy, Suspense, type ComponentType, type ReactNode } from "react";
type Loaded = ComponentType<any> | { default: ComponentType<any> };
// Like next/dynamic, the loader may resolve to a module with a default export or to the component itself.
export default function dynamic(loader: () => Promise<Loaded>, options?: { loading?: () => ReactNode }) {
  const Component = lazy(() => loader().then((m) => ({ default: "default" in m ? m.default : m })));
  return function Loaded(props: any) { return <Suspense fallback={options?.loading ? options.loading() : <p>Loading tool…</p>}><Component {...props} /></Suspense>; };
}
