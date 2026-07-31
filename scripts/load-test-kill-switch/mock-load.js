/**
 * k6 script for exercising scripts/load-test-kill-switch/supervisor.ts against
 * scripts/load-test-kill-switch/mock-server.ts. Deliberately much longer than
 * any expected detect+abort time (supervisor should kill this well before
 * natural completion in a breach test, and let it run to completion in a
 * healthy-mode control test).
 *
 * BASE_URL defaults to the local mock server.
 */
import http from "k6/http"
import { sleep } from "k6"

const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:4999"

export const options = {
  vus: 20,
  duration: __ENV.LOAD_DURATION || "5m",
}

export default function () {
  http.get(`${BASE_URL}/`)
  sleep(0.2)
}
