/**
 * Ensures DATABASE_URL/DIRECT_URL are loaded locally for Prisma.
 * Vercel sets env vars automatically in production.
 */
import path from "path";

const isVercel = !!process.env.VERCEL;
const hasDb = !!process.env.DATABASE_URL;

if (!isVercel && !hasDb) {
  // Only load dotenv locally when DATABASE_URL is missing.
  // This prevents messing with production env.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dotenv = require("dotenv");
  const envLocal = path.resolve(process.cwd(), ".env.local");
  dotenv.config({ path: envLocal });
}
