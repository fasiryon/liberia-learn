// RX-005 A8 capture assertion: identify a script that carries three.js, so LOW and FALLBACK_2D captures can prove
// they never fetched it. Dev chunks keep module paths; minified chunks keep three's own "THREE.WebGLRenderer"
// diagnostics, which no LiberiaLearn module contains.
const THREE_URL = /node_modules[_/]three[_/]|[_/]three\.(module|core|cjs)/i;
const THREE_BODY = /node_modules\/three\/build\/three|THREE\.WebGLRenderer[:.]/;

export function isThreeChunk(url: string, body: string): boolean {
  return THREE_URL.test(url) || THREE_BODY.test(body);
}
