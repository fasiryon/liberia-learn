// Signed synthetic sessions for the existing local review tools. No application auth bypass.
const { encode } = require('next-auth/jwt');
function assertLocalReview(baseUrl, env = process.env) {
  const url = new URL(baseUrl);
  if (env.NODE_ENV === 'production' || env.VERCEL || env.LAB_REVIEW_HARNESS !== '1' || !env.NEXTAUTH_SECRET || url.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/' || url.search || url.hash || url.username || url.password) throw new Error('A configured local development review harness is required');
  if (env.NEXTAUTH_URL && new URL(env.NEXTAUTH_URL).origin !== url.origin) throw new Error('Review origin must match NEXTAUTH_URL');
}
async function createLocalReviewerToken(baseUrl, env = process.env) {
  assertLocalReview(baseUrl, env);
  // Current session contract (U1/R1): authTime and credStamp are required at the edge, and assertTokenFresh matches them
  // against the synthetic row that prepare-review-consent seeds ONLY into the loopback /lab_review_fixture database.
  // credStamp 0 = credentialStampOf(a row whose passwordChangedAt is null).
  return encode({ secret: env.NEXTAUTH_SECRET, token: { id: 'synthetic-MOE_OFFICIAL', name: 'Synthetic lab reviewer', email: 'synthetic@example.invalid',
    role: 'MOE_OFFICIAL', isPlatformAdmin: false, schoolId: null, authTime: Date.now(), credStamp: 0 }, maxAge: 3600 });
}
module.exports = { assertLocalReview, createLocalReviewerToken };
if (require.main === module) createLocalReviewerToken(process.env.NEXTAUTH_URL ?? 'http://localhost:3000').then(token => process.stdout.write(`next-auth.session-token=${token}`)).catch(error => { console.error(error.message); process.exitCode = 1; });
