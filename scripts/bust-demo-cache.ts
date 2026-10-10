/**
 * Bust Redis cache for student1@cha.edu.lr so timetable changes show immediately.
 */
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;
import { PrismaClient } from "@prisma/client";
import { Redis } from "@upstash/redis";

const p = new PrismaClient();

(async () => {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) { console.log("No Redis env vars — cache will expire naturally (300s TTL)"); return; }

  const redis = new Redis({ url, token });

  const user = await p.user.findFirst({ where: { email: "student1@cha.edu.lr" }, select: { id: true } });
  if (!user) { console.log("user not found"); return; }
  const student = await p.student.findFirst({ where: { userId: user.id }, select: { id: true } });
  if (!student) { console.log("student not found"); return; }

  // Today keys are addressed by user, school and enrollment-scope fingerprint (see
  // app/api/student/today/route.ts), so match every scope and legacy namespace for this learner.
  const patterns = [`cache:today:*${user.id}*`, `cache:timetable:*${student.id}*`, `cache:student-meta:${user.id}`];
  for (const pattern of patterns) {
    let cursor: string | number = 0;
    do {
      const [next, keys] = await redis.scan(cursor, { match: pattern, count: 200 });
      cursor = next;
      for (const key of keys) console.log(`DEL ${key} → ${await redis.del(key)}`);
    } while (String(cursor) !== "0");
  }

  console.log("✅ Cache busted for student1@cha.edu.lr");
  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
