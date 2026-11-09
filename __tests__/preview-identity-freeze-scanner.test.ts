/**
 * Preview identity freeze completeness, Revision 3 (T2 P1 scanner finding). The 5daefe7c detector accepted any
 * route containing the string `previewIdentityFrozen(`. The replacement (helpers/identityFreezeScanner.ts) is
 * syntax-aware and per HTTP handler; these cases are its detector regressions:
 *  - T2's seven escaping forms (completeness-mutations.cjs) plus its ordinary-writer control must all be rejected;
 *  - further adversarial forms (aliases, re-exports, export *, default and dynamic imports, nested writes,
 *    wrapped handlers, guards in branches, after the body, before authority, or a look-alike local function);
 *  - correctly guarded protected and public handlers pass;
 *  - the real app/ and lib/ tree has no offender and no unreviewed unknown shape.
 */
import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { scanIdentityFreeze } from "./helpers/identityFreezeScanner";
import { PREVIEW_PUBLIC_IDENTITY_ENTRY_POINTS } from "@/lib/preview/identityFreeze";

const FREEZE = 'import {previewIdentityFrozen} from "@/lib/preview/identityFreeze";\n';
const AUTH = 'import {requireRole} from "@/lib/auth";\n';
const GUARD = "const frozen=previewIdentityFrozen(); if(frozen) return frozen;";
const FREEZE_LIB = "export function previewIdentityFrozen(){return null;}";

function scan(files: Record<string, string>, publicRoutes: string[] = []) {
  const tree = { "lib/preview/identityFreeze.ts": FREEZE_LIB, ...files };
  return scanIdentityFreeze({ files: Object.keys(tree), read: p => tree[p as keyof typeof tree] }, publicRoutes);
}
const ROUTE = "app/api/new-entry/route.ts";
const offenders = (files: Record<string, string>, publicRoutes?: string[]) =>
  scan(files, publicRoutes).offenders.filter(o => o.file === ROUTE).map(o => `${o.handler}:${o.code}`);

describe("T2's adversarial completeness cases are rejected", () => {
  const cases: Array<[string, Record<string, string>]> = [
    ["ordinary-direct-writer", { [ROUTE]: "export async function POST(){return prisma.user.create({data:payload});}" }],
    ["whitespace-in-property-call", { [ROUTE]: "export async function POST(){return prisma.user .create ({data:payload});}" }],
    ["computed-model-property", { [ROUTE]: 'export async function POST(){return prisma["user"].create({data:payload});}' }],
    ["arrow-export-provisioner", {
      [ROUTE]: 'import {provision} from "@/lib/provision"; export async function POST(){return provision(payload);}',
      "lib/provision.ts": "export const provision = async (payload) => prisma.user.create({data:payload});",
    }],
    ["namespace-import-provisioner", {
      [ROUTE]: 'import * as identities from "@/lib/provision"; export async function POST(){return identities.provision(payload);}',
      "lib/provision.ts": "export async function provision(payload){return prisma.user.create({data:payload});}",
    }],
    ["cross-file-helper-provisioner", {
      [ROUTE]: 'import {provision} from "@/lib/provision"; export async function POST(){return provision(payload);}',
      "lib/provision.ts": 'import {child} from "@/lib/child";\nexport async function provision(payload){return child(payload);}',
      "lib/child.ts": "export async function child(payload){return prisma.user.create({data:payload});}",
    }],
    ["guard-in-comment-only", { [ROUTE]: "// previewIdentityFrozen(\nexport async function POST(){return prisma.user.create({data:payload});}" }],
    ["guard-only-in-other-handler", {
      [ROUTE]: FREEZE + `export async function GET(){${GUARD} return null;}\nexport async function POST(){return prisma.user.create({data:payload});}`,
    }],
  ];
  it.each(cases)("%s is an offender", (_name, files) => {
    expect(offenders(files)).toEqual(["POST:MISSING_DOMINATING_GUARD"]);
  });
});

describe("further adversarial forms", () => {
  const writer = "export async function make(p){return tx.inviteToken.create({data:p});}";
  it.each([
    ["aliased import", { [ROUTE]: 'import {make as m} from "@/lib/p"; export async function POST(){return m(1);}', "lib/p.ts": writer }],
    ["re-export chain", { [ROUTE]: 'import {make} from "@/lib/barrel"; export async function POST(){return make(1);}', "lib/barrel.ts": 'export {make} from "./p";', "lib/p.ts": writer }],
    ["export star", { [ROUTE]: 'import {make} from "@/lib/barrel"; export async function POST(){return make(1);}', "lib/barrel.ts": 'export * from "./p";', "lib/p.ts": writer }],
    ["default import", { [ROUTE]: 'import make from "@/lib/p"; export async function POST(){return make(1);}', "lib/p.ts": "export default async function(p){return prisma.user.upsert({where:{},create:p,update:p});}" }],
    ["literal dynamic import", { [ROUTE]: 'export async function POST(){const x=await import("@/lib/p"); return x.make(1);}', "lib/p.ts": writer }],
    ["callback reference", { [ROUTE]: 'import {make} from "@/lib/p"; export async function POST(){return [1].map(make);}', "lib/p.ts": writer }],
    ["nested password write", { [ROUTE]: "export async function POST(){return prisma.student.create({data:{user:{create:{hashedPwd:h}}}});}" }],
    ["privilege update", { [ROUTE]: "export async function POST(){return prisma.user.update({where:{id},data:{isPlatformAdmin:true}});}" }],
    ["transfer token", { [ROUTE]: "export async function POST(){return prisma.$transaction(tx=>tx.platformTransferToken.create({data}));}" }],
    ["MFA credential removal", { [ROUTE]: "export async function POST(){return prisma.privilegedMfaCredential.deleteMany({where});}" }],
    ["wrapped arrow handler", { [ROUTE]: "export const POST = withTrace(async (req) => prisma.user.create({data}));" }],
    ["re-exported handler", { [ROUTE]: 'export {handler as POST} from "@/lib/h";', "lib/h.ts": "export async function handler(){return prisma.user.create({data});}" }],
    ["local look-alike freeze", { [ROUTE]: `function previewIdentityFrozen(){return null;}\nexport async function POST(){${GUARD} return prisma.user.create({data});}` }],
    ["freeze from another module", { [ROUTE]: `import {previewIdentityFrozen} from "@/lib/other";\nexport async function POST(){${GUARD} return prisma.user.create({data});}`, "lib/other.ts": FREEZE_LIB }],
  ])("%s is an offender", (_name, files) => {
    expect(offenders(files as Record<string, string>)).toEqual(["POST:MISSING_DOMINATING_GUARD"]);
  });
  it.each([
    ["guard inside a branch", FREEZE + `export async function POST(req){if(req.headers.get("x")){${GUARD}} return prisma.user.create({data});}`],
    ["guard without return", FREEZE + "export async function POST(){const frozen=previewIdentityFrozen(); return prisma.user.create({data});}"],
  ])("%s is an unsupported placement (fails closed)", (_n, src) => {
    expect(offenders({ [ROUTE]: src })).toEqual(["POST:UNSUPPORTED_GUARD_PLACEMENT"]);
  });
  it("a guard after the body read is an offender", () => {
    expect(offenders({ [ROUTE]: FREEZE + AUTH + `export async function POST(req){const u=await requireRole("ADMIN"); const b=await req.json(); ${GUARD} return prisma.user.create({data:b});}` }))
      .toEqual(["POST:BODY_READ_BEFORE_GUARD"]);
  });
  it("a guard after the write is an offender", () => {
    expect(offenders({ [ROUTE]: FREEZE + AUTH + `export async function POST(req){await requireRole("ADMIN"); await prisma.user.create({data}); ${GUARD} return null;}` }))
      .toEqual(["POST:WRITE_BEFORE_GUARD"]);
  });
  it("a protected handler guarded before its authority is an offender", () => {
    expect(offenders({ [ROUTE]: FREEZE + AUTH + `export async function POST(req){${GUARD} await requireRole("ADMIN"); return prisma.user.create({data});}` }))
      .toEqual(["POST:GUARD_BEFORE_AUTHORITY"]);
  });
  it("unknown shapes require explicit review", () => {
    const r = scan({
      [ROUTE]: "export async function POST(){await prisma[model].create({data}); await prisma.user.update({where,data:payload}); return import(name);}",
    });
    expect(r.review.map(x => x.code).sort()).toEqual(["UNKNOWN_COMPUTED_MODEL_WRITE", "UNKNOWN_DYNAMIC_IMPORT", "UNKNOWN_USER_UPDATE_DATA"]);
  });
});

describe("correct placements pass", () => {
  it("protected: authority (direct or via a local helper), then the guard, then body and writes", () => {
    for (const src of [
      FREEZE + AUTH + `export async function POST(req){try{const u=await requireRole("ADMIN"); ${GUARD} const b=await req.json(); return prisma.user.create({data:b});}catch(e){return null;}}`,
      FREEZE + AUTH + `async function requireSchoolAdmin(){return requireRole("ADMIN");}\nexport async function PATCH(req){const u=await requireSchoolAdmin(); ${GUARD} return prisma.user.create({data:await req.json()});}`,
      'import * as freeze from "@/lib/preview/identityFreeze";\n' + AUTH + 'export async function POST(){await requireRole("ADMIN"); const f=freeze.previewIdentityFrozen(); if(f){return f;} return prisma.user.create({data});}',
    ])
      expect(offenders({ [ROUTE]: src })).toEqual([]);
  });
  it("public entry point: guard first, no authority required", () => {
    expect(offenders({ [ROUTE]: FREEZE + `export async function POST(req){${GUARD} return prisma.user.create({data:await req.json()});}` }, [ROUTE])).toEqual([]);
  });
  it("a non-provisioning handler needs no guard", () => {
    expect(offenders({ [ROUTE]: "export async function POST(){return prisma.user.update({where,data:{name:'x'}});}" })).toEqual([]);
  });
});

describe("real source tree", () => {
  const root = process.cwd();
  const walk = (d: string): string[] =>
    fs.readdirSync(path.join(root, d), { withFileTypes: true }).flatMap(e =>
      e.isDirectory() ? (["node_modules", "__tests__"].includes(e.name) ? [] : walk(`${d}/${e.name}`)) : [`${d}/${e.name}`]);
  let result: ReturnType<typeof scanIdentityFreeze>;
  beforeAll(() => {
    const files = [...walk("app"), ...walk("lib")].filter(f => /\.tsx?$/.test(f));
    result = scanIdentityFreeze(
      { files, read: p => fs.readFileSync(path.join(root, p), "utf8") },
      PREVIEW_PUBLIC_IDENTITY_ENTRY_POINTS,
      {
        "app/api/auth/[...nextauth]/route.ts#GET:UNRESOLVED_HANDLER_EXPORT":
          "NextAuth(authOptions) handler object; its provisioning callbacks are the reviewed non-propagating lib/auth.ts#authOptions",
        "app/api/auth/[...nextauth]/route.ts#POST:UNRESOLVED_HANDLER_EXPORT":
          "NextAuth(authOptions) handler object; its provisioning callbacks are the reviewed non-propagating lib/auth.ts#authOptions",
        "app/api/admin/guardian-link/route.ts#POST:UNKNOWN_USER_UPDATE_DATA":
          "guardian account upsert with a computed data object; the handler is frozen after authority (scanner case below)",
      },
      {
        "lib/auth.ts#authOptions":
          "NextAuth callbacks (Google invite provisioning, invite consumption); reachable only through app/api/auth/[...nextauth], credentials-only Preview, hosted provider check CREDENTIALS_ONLY_PROVIDER",
      }
    );
  }, 180_000);

  it("RED: no provisioning handler lacks a correctly ordered freeze", () => {
    expect(result.offenders).toEqual([]);
  });
  it("no unreviewed unknown shape", () => {
    expect(result.review).toEqual([]);
  });
  it("non-vacuous: the known entry points, including Revision 3 additions, are detected", () => {
    for (const known of [
      "app/api/admin/interoperability/oneroster/import/route.ts POST", "app/api/admin/students/route.ts POST",
      "app/api/admin/guardian-link/route.ts POST", "app/api/enroll/route.ts POST", "app/api/admin/school/route.ts PATCH",
      "app/api/platform/security/accept/route.ts POST", "app/api/platform/security/transfer/route.ts POST",
      "app/api/student/change-pin/route.ts POST", "app/api/teacher/change-password/route.ts PATCH",
      "app/api/guardian/link/route.ts POST", "app/api/admin/security/mfa/recovery/reset/route.ts POST",
    ])
      expect(result.provisioningHandlers).toContain(known);
    expect(result.nonPropagatingProvisioners).toEqual(["lib/auth#authOptions"]);
  });
});

/**
 * Atlas ATLAS-T1-REVISION-3-VERDICT-20261103: three independently reproduced false-clean results at e13c53cc
 * (t1-r3-independent.cjs, verbatim sources below) plus neighbouring forms. Each must be an offender or a REVIEW item,
 * never an empty clean result; the two Atlas controls must stay as they were.
 */
describe("Atlas Revision 3 reproductions (verbatim) and neighbouring forms", () => {
  const AROUTE = "app/api/independent/route.ts";
  const IMPORTS = 'import {previewIdentityFrozen} from "@/lib/preview/identityFreeze"; import {requireRole} from "@/lib/auth";';
  const AGUARD = "const frozen=previewIdentityFrozen(); if(frozen) return frozen;";
  const ascan = (source: string, extra: Record<string, string> = {}) => scan({ [AROUTE]: source, ...extra });
  const refusedOrReviewed = (source: string, extra?: Record<string, string>) => {
    const r = ascan(source, extra);
    return r.offenders.length + r.review.length > 0;
  };
  it("control: ordinary unguarded identity writer is refused", () => {
    expect(refusedOrReviewed("export async function POST(){return prisma.user.create({data:payload});}")).toBe(true);
  });
  it("control: direct awaited authority and dominating guard are accepted", () => {
    const r = ascan(IMPORTS + `export async function POST(){await requireRole('ADMIN'); ${AGUARD} return prisma.user.create({data:payload});}`);
    expect(r.offenders).toEqual([]);
    expect(r.review).toEqual([]);
  });
  it("RED (Atlas 1): a delegate alias does not silently escape the inventory", () => {
    const r = ascan("export async function POST(){const users=prisma.user; return users.create({data:payload});}");
    expect(r.provisioningHandlers).toEqual([`${AROUTE} POST`]);
    expect(r.offenders.map(o => o.code)).toEqual(["MISSING_DOMINATING_GUARD"]);
  });
  it.each([
    ["destructured delegate", "export async function POST(){const {user}=prisma; return user.create({data});}"],
    ["renamed destructured delegate", "export async function POST(){const {inviteToken:inv}=tx; return inv.create({data});}"],
    ["assigned delegate", "export async function POST(){let d; d=prisma.platformTransferToken; return d.create({data});}"],
    ["element-access alias", 'export async function POST(){const u=prisma["user"]; return u.upsert({where,create:data,update:data});}'],
  ])("RED: %s is a provisioning offender", (_n, source) => {
    expect(ascan(source).offenders.map(o => o.code)).toEqual(["MISSING_DOMINATING_GUARD"]);
  });
  it.each([
    ["delegate passed to a helper", "export async function POST(){return make(prisma.user, data);}"],
    ["delegate returned", "export function users(){return prisma.user;}"],
    ["delegate stored in an object", "export const repo={users: prisma.inviteToken};"],
    ["computed alias", "export async function POST(){const u=prisma[name]; return u.create({data});}"],
  ])("RED: %s requires explicit review", (_n, source) => {
    expect(ascan(source).review.map(x => x.code)).toContain("IDENTITY_DELEGATE_UNRESOLVED");
  });
  it("RED (Atlas 2): merely referring to requireRole does not establish prior authentication", () => {
    const r = ascan(IMPORTS + `export async function POST(){const unused=requireRole; ${AGUARD} return prisma.user.create({data:payload});}`);
    expect(r.offenders.map(o => o.code)).toEqual(["GUARD_BEFORE_AUTHORITY"]);
  });
  it.each([
    ["un-awaited authority call", `export async function POST(){requireRole('ADMIN'); ${AGUARD} return prisma.user.create({data});}`],
    ["authority inside a branch", `export async function POST(req){if(req.headers.get('x')){await requireRole('ADMIN');} ${AGUARD} return prisma.user.create({data});}`],
    ["authority in a try whose catch falls through", `export async function POST(){try{await requireRole('ADMIN');}catch{} ${AGUARD} return prisma.user.create({data});}`],
    ["helper that only references authority", `const check=()=>requireRole; export async function POST(){await check(); ${AGUARD} return prisma.user.create({data});}`],
    ["helper that swallows the authority failure", `async function check(){try{await requireRole('ADMIN');}catch{return null;}} export async function POST(){await check(); ${AGUARD} return prisma.user.create({data});}`],
  ])("RED: %s is not authority", (_n, source) => {
    expect(ascan(IMPORTS + source).offenders.map(o => o.code)).toEqual(["GUARD_BEFORE_AUTHORITY"]);
  });
  it("getServerSession alone is not authority (it returns null instead of throwing)", () => {
    const src = 'import {previewIdentityFrozen} from "@/lib/preview/identityFreeze"; import {getServerSession} from "next-auth";' +
      `export async function POST(){const s=await getServerSession(); ${AGUARD} return prisma.user.create({data});}`;
    expect(ascan(src).offenders.map(o => o.code)).toEqual(["GUARD_BEFORE_AUTHORITY"]);
  });
  it("a helper whose awaited authority call dominates and whose catch rethrows is authority", () => {
    const src = IMPORTS + `async function check(){try{const u=await requireRole('ADMIN'); return u;}catch(e){throw e;}} export async function POST(){await check(); ${AGUARD} return prisma.user.create({data});}`;
    expect(ascan(src).offenders).toEqual([]);
  });
  it("RED (Atlas 3): a guard in a try with a swallowed earlier failure does not dominate the later write", () => {
    const r = ascan(IMPORTS + `export async function POST(){await requireRole('ADMIN'); try{await mayThrow(); ${AGUARD}}catch{} return prisma.user.create({data:payload});}`);
    expect(r.offenders.map(o => o.code)).toEqual(["UNSUPPORTED_GUARD_PLACEMENT"]);
  });
  it.each([
    ["catch that logs and falls through", `try{await requireRole('ADMIN'); ${AGUARD} await other();}catch(e){log(e);} return prisma.user.create({data});`],
    ["finally that returns", `try{await requireRole('ADMIN'); ${AGUARD}}finally{return prisma.user.create({data});}`],
    ["catch whose branch falls through", `try{await requireRole('ADMIN'); ${AGUARD}}catch(e){if(e.status)return e;} return prisma.user.create({data});`],
  ])("RED: %s is unsupported placement", (_n, body) => {
    expect(ascan(IMPORTS + `export async function POST(){${body}}`).offenders.map(o => o.code)).toEqual(["UNSUPPORTED_GUARD_PLACEMENT"]);
  });
  it("a try whose catch always returns or throws keeps dominance (the repository pattern)", () => {
    for (const handler of [
      `try{await requireRole('ADMIN'); ${AGUARD} return prisma.user.create({data});}catch(e){return respond(e);}`,
      `try{await requireRole('ADMIN'); ${AGUARD}}catch(e){if(e.status){return respond(e);} else {throw e;}} return prisma.user.create({data});`,
    ])
      expect(ascan(IMPORTS + `export async function POST(){${handler}}`).offenders).toEqual([]);
  });
  it("RED: an exported HTTP handler that cannot be resolved requires review", () => {
    const r = ascan('import {handlers} from "some-package"; export const POST = handlers.POST;');
    expect(r.review.map(x => x.code)).toContain("UNRESOLVED_HANDLER_EXPORT");
  });
});

/**
 * Atlas ATLAS-T1-REVISION-3-REPAIR-VERDICT-20261103: three further false-clean forms at 0aaa7a9c (verbatim helper
 * and alias sources below) plus neighbours. Each must be an offender or REVIEW, never clean.
 */
describe("Atlas repair-verdict reproductions: helper return paths and alias reassignment", () => {
  const AROUTE = "app/api/independent/route.ts";
  const IMPORTS = 'import {previewIdentityFrozen} from "@/lib/preview/identityFreeze"; import {requireRole} from "@/lib/auth";';
  const AGUARD = "const frozen=previewIdentityFrozen(); if(frozen) return frozen;";
  const handler = `export async function POST(){await authority(); ${AGUARD} return prisma.user.create({data:payload});}`;
  const ascan = (source: string) => scan({ [AROUTE]: source });
  const codes = (source: string) => ascan(source).offenders.map(o => o.code);
  it("RED (Atlas 1): a helper that can return before authenticating is not authority", () => {
    expect(codes(IMPORTS + "async function authority(){ if (skip) return null; await requireRole('ADMIN'); }\n" + handler)).toEqual(["GUARD_BEFORE_AUTHORITY"]);
  });
  it("RED (Atlas 2): a helper catch with an early return before its rethrow is not authority", () => {
    expect(codes(IMPORTS + "async function authority(){ try { await requireRole('ADMIN'); } catch (e) { if (skip) return null; throw e; } }\n" + handler)).toEqual(["GUARD_BEFORE_AUTHORITY"]);
  });
  it.each([
    ["return inside an earlier try", "async function authority(){ try { if (x) return; } finally {} await requireRole('ADMIN'); }"],
    ["return in an earlier loop", "async function authority(){ for (const r of rs) { if (r) return r; } await requireRole('ADMIN'); }"],
    ["catch returning in an else branch", "async function authority(){ try { await requireRole('ADMIN'); } catch (e) { if (e) { throw e; } else { return null; } } }"],
    ["arrow helper with early return", "const authority = async () => { if (skip) return; await requireRole('ADMIN'); };"],
  ])("RED: %s is not authority", (_n, helper) => {
    expect(codes(IMPORTS + helper + "\n" + handler)).toEqual(["GUARD_BEFORE_AUTHORITY"]);
  });
  it("controls: authenticating helpers stay authority", () => {
    for (const helper of [
      "async function authority(){ const u = await requireRole('ADMIN'); if (!u.schoolId) throw new Error('x'); return u; }",
      "async function authority(){ try { return await requireRole('ADMIN'); } catch (e) { log(e); throw e; } }",
      "async function authority(){ return requireRole('ADMIN'); }",
      "const authority = () => requireRole('ADMIN');",
    ])
      expect(codes(IMPORTS + helper + "\n" + handler)).toEqual([]);
  });
  it("RED (Atlas 3): a later alias reassignment does not erase an earlier identity write", () => {
    const r = ascan("export async function POST() { let users = prisma.user; await users.create({data: payload}); users = prisma.school; return null; }");
    expect(r.provisioningHandlers).toEqual([`${AROUTE} POST`]);
    expect(r.offenders.map(o => o.code)).toEqual(["MISSING_DOMINATING_GUARD"]);
  });
  it.each([
    ["identity assigned after a school binding", "export async function POST(){ let d = prisma.school; d = prisma.user; return d.create({data}); }"],
    ["destructured then reassigned", "export async function POST(){ let {user} = prisma; await user.create({data}); user = other; return null; }"],
  ])("RED: %s keeps the identity write", (_n, source) => {
    expect(codes(source)).toEqual(["MISSING_DOMINATING_GUARD"]);
  });
  it("RED: a delegate alias rebound to an unresolvable value requires review", () => {
    const r = ascan("export async function POST(){ let d = prisma.school; d = pick(); return d.create({data}); }");
    expect(r.review.map(x => x.code)).toContain("IDENTITY_DELEGATE_UNRESOLVED");
  });
  it("control: a non-identity alias stays clean", () => {
    const r = ascan("export async function POST(){ const s = prisma.school; return s.create({data}); }");
    expect([r.offenders, r.review, r.provisioningHandlers]).toEqual([[], [], []]);
  });
});

/**
 * Atlas ATLAS-T1-REVISION-3-REPAIR-2-VERDICT-20261103: the alias union chose only its FIRST identity binding, so
 * `user` then `inviteToken` followed by deleteMany (an ordinary user delete is not provisioning; any token write is)
 * escaped. Every binding is now evaluated under its own model's rules.
 */
describe("Atlas repair-2 verdict: every alias binding is classified under its own rules", () => {
  const AROUTE = "app/api/independent/route.ts";
  const codes = (source: string) => scan({ [AROUTE]: source }).offenders.map(o => o.code);
  it("RED (Atlas, verbatim): user then inviteToken, deleteMany is provisioning", () => {
    expect(codes("export async function POST() {\n  let delegate = prisma.user;\n  delegate = prisma.inviteToken;\n  return delegate.deleteMany({where: {id: tokenId}});\n}")).toEqual(["MISSING_DOMINATING_GUARD"]);
  });
  it.each([
    ["reordered: inviteToken then user, deleteMany", "let d = prisma.inviteToken; d = prisma.user; return d.deleteMany({where});"],
    ["user then platformTransferToken, update", "let d = prisma.user; d = prisma.platformTransferToken; return d.update({where, data:{usedAt:now}});"],
    ["account then passwordResetToken, delete", "let d = prisma.account; d = prisma.passwordResetToken; return d.delete({where});"],
    ["session then privilegedMfaCredential, updateMany", "let d = prisma.session; d = prisma.privilegedMfaCredential; return d.updateMany({data});"],
    ["destructured user plus assigned token, deleteMany", "let {user: d} = prisma; d = prisma.verificationToken; return d.deleteMany({});"],
    ["school then user, sensitive update", "let d = prisma.school; d = prisma.user; return d.update({where, data:{role:'ADMIN'}});"],
  ])("RED: %s is provisioning", (_n, body) => {
    expect(codes(`export async function POST(){ ${body} }`)).toEqual(["MISSING_DOMINATING_GUARD"]);
  });
  it("controls: user then school, plain delete or name update, stays clean", () => {
    for (const body of [
      "let d = prisma.user; d = prisma.school; return d.deleteMany({where});",
      "let d = prisma.school; d = prisma.user; return d.update({where, data:{name:'x'}});",
    ])
      expect(scan({ [AROUTE]: `export async function POST(){ ${body} }` }).offenders).toEqual([]);
  });
});
