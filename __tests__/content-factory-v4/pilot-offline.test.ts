import {describe,it,expect} from "vitest";
import {webcrypto,createHash} from "node:crypto";
import {memoryLease,memoryLeaseValid,verifyMemoryContent} from "@/lib/curriculum/v4/previewOffline";
import {canonicalizeJson} from "@/lib/curriculum/provenance/hash";

const now=Date.parse("2026-10-26T12:00:00Z"),end="2026-10-26T13:00:00Z";
const authorization={mode:"MEMORY_ONLY",issuedAt:new Date(now).toISOString(),validUntil:new Date(now+60000).toISOString(),maxAgeSeconds:60};
describe("bounded offline authorization",()=>{
  it("expires at the earlier wall/monotonic deadline and rejects clock rollback",()=>{
    const lease=memoryLease(authorization,end,now,500);
    expect(lease).not.toBeNull();
    expect(memoryLeaseValid(lease,now+59999,60499)).toBe(true);
    expect(memoryLeaseValid(lease,now+60000,60500)).toBe(false);
    expect(memoryLeaseValid(lease,now+1,60500)).toBe(false);
    expect(memoryLeaseValid(lease,now-2000,501)).toBe(false);
    expect(memoryLeaseValid(lease,now+1,499)).toBe(false);
  });
  it.each([{maxAgeSeconds:1801},{maxAgeSeconds:0},{maxAgeSeconds:"60"},{mode:"PERSISTENT"},{issuedAt:new Date(now+6000).toISOString()},{validUntil:new Date(now+61000).toISOString()},{validUntil:end},{validUntil:"invalid"}])("rejects invalid lease %j",change=>{
    expect(memoryLease({...authorization,...change},end,now,500)).toBeNull();
  });
  it("caps the lease at the finite pilot window",()=>{
    expect(memoryLease(authorization,new Date(now+30000).toISOString(),now,500)).toBeNull();
  });
  it("verifies cached lesson and geographic asset data using the server's canonical digest",async()=>{
    Object.defineProperty(globalThis,"crypto",{value:webcrypto,configurable:true});
    const data={experience:{id:"pilot:exact",scenes:[]},sceneAttachments:{map:[]},geography:{counties:[{name:"Bong",path:"M0 0L1 1"}]}};
    const expected=createHash("sha256").update(canonicalizeJson(data)).digest("hex");
    expect(await verifyMemoryContent(data,expected)).toBe(true);
    expect(await verifyMemoryContent({...data,experience:{...data.experience,id:"different"}},expected)).toBe(false);
    expect(await verifyMemoryContent({...data,geography:{counties:[]}},expected)).toBe(false);
    expect(await verifyMemoryContent(data,"untrusted-digest")).toBe(false);
  });
});
