import { defineConfig } from "prisma/config";

const url = process.env.P2A_STAGING_DATABASE_URL?.trim();
if (!url) throw new Error("P2A_STAGING_DATABASE_URL is required");

export default defineConfig({
  schema: "schema.prisma",
  datasource: { url },
});
