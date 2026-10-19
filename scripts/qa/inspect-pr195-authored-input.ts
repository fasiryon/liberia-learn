import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {parseCandidateLessonV2} from '@/lib/curriculum/v2/parse';
import {sceneDeliverability} from '@/lib/curriculum/v2/deliverability';
const file = process.argv[2];
const bytes = fs.readFileSync(file);
const input = JSON.parse(bytes.toString());
const raw = input.resources.find((r: any) => r.payload?.kind === 'LESSON')?.payload.candidate;
let parsed;
let parseError;
try { parsed = parseCandidateLessonV2(raw); } catch (error: any) {parseError = {message: error.message, issues: error.issues ?? error.details};}
const assetChecks = input.assets.map((asset: any) => ({mediaId: asset.mediaId, bytes: Buffer.from(asset.bytesBase64, 'base64').length, hashMatches: createHash('sha256').update(Buffer.from(asset.bytesBase64, 'base64')).digest('hex') === asset.sha256, mimeType: asset.mimeType}));
const delivery = (parsed?.scenes ?? []).map(scene => sceneDeliverability(scene, null, false));
const result = {checkedAt: new Date().toISOString(), sourceId: input.source.contentId, inputSha256: createHash('sha256').update(bytes).digest('hex'), status: 'BLOCKED FOR ACADEMIC APPROVAL', artifactKind: 'AUTHORED_INPUT_NOT_IMMUTABLE_FACTORY_PACKAGE', cohortCommit: input.cohortCommit, state: input.state, approved: input.approved, released: input.released, published: input.published, parsed: !!parsed, parseError, scenes: raw?.scenes?.length, assetChecks, deliverability: delivery, labProposals: raw?.labProposals?.length};
fs.writeFileSync(`artifacts/pr195-review/${input.source.contentId}-input-review.json`, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
if (!parsed || assetChecks.some((asset: any) => !asset.hashMatches) || input.approved !== false || input.released !== false || input.published !== false) process.exitCode = 1;
