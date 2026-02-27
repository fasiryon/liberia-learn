import { LIBERIAN_COUNTIES } from "@/lib/counties";

export const GEO_COUNTIES = [...LIBERIAN_COUNTIES] as const;

export type GeoCounty = (typeof GEO_COUNTIES)[number];
