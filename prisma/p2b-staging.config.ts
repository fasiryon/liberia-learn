import { defineConfig } from "prisma/config";

const url = process.env.P2A_STAGING_DATABASE_URL;
if (!url) throw new Error("P2A_STAGING_DATABASE_URL is required");

export default defineConfig({
  schema: "canonical/schema.prisma",
  datasource: { url },
});
