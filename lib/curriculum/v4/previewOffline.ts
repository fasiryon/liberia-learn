/** Browser-safe memory-cache checks. No persistence, fetches or academic state. */
export type OfflineAuthorization = {mode:"MEMORY_ONLY";issuedAt:string;validUntil:string;maxAgeSeconds:number};
export type MemoryLease = {wallStart:number;monotonicStart:number;deadline:number;durationMs:number};
export function memoryLease(raw:unknown,pilotEnd:string,wallNow:number,monotonicNow:number):MemoryLease|null {
  if(!raw||typeof raw!=="object"||!Number.isFinite(wallNow)||!Number.isFinite(monotonicNow)) return null;
  const value=raw as Partial<OfflineAuthorization>, issued=Date.parse(value.issuedAt??""), until=Date.parse(value.validUntil??""), end=Date.parse(pilotEnd);
  if(value.mode!=="MEMORY_ONLY"||!Number.isInteger(value.maxAgeSeconds)||value.maxAgeSeconds!<60||value.maxAgeSeconds!>1800||
    !Number.isFinite(issued)||!Number.isFinite(until)||!Number.isFinite(end)||issued>wallNow+5000||until<=wallNow||until>end||until-issued>value.maxAgeSeconds!*1000||until<=issued) return null;
  return {wallStart:wallNow,monotonicStart:monotonicNow,deadline:until,durationMs:Math.min(until-wallNow,value.maxAgeSeconds!*1000)};
}
export function memoryLeaseValid(lease:MemoryLease|null,wallNow:number,monotonicNow:number) {
  return Boolean(lease&&Number.isFinite(wallNow)&&Number.isFinite(monotonicNow)&&wallNow>=lease.wallStart-1000&&wallNow<lease.deadline&&monotonicNow>=lease.monotonicStart&&monotonicNow-lease.monotonicStart<lease.durationMs);
}
function canonical(value:unknown):unknown {
  if(value===null||typeof value==="string"||typeof value==="boolean") return value;
  if(typeof value==="number"&&Number.isFinite(value)) return Object.is(value,-0)?0:value;
  if(Array.isArray(value)) return value.map(canonical);
  if(value&&typeof value==="object") return Object.fromEntries(Object.keys(value).sort().filter(key=>(value as Record<string,unknown>)[key]!==undefined).map(key=>[key,canonical((value as Record<string,unknown>)[key])]));
  throw Error("invalid_preview_cache_value");
}
export async function verifyMemoryContent(value:unknown,expected:string) {
  if(!/^[a-f0-9]{64}$/.test(expected)||!globalThis.crypto?.subtle) return false;
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(canonical(value))));
  return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,"0")).join("")===expected;
}
