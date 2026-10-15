import { createHmac, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { eventTargets } from './controller.mjs';

export function verifySignature(body, signature, secret) {
  if (!secret || !/^sha256=[a-f0-9]{64}$/.test(signature ?? '')) return false;
  const expected = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
// Caller supplies the trusted execution context, never payload-selected policy/credentials.
export async function receive({ body, signature, secret, event, delivery, installationId, policy, run }) {
  if (body.length > 1024 * 1024 || !verifySignature(body, signature, secret)) throw Error('webhook-authentication');
  if (!/^[\w-]{1,100}$/.test(delivery ?? '')) throw Error('webhook-delivery');
  const payload = JSON.parse(body.toString('utf8'));
  if (String(payload.installation?.id) !== String(installationId)) throw Error('webhook-installation');
  const results = [];
  for (const target of eventTargets(event, payload, policy.repository, policy.base)) results.push(await run({ ...target, delivery, payload, event }));
  return results;
}
export function webhookServer(options) {
  let busy = false;
  return createServer(async (request, response) => {
    if (request.method !== 'POST' || request.url !== '/github' || busy) { response.writeHead(503).end(); return; }
    busy = true;
    try {
      let size = 0; const chunks = [];
      for await (const chunk of request) {
        size += chunk.length; if (size > 1024 * 1024) throw Error('request-too-large'); chunks.push(chunk);
      }
      await receive({ ...options, body: Buffer.concat(chunks), signature: request.headers['x-hub-signature-256'], event: request.headers['x-github-event'], delivery: request.headers['x-github-delivery'] });
      response.writeHead(200).end('recorded');
    } catch { response.writeHead(400).end('rejected; inspect trusted controller logs'); }
    finally { busy = false; }
  });
}
