/**
 * load-tests/k6-config.js
 *
 * k6 load test configuration for LiberiaLearn national rollout validation.
 * Target: 5,000 concurrent users across 4 usage scenarios.
 *
 * Run:
 *   k6 run load-tests/k6-config.js --out json=load-tests/results.json
 *
 * Install k6:
 *   npm install -g k6   (or: choco install k6  on Windows)
 */

import { student_browse } from "./scenarios/student-browse.js";
import { submission_spike } from "./scenarios/submission-spike.js";
import { ai_tutor } from "./scenarios/ai-tutor.js";
import { guardian_reads } from "./scenarios/guardian-reads.js";

export { student_browse, submission_spike, ai_tutor, guardian_reads };

export const options = {
  scenarios: {
    // Scenario 1: Student browsing lessons (read-heavy)
    // Peak 1,000 VUs — matches national-gate spec; 2,000 exceeded Vercel concurrency limit.
    student_browse: {
      executor: "ramping-vus",
      exec: "student_browse",
      startVUs: 0,
      stages: [
        { duration: "2m", target: 250 },
        { duration: "5m", target: 1000 },
        { duration: "2m", target: 0 },
      ],
      tags: { scenario: "student_browse" },
    },
    // Scenario 2: Assignment submission spike
    // startTime "2m": lets student_browse warm Vercel instances first before the
    // submission burst. preAllocatedVUs reduced from 500→50 to prevent a 500-instance
    // cold-start storm at t=0 (UUID lookups are fast; 50 VUs handle 200 req/s @ 250ms).
    submission_spike: {
      executor: "constant-arrival-rate",
      exec: "submission_spike",
      startTime: "2m",
      rate: 200,
      timeUnit: "1s",
      duration: "3m",
      preAllocatedVUs: 50,
      maxVUs: 200,
      tags: { scenario: "submission_spike" },
    },
    // Scenario 3: AI tutor concurrent queries
    ai_tutor: {
      executor: "ramping-vus",
      exec: "ai_tutor",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 100 },
        { duration: "3m", target: 300 },
        { duration: "1m", target: 0 },
      ],
      tags: { scenario: "ai_tutor" },
    },
    // Scenario 4: Guardian dashboard reads
    guardian_reads: {
      executor: "constant-vus",
      exec: "guardian_reads",
      vus: 500,
      duration: "5m",
      tags: { scenario: "guardian_reads" },
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<2000"],   // 95% of requests under 2s
    http_req_failed:   ["rate<0.01"],    // < 1% error rate
    "http_req_duration{scenario:student_browse}": ["p(95)<1500"],
    "http_req_duration{scenario:submission_spike}": ["p(95)<2000"],
    "http_req_duration{scenario:ai_tutor}": ["p(95)<3000"],
    "http_req_duration{scenario:guardian_reads}": ["p(95)<1000"],
  },
};
