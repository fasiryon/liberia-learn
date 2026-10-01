import { describe, expect, it } from "vitest";
import { buildParametricGeometry, resolveGeometryVariant } from "@/lib/interactive-labs/v2/fidelity/geometry/builders";
import { pipeKit, generatorHousingKit } from "@/lib/interactive-labs/v2/fidelity/kits";
import { planLowBatches } from "@/lib/interactive-labs/v2/fidelity/lowBatch";
import { hydropowerDefinition } from "@/lib/interactive-labs/v2/definitions/hydropower";
import { initializeLab } from "@/lib/interactive-labs/v2/kernel";
import { buildRenderList, instructionalView } from "@/lib/interactive-labs/v2/fidelity/renderList";

describe("RX-005 shared parametric geometry", () => {
  it("builds a bounded deterministic lathe mesh for each 3D profile", () => {
    const descriptor = { kind: "lathe" as const, profile: [[0.4,-1],[0.7,0],[0.4,1]] as const };
    for (const profile of ["HIGH", "STANDARD", "LOW"] as const) {
      const a = buildParametricGeometry(descriptor, profile), b = buildParametricGeometry(descriptor, profile);
      expect(a.triangles).toBeGreaterThan(0);
      expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
    }
  });

  it("rejects malformed inputs and overlarge heightfield grids", () => {
    expect(() => buildParametricGeometry({ kind: "sweep", points: [[0,0,0],[0,0,0]], radius: 1 }, "LOW")).toThrow("duplicate_sweep_points");
    expect(() => buildParametricGeometry({ kind: "heightfield", rows: 17, columns: 2, size: [2,2], heights: Array(34).fill(0) }, "LOW")).toThrow("heightfield_dimensions");
    expect(() => buildParametricGeometry({ kind:"extrude", contour:[[0,0],[2,2],[0,2],[2,0]], depth:1 }, "LOW")).toThrow("self_intersecting_contour");
  });

  it("bounds scatter expansion and builds dimension-line ticks", () => {
    const transform={position:[0,0,0] as [number,number,number],rotation:[0,0,0] as [number,number,number],scale:[1,1,1] as [number,number,number]};
    expect(()=>buildParametricGeometry({kind:"scatter",seed:7,prototype:{kind:"lathe",profile:[[.1,0],[.1,1]]},transforms:Array(5000).fill(transform)},"LOW")).toThrow("scatter_vertex_bounds");
    expect(buildParametricGeometry({kind:"dimensionLine",start:[0,0,0],end:[2,0,0],ticks:4},"LOW").triangles).toBe(10);
  });

  it("requires all profile variants and a semantic 2D silhouette", () => {
    const kit = pipeKit({ id: "test-pipe", label: "Pipe", transform: { position:[0,0,0], rotation:[0,0,0], scale:[1,1,1] }, color:"#123456", points:[[0,0,0],[0,1,0]], radius:0.2 });
    expect(resolveGeometryVariant(kit.geometryVariants!, "FALLBACK_2D").silhouette.semanticLabel).toBe("Pipe");
    const housing = generatorHousingKit({ id:"test-generator",label:"Generator",transform:{position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]},color:"#123456",radius:1,height:2 });
    expect(housing.geometryVariants?.LOW.kind).toBe("lathe");
  });

  it("batches repeated opaque low-profile items while retaining individual identities", () => {
    const base = { id:"a",label:"part",kind:"component" as const,geometry:"box" as const,matrix:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1] as never,center:[0,0,0] as [number,number,number],color:"#123456",alpha:1,emissive:0,clip:null,highlighted:false,selectable:true,showLabel:true,inFocus:true };
    const plan = planLowBatches({ items:[base,{...base,id:"b"},{...base,id:"focused",highlighted:true}],flows:[],markers:[] });
    expect(plan.batches).toHaveLength(1);
    expect(plan.batches[0].itemIds).toEqual(["a","b"]);
    expect(plan.singles.map(item=>item.id)).toEqual(["focused"]);
    expect(plan.drawCalls).toBe(2);
  });

  it("keeps Mount Coffee profile-equivalent and uses daylight plus shared kits", () => {
    expect(hydropowerDefinition.fidelity?.environment).toBe("DAYLIGHT");
    const state=initializeLab(hydropowerDefinition);
    const lists=(["HIGH","STANDARD","LOW","FALLBACK_2D"] as const).map(profile=>buildRenderList({definition:hydropowerDefinition,state,profile}));
    expect(lists.every(list=>JSON.stringify(instructionalView(list))===JSON.stringify(instructionalView(lists[0])))).toBe(true);
    expect(lists[0].items.find(item=>item.id==="penstock-1")?.parametricGeometry?.kind).toBe("sweep");
    expect(lists[3].items.find(item=>item.id==="penstock-1")?.fallbackSilhouette?.kind).toBe("polygon");
  });
});
