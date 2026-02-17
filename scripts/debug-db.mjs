import "dotenv/config";
import { PrismaClient } from "@prisma/client";

function safeParse(name, v) {
  if (!v) return { name, present: false };
  try {
    const u = new URL(v);
    const user = decodeURIComponent(u.username || "");
    return { name, present: true, host: u.hostname, port: u.port, user, db: u.pathname.replace("/", ""), query: u.searchParams.toString() };
  } catch {
    return { name, present: true, note: "not a valid URL" };
  }
}

console.log("NODE_ENV=", process.env.NODE_ENV);
console.log("DATABASE_URL=", safeParse("DATABASE_URL", process.env.DATABASE_URL));
console.log("DIRECT_URL  =", safeParse("DIRECT_URL", process.env.DIRECT_URL));

const prisma = new PrismaClient();
try {
  const r = await prisma.$queryRaw`select 1 as ok`;
  console.log("QUERY_OK:", r);
} catch (e) {
  console.error("QUERY_FAIL:", e?.message || e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
