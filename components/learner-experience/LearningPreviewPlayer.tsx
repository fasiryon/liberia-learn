"use client";

import { useEffect, useState } from "react";
import { LessonPlayerV2 } from "./LessonPlayerV2";
import type { LessonExperience } from "@/lib/learner-experience/types";
import type { GeoSceneAttachment } from "@/lib/learner-experience/geography/draft6Binding";
import geography from "@/lib/learner-experience/geography/liberia-adm1-2021.json";
import { memoryLease,memoryLeaseValid,verifyMemoryContent,type MemoryLease,type OfflineAuthorization } from "@/lib/curriculum/v4/previewOffline";

const NO_ATTACHMENTS:Readonly<Record<string,readonly GeoSceneAttachment[]>>={};
export function LearningPreviewPlayer({ selection, packageHash, expiresAt, experience, sceneAttachments=NO_ATTACHMENTS, initialOfflineAuthorization=null,offlineIntegritySha256=null }: {
  selection:string;packageHash:string;expiresAt:string;experience:LessonExperience;
  sceneAttachments?:Readonly<Record<string,readonly GeoSceneAttachment[]>>;
  initialOfflineAuthorization?:OfflineAuthorization|null;offlineIntegritySha256?:string|null;
}) {
  const [access,setAccess]=useState<"VERIFYING"|"ADMITTED"|"OFFLINE"|"DENIED">("VERIFYING");
  const [mounted,setMounted]=useState(false),[offlineUntil,setOfflineUntil]=useState<string|null>(null);
  useEffect(()=>{
    let cancelled=false,inFlight=false,hadAuthorization=false,reconnectPending=false,integrityVerified=false;
    let integrityPending=Boolean(initialOfflineAuthorization),integrityRejected=false;
    let lease:MemoryLease|null=null,leaseTimer:number|undefined;
    const controllers=new Set<AbortController>();
    const deny=()=>{lease=null;hadAuthorization=false;setAccess("DENIED");setMounted(false);setOfflineUntil(null);};
    const installLease=(raw:unknown)=>{
      window.clearTimeout(leaseTimer);
      lease=integrityVerified?memoryLease(raw,expiresAt,Date.now(),performance.now()):null;
      setOfflineUntil(lease?new Date(lease.deadline).toISOString():null);
      if(lease) leaseTimer=window.setTimeout(()=>{if(!cancelled)deny();},lease.durationMs);
    };
    const offline=()=>{
      if(hadAuthorization&&!reconnectPending&&memoryLeaseValid(lease,Date.now(),performance.now())) {setMounted(true);setAccess("OFFLINE");}
      else setAccess("VERIFYING");
    };
    const check=async()=>{
      if(cancelled||integrityPending||integrityRejected) return;
      if(Date.now()>=Date.parse(expiresAt)){deny();return;}
      if(document.hidden){setAccess("VERIFYING");return;}
      if(!navigator.onLine){offline();return;}
      if(inFlight)return;
      inFlight=true;
      const controller=new AbortController();controllers.add(controller);
      const timeout=window.setTimeout(()=>{if(!cancelled)offline();controller.abort();},2500);
      try {
        const response=await fetch(`/api/student/learning-preview/${encodeURIComponent(selection)}?accessOnly=1`,{credentials:"same-origin",cache:"no-store",signal:controller.signal});
        if(!response.ok&&![404,401,403].includes(response.status))throw Error("temporary_access_failure");
        const data=response.ok?await response.json():null;
        if(cancelled)return;
        if(!response.ok||data?.status!=="PILOT_ONLY"||data.identity?.selection!==selection||data.identity?.packageHash!==packageHash||data.expiresAt!==expiresAt||Date.now()>=Date.parse(expiresAt)){deny();return;}
        hadAuthorization=true;reconnectPending=false;installLease(data.offlineAuthorization);
        if(!document.hidden&&navigator.onLine){setMounted(true);setAccess("ADMITTED");}else if(!document.hidden)offline();else setAccess("VERIFYING");
      } catch {if(!cancelled)offline();}
      finally {window.clearTimeout(timeout);controllers.delete(controller);inFlight=false;}
    };
    const initial=async()=>{
      if(initialOfflineAuthorization&&!offlineIntegritySha256){integrityPending=false;integrityRejected=true;deny();return;}
      if(initialOfflineAuthorization&&offlineIntegritySha256){
        try {integrityVerified=await verifyMemoryContent({experience,sceneAttachments,geography:Object.keys(sceneAttachments).length?geography:null},offlineIntegritySha256);}
        catch {integrityVerified=false;}
        if(cancelled)return;
        integrityPending=false;
        if(!integrityVerified){integrityRejected=true;deny();return;}
        hadAuthorization=true;installLease(initialOfflineAuthorization);
      }
      await check();
    };
    void initial();
    const timer=window.setInterval(()=>void check(),2000);
    const expiry=window.setTimeout(()=>{if(!cancelled)deny();},Math.max(0,Date.parse(expiresAt)-Date.now()));
    const disconnected=()=>void check();
    const reconnected=()=>{reconnectPending=true;setAccess("VERIFYING");void check();};
    const visible=()=>{if(!document.hidden&&navigator.onLine)reconnected();else void check();};
    window.addEventListener("offline",disconnected);window.addEventListener("online",reconnected);window.addEventListener("pageshow",visible);document.addEventListener("visibilitychange",visible);
    return()=>{cancelled=true;window.clearInterval(timer);window.clearTimeout(expiry);window.clearTimeout(leaseTimer);controllers.forEach(c=>c.abort());window.removeEventListener("offline",disconnected);window.removeEventListener("online",reconnected);window.removeEventListener("pageshow",visible);document.removeEventListener("visibilitychange",visible);};
  },[selection,packageHash,expiresAt,experience,sceneAttachments,initialOfflineAuthorization,offlineIntegritySha256]);
  const visible=access==="ADMITTED"||access==="OFFLINE";
  return <>
    <div role="status" className="ll-pilot-banner border-b border-amber-400 bg-amber-100 px-4 py-3 text-center font-semibold text-slate-950">
      {"Pilot lesson \u2014 not graded"}
      {access==="OFFLINE"&&offlineUntil&&<p className="mt-1 text-sm font-normal">Offline access ends at {new Date(offlineUntil).toLocaleTimeString()}. Reconnect to check continued access.</p>}
    </div>
    {!visible&&<p role={access==="DENIED"?"alert":"status"} className="p-6 text-center">{access==="DENIED"?"Pilot access is no longer available.":"Verifying pilot access. Reconnect to continue."}</p>}
    {mounted&&<div hidden={!visible} ref={node=>{if(node)node.inert=!visible;}}><LessonPlayerV2 experience={experience} toolsByScene={{}} exitHref={`/learn/day?at=${encodeURIComponent(selection)}`} finishHref={`/learn/day?after=${encodeURIComponent(selection)}`} returnSceneId={null} progressStorage="MEMORY" sceneAttachments={sceneAttachments}/></div>}
  </>;
}
