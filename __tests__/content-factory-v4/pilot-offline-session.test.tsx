// @vitest-environment jsdom
import {act} from "react";
import {createRoot} from "react-dom/client";
import {afterEach,it,expect,vi} from "vitest";
const state=vi.hoisted(()=>({integrity:true}));
vi.mock("@/components/learner-experience/LessonPlayerV2",()=>({LessonPlayerV2:({sceneAttachments}:{sceneAttachments:unknown})=><button data-map={Boolean(sceneAttachments)}>Practice</button>}));
vi.mock("@/lib/curriculum/v4/previewOffline",async original=>({...await original<typeof import("@/lib/curriculum/v4/previewOffline")>(),verifyMemoryContent:async()=>state.integrity}));
import {LearningPreviewPlayer} from "@/components/learner-experience/LearningPreviewPlayer";
import {LESSON_EXPERIENCES,HYDROPOWER_EXPERIENCE_ID} from "@/lib/learner-experience/fixtures/hydropowerLesson";
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();state.integrity=true;});
async function fixture() {
  (globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
  vi.useFakeTimers();
  vi.spyOn(document,"hidden","get").mockReturnValue(false);
  const online=vi.spyOn(navigator,"onLine","get").mockReturnValue(false);
  const selection="factory@4.0.0-draft.6@g7-math-area-perimeter",packageHash="a".repeat(64),expiresAt=new Date(Date.now()+120000).toISOString();
  const authorization={mode:"MEMORY_ONLY" as const,issuedAt:new Date().toISOString(),validUntil:new Date(Date.now()+60000).toISOString(),maxAgeSeconds:60};
  const fetcher=vi.fn().mockResolvedValue({ok:false,status:404});vi.stubGlobal("fetch",fetcher);
  const host=document.createElement("div");document.body.appendChild(host);const root=createRoot(host);
  await act(async()=>root.render(<LearningPreviewPlayer selection={selection} packageHash={packageHash} expiresAt={expiresAt} experience={LESSON_EXPERIENCES[HYDROPOWER_EXPERIENCE_ID].experience} initialOfflineAuthorization={authorization} offlineIntegritySha256={"b".repeat(64)}/>));
  return {host,root,online,fetcher,dispose:async()=>{await act(async()=>root.unmount());host.remove();}};
}
it("continues a previously authorized open lesson offline, then discards it at lease expiry",async()=>{
  const f=await fixture();try {
    expect(f.host.querySelector("button")).not.toBeNull();expect(f.host.textContent).toContain("Offline access ends");expect(f.fetcher).not.toHaveBeenCalled();
    expect(f.host.querySelector(".ll-pilot-banner")?.className).not.toContain("sticky");
    await act(async()=>vi.advanceTimersByTimeAsync(60000));
    expect(f.host.querySelector("button")).toBeNull();expect(f.host.textContent).toContain("no longer available");
  }finally{await f.dispose();}
});
it("blocks on reconnect and immediately discards content after server revocation",async()=>{
  const f=await fixture();try {
    f.online.mockReturnValue(true);await act(async()=>window.dispatchEvent(new Event("online")));
    expect(f.fetcher).toHaveBeenCalledOnce();expect(f.host.querySelector("button")).toBeNull();expect(f.host.textContent).toContain("no longer available");
  }finally{await f.dispose();}
});
it("never mounts tampered cached content, even after a later successful heartbeat",async()=>{
  state.integrity=false;const f=await fixture();try {
    f.online.mockReturnValue(true);await act(async()=>window.dispatchEvent(new Event("online")));await act(async()=>vi.advanceTimersByTimeAsync(4000));
    expect(f.host.querySelector("button")).toBeNull();expect(f.fetcher).not.toHaveBeenCalled();
  }finally{await f.dispose();}
});
