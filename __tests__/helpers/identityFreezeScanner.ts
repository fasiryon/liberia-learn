/**
 * Syntax-aware completeness scanner for the Preview identity freeze (T1 Revision 3; replaces the 5daefe7c
 * substring/regex guard that T2's seven adversarial cases escaped).
 *
 * Model:
 *  - Every app/ and lib/ module is parsed with the TypeScript compiler. Each top-level declaration (function,
 *    arrow/function-valued const, any other const, class) is a unit; nested functions belong to their unit.
 *  - A unit PROVISIONS if its syntax contains an identity write, or it references (calls, passes or re-exports)
 *    a provisioning unit. References resolve through named, aliased, default and namespace imports, re-exports
 *    and `export *`, across files, to a fixpoint.
 *  - Identity write: `<any>.<model>.<create|createMany|createManyAndReturn|upsert>` on an identity model, a
 *    `user.update*` whose data sets a sensitive field, or any object property `hashedPwd` with a non-boolean value
 *    (covers nested writes). Property and element access are both resolved, so whitespace and `["user"]` are seen.
 *  - Unknown relevant shapes (computed non-literal model on a write method, user.update with non-literal data,
 *    dynamic import of a local module) are REVIEW items: they fail unless explicitly reviewed.
 *  - Entry points are the exported HTTP handlers of app/api/** /route.ts and exported functions of "use server"
 *    modules. Each provisioning handler must itself contain a dominating freeze:
 *      `const x = previewIdentityFrozen(); if (x) return x;`
 *    as a statement of its body, or of a top-level try whose catch always returns/throws and whose finally cannot
 *    return (Atlas R3 #3: a fall-through catch breaks dominance), resolved to the real export of
 *    @/lib/preview/identityFreeze (a comment, a string, a guard in another handler or a merely imported name do
 *    not count). A freeze call anywhere else is UNSUPPORTED_GUARD_PLACEMENT. It must precede every provisioning
 *    reference and every request-body read. On protected routes a completed, awaited authority call must dominate
 *    it (Atlas R3 #2: a reference, an un-awaited call, a branch or a fall-through try does not count; helpers qualify
 *    only through their own dominating awaited call with no earlier return and a catch that always throws with no
 *    return (repair #1, #2); getServerSession alone is not
 *    authority). Public entry points (PREVIEW_PUBLIC_IDENTITY_ENTRY_POINTS) refuse first.
 *  - Delegate aliases (const, destructured, renamed, assigned, element access) resolve to their model (Atlas R3 #1);
 *    all bindings of a name are unioned, so a later reassignment cannot hide an identity write (repair #3);
 *    an identity delegate of a Prisma-like receiver used as a value, or a computed alias, is IDENTITY_DELEGATE_UNRESOLVED.
 *  - An exported HTTP handler not resolvable to a function is UNRESOLVED_HANDLER_EXPORT (Atlas R3 #4).
 *
 * Limits (documented for Atlas): calls through object properties of non-namespace values, dependency-injected
 * callbacks stored in data structures, raw SQL, eval and runtime-generated model names are not resolved beyond the
 * REVIEW classes above. The database (T2 triggers, grants) remains the boundary for those.
 */
import ts from "typescript";

export type SourceTree = { files: string[]; read(path: string): string };

export const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const IDENTITY_CREATE_MODELS = new Set([
  "user", "account", "session", "verificationToken", "passwordResetToken", "inviteToken", "privilegedIdentity",
  "privilegedMfaCredential", "platformTransferToken",
]);
/** For credential/token/privilege models any write is identity lifecycle; for these only creation is. */
const ACCOUNT_MODELS = new Set(["user", "session", "account"]);
const CREATE_OPS = new Set(["create", "createMany", "createManyAndReturn", "upsert"]);
const WRITE_OPS = new Set([...CREATE_OPS, "update", "updateMany", "updateManyAndReturn", "delete", "deleteMany"]);
const USER_UPDATE_OPS = new Set(["update", "updateMany", "updateManyAndReturn", "upsert"]);
const USER_SENSITIVE_FIELDS = new Set(["hashedPwd", "role", "isPlatformAdmin", "passwordChangedAt"]);
const AUTHORITY_MODULES: Record<string, Set<string>> = {
  "lib/auth": new Set(["requireUser", "requireRole", "requirePlatformAdmin", "requirePrivilegedStepUp", "requireSession"]),
  "lib/moeAccess": new Set(["requireMoePlatformAdmin"]),
};
const FREEZE_MODULE = "lib/preview/identityFreeze";
const FREEZE_EXPORT = "previewIdentityFrozen";
const BODY_READS = new Set(["json", "formData", "text", "arrayBuffer", "blob"]);
const ANY_EXPORT = "\0any-export";
const PRISMA_RECEIVERS = new Set(["prisma", "rdsPrisma", "tx", "db", "client", "prismaClient", "trx"]);

type Import = { module: string; name: string }; // name '*' = namespace
type Unit = {
  name: string;
  node: ts.Node;
  direct: Array<{ pos: number; code: string }>;
  refs: Array<{ pos: number; target: Import | { local: string } }>;
  review: string[];
};
type Module = {
  path: string;
  sf: ts.SourceFile;
  imports: Map<string, Import>;
  units: Map<string, Unit>;
  exports: Map<string, { local?: string; reexport?: Import }>;
  starExports: string[];
  useServer: boolean;
};
export type Offender = { file: string; handler: string; code: string };
export type ScanResult = {
  provisioningHandlers: string[];
  offenders: Offender[];
  review: Array<{ file: string; unit: string; code: string }>;
};

const isIdentityModel = (name: string) => IDENTITY_CREATE_MODELS.has(name) || /invite/i.test(name);

function resolveSpecifier(tree: Set<string>, from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = spec.slice(2);
  else if (spec.startsWith(".")) {
    const parts = from.split("/").slice(0, -1);
    for (const seg of spec.split("/")) {
      if (seg === "..") parts.pop();
      else if (seg !== ".") parts.push(seg);
    }
    base = parts.join("/");
  } else return spec; // package: kept verbatim (used for next-auth authority)
  for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (tree.has(candidate)) return candidate.replace(/\.tsx?$/, "");
  }
  return base;
}

/** Property name of `a.b` or `a["b"]`; null when computed and not a literal. */
function memberName(node: ts.Expression): string | null | undefined {
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  if (ts.isElementAccessExpression(node)) {
    const arg = node.argumentExpression;
    return ts.isStringLiteralLike(arg) ? arg.text : null;
  }
  return undefined;
}
const objectOf = (node: ts.Expression) =>
  ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node) ? node.expression : undefined;

function parseModule(tree: Set<string>, path: string, text: string): Module {
  const sf = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, path.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const self = path.replace(/\.tsx?$/, "");
  const mod: Module = { path: self, sf, imports: new Map(), units: new Map(), exports: new Map(), starExports: [], useServer: false };
  const first = sf.statements[0];
  mod.useServer = !!first && ts.isExpressionStatement(first) && ts.isStringLiteral(first.expression) && first.expression.text === "use server";
  const hasModifier = (n: ts.Node, kind: ts.SyntaxKind) => !!ts.getModifiers(n as ts.HasModifiers)?.some(x => x.kind === kind);
  const exported = (n: ts.Node) => hasModifier(n, ts.SyntaxKind.ExportKeyword);
  const isDefault = (n: ts.Node) => hasModifier(n, ts.SyntaxKind.DefaultKeyword);
  const addUnit = (name: string, node: ts.Node) => mod.units.set(name, { name, node, direct: [], refs: [], review: [] });

  for (const st of sf.statements) {
    if (ts.isImportDeclaration(st) && ts.isStringLiteral(st.moduleSpecifier)) {
      const module = resolveSpecifier(tree, path, st.moduleSpecifier.text)!;
      const clause = st.importClause;
      if (!clause) continue;
      if (clause.name) mod.imports.set(clause.name.text, { module, name: "default" });
      const nb = clause.namedBindings;
      if (nb && ts.isNamespaceImport(nb)) mod.imports.set(nb.name.text, { module, name: "*" });
      if (nb && ts.isNamedImports(nb))
        for (const el of nb.elements) mod.imports.set(el.name.text, { module, name: (el.propertyName ?? el.name).text });
    } else if (ts.isExportDeclaration(st)) {
      const module = st.moduleSpecifier && ts.isStringLiteral(st.moduleSpecifier) ? resolveSpecifier(tree, path, st.moduleSpecifier.text)! : null;
      if (!st.exportClause && module) mod.starExports.push(module);
      else if (st.exportClause && ts.isNamedExports(st.exportClause))
        for (const el of st.exportClause.elements) {
          const local = (el.propertyName ?? el.name).text;
          mod.exports.set(el.name.text, module ? { reexport: { module, name: local } } : { local });
        }
    } else if (ts.isExportAssignment(st)) {
      addUnit("default", st.expression);
      mod.exports.set("default", { local: "default" });
    } else if ((ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st)) && st.name) {
      addUnit(st.name.text, st);
      if (exported(st)) mod.exports.set(isDefault(st) ? "default" : st.name.text, { local: st.name.text });
    } else if ((ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st)) && isDefault(st)) {
      addUnit("default", st);
      mod.exports.set("default", { local: "default" });
    } else if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        if (!ts.isIdentifier(d.name)) continue;
        addUnit(d.name.text, d);
        if (exported(st)) mod.exports.set(d.name.text, { local: d.name.text });
      }
    }
  }

  // A Prisma-like receiver: a conventional client/transaction name, or any binding imported from lib/db.
  const prismaLike = (e: ts.Expression) =>
    ts.isIdentifier(e) && (PRISMA_RECEIVERS.has(e.text) || mod.imports.get(e.text)?.module === "lib/db");
  for (const unit of mod.units.values()) {
    // Delegate aliases (Atlas R3 #1): `const users = prisma.user`, `const {user} = tx`, `const {inviteToken: i} = db`,
    // `d = prisma.platformTransferToken`. Every binding of a name is kept (Atlas repair #3: a later reassignment must
    // not erase an earlier identity write; scope and order are not modelled, so bindings are unioned). A binding is
    // the model name, or null when the key is computed or the name is rebound to something unresolvable.
    const alias = new Map<string, Set<string | null>>();
    const bind = (name: string, model: string | null) => alias.set(name, (alias.get(name) ?? new Set()).add(model));
    const rebound: string[] = [];
    const collect = (n: ts.Node) => {
      if (ts.isVariableDeclaration(n) && n.initializer) {
        if (ts.isIdentifier(n.name) && memberName(n.initializer) !== undefined) bind(n.name.text, memberName(n.initializer)!);
        if (ts.isObjectBindingPattern(n.name))
          for (const el of n.name.elements)
            if (ts.isIdentifier(el.name) && !el.dotDotDotToken) {
              const prop = el.propertyName;
              bind(el.name.text, !prop ? el.name.text : ts.isIdentifier(prop) || ts.isStringLiteralLike(prop) ? prop.text : null);
            }
      }
      if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(n.left)) {
        if (memberName(n.right) !== undefined) bind(n.left.text, memberName(n.right)!);
        else rebound.push(n.left.text);
      }
      ts.forEachChild(n, collect);
    };
    ts.forEachChild(unit.node, collect);
    for (const name of rebound) if (alias.has(name)) bind(name, null);

    const visit = (n: ts.Node) => {
      // An identity delegate on a Prisma-like receiver that is used as a value (passed, returned, stored) rather than
      // called or aliased cannot be followed: fail closed to REVIEW.
      if ((ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n)) && prismaLike(n.expression)) {
        const model = memberName(n);
        const parent = n.parent;
        const accessed = (ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) && parent.expression === n;
        const aliased = (ts.isVariableDeclaration(parent) && parent.initializer === n) ||
          (ts.isBinaryExpression(parent) && parent.right === n && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken);
        if (!accessed && !aliased && (model === null || (model && isIdentityModel(model)))) unit.review.push("IDENTITY_DELEGATE_UNRESOLVED");
      }
      if (ts.isCallExpression(n)) {
        const callee = n.expression;
        const op = memberName(callee);
        const modelExpr = objectOf(callee);
        if (op && modelExpr) {
          const bindings = ts.isIdentifier(modelExpr) ? alias.get(modelExpr.text) : undefined;
          // Through an alias, EVERY binding is classified under its own model's rules (Atlas repair-2 verdict: a
          // representative binding hides e.g. user→inviteToken + deleteMany). An unresolvable binding adds review.
          const models: Array<string | null | undefined> = bindings ? [...bindings] : [memberName(modelExpr)];
          if (bindings?.has(null) && WRITE_OPS.has(op)) unit.review.push("IDENTITY_DELEGATE_UNRESOLVED");
          else if (!bindings && models[0] === null && WRITE_OPS.has(op)) unit.review.push("UNKNOWN_COMPUTED_MODEL_WRITE");
          for (const model of new Set(models)) {
          if (model && isIdentityModel(model) && (CREATE_OPS.has(op) || (WRITE_OPS.has(op) && !ACCOUNT_MODELS.has(model)))) unit.direct.push({ pos: n.getStart(), code: `${model}.${op}` });
          if (model === "user" && USER_UPDATE_OPS.has(op)) {
            const arg = n.arguments[0];
            const data = arg && ts.isObjectLiteralExpression(arg)
              ? arg.properties.find(p => ts.isPropertyAssignment(p) && p.name.getText(sf) === (op === "upsert" ? "update" : "data"))
              : undefined;
            const value = data && ts.isPropertyAssignment(data) ? data.initializer : undefined;
            if (!value || !ts.isObjectLiteralExpression(value)) unit.review.push("UNKNOWN_USER_UPDATE_DATA");
            else if (value.properties.some(p => p.name && USER_SENSITIVE_FIELDS.has(p.name.getText(sf)) || ts.isSpreadAssignment(p)))
              unit.direct.push({ pos: n.getStart(), code: `user.${op}(sensitive)` });
          }
          }
        }
        if (callee.kind === ts.SyntaxKind.ImportKeyword) {
          // A literal local dynamic import references every export of that module; a computed one needs review.
          const arg = n.arguments[0];
          if (!arg || !ts.isStringLiteralLike(arg)) unit.review.push("UNKNOWN_DYNAMIC_IMPORT");
          else if (arg.text.startsWith("@/") || arg.text.startsWith("."))
            unit.refs.push({ pos: n.getStart(), target: { module: resolveSpecifier(tree, path, arg.text)!, name: ANY_EXPORT } });
        }
      }
      if ((ts.isPropertyAssignment(n) || ts.isShorthandPropertyAssignment(n)) && n.name.getText(sf) === "hashedPwd") {
        const v = ts.isPropertyAssignment(n) ? n.initializer : n.name;
        if (v.kind !== ts.SyntaxKind.TrueKeyword && v.kind !== ts.SyntaxKind.FalseKeyword)
          unit.direct.push({ pos: n.getStart(), code: "hashedPwd" });
      }
      if (ts.isIdentifier(n) && n !== (unit.node as ts.NamedDeclaration).name) {
        const parent = n.parent;
        const isPropName = (ts.isPropertyAccessExpression(parent) && parent.name === n) || (ts.isPropertyAssignment(parent) && parent.name === n);
        if (!isPropName) {
          const imp = mod.imports.get(n.text);
          if (imp) {
            if (imp.name === "*" && ts.isPropertyAccessExpression(parent) && parent.expression === n)
              unit.refs.push({ pos: n.getStart(), target: { module: imp.module, name: parent.name.text } });
            else if (imp.name === "*" && ts.isElementAccessExpression(parent) && parent.expression === n)
              unit.review.push("UNKNOWN_NAMESPACE_MEMBER");
            else if (imp.name !== "*") unit.refs.push({ pos: n.getStart(), target: imp });
          } else if (mod.units.has(n.text) && n.text !== unit.name) unit.refs.push({ pos: n.getStart(), target: { local: n.text } });
        }
      }
      ts.forEachChild(n, visit);
    };
    ts.forEachChild(unit.node, visit);
  }
  return mod;
}

/**
 * @param reviewed explicit reviews: `"<file> <METHOD>"` accepts a provisioning handler, `"<file>#<unit>:<CODE>"`
 *   accepts a REVIEW item.
 * @param nonPropagating `"<file>#<unit>"` provisioning units whose only entry point is itself reviewed (NextAuth's
 *   own callbacks): they are reported but do not make their referrers provisioning.
 */
export function scanIdentityFreeze(
  tree: SourceTree,
  publicEntryPoints: readonly string[],
  reviewed: Record<string, string> = {},
  nonPropagating: Record<string, string> = {}
): ScanResult & { nonPropagatingProvisioners: string[] } {
  const names = new Set(tree.files);
  const modules = new Map<string, Module>();
  for (const file of tree.files) {
    if (!/\.tsx?$/.test(file) || /(^|\/)__tests__\//.test(file) || /\.(test|spec)\.tsx?$/.test(file)) continue;
    const mod = parseModule(names, file, tree.read(file));
    modules.set(mod.path, mod);
  }

  const resolveExport = (module: string, name: string, seen = new Set<string>()): { mod: Module; unit: string } | null => {
    const key = `${module}#${name}`;
    if (seen.has(key)) return null;
    seen.add(key);
    const mod = modules.get(module);
    if (!mod) return null;
    const exp = mod.exports.get(name);
    if (exp?.local) return mod.units.has(exp.local) ? { mod, unit: exp.local } : null;
    if (exp?.reexport) return resolveExport(exp.reexport.module, exp.reexport.name, seen);
    for (const star of mod.starExports) {
      const hit = resolveExport(star, name, seen);
      if (hit) return hit;
    }
    return null;
  };
  const targets = (mod: Module, ref: Unit["refs"][number]): Array<{ mod: Module; unit: string }> => {
    if ("local" in ref.target) return [{ mod, unit: ref.target.local }];
    if (ref.target.name !== ANY_EXPORT) {
      const hit = resolveExport(ref.target.module, ref.target.name);
      return hit ? [hit] : [];
    }
    const m = modules.get(ref.target.module);
    return m ? [...m.exports.keys()].map(k => resolveExport(m.path, k)).filter((x): x is { mod: Module; unit: string } => !!x) : [];
  };
  const refProvisions = (mod: Module, ref: Unit["refs"][number]) => targets(mod, ref).some(t => provisions.has(id(t.mod, t.unit)));

  // Fixpoints: provisioning and authority units.
  const provisions = new Set<string>();
  const id = (m: Module, u: string) => `${m.path}#${u}`;
  const blocked = new Set(Object.keys(nonPropagating).map(k => k.replace(/\.tsx?#/, "#")));
  const nonPropagatingProvisioners: string[] = [];
  for (const mod of modules.values())
    for (const u of mod.units.values())
      if (u.direct.length) {
        if (blocked.has(id(mod, u.name))) nonPropagatingProvisioners.push(id(mod, u.name));
        else provisions.add(id(mod, u.name));
      }
  for (let changed = true; changed; ) {
    changed = false;
    for (const mod of modules.values())
      for (const u of mod.units.values()) {
        const key = id(mod, u.name);
        if (!provisions.has(key) && !blocked.has(key) && u.refs.some(r => refProvisions(mod, r))) {
          provisions.add(key);
          changed = true;
        }
      }
  }

  // Authority (Atlas R3 #2): only a completed, awaited call in a dominating position counts. A reference, an
  // un-awaited call, a call in a branch or in a try whose catch can fall through establishes nothing. A helper is an
  // authority helper only if its own body has such a call (its catch must rethrow, so the caller cannot continue).
  const calleeTarget = (mod: Module, e: ts.Expression): "seed" | { mod: Module; unit: string } | null => {
    let imp: Import | undefined;
    if (ts.isIdentifier(e)) {
      imp = mod.imports.get(e.text);
      if (!imp) return mod.units.has(e.text) ? { mod, unit: e.text } : null;
      if (imp.name === "*") return null;
    } else if (ts.isPropertyAccessExpression(e) && ts.isIdentifier(e.expression) && mod.imports.get(e.expression.text)?.name === "*") {
      imp = { module: mod.imports.get(e.expression.text)!.module, name: e.name.text };
    } else return null;
    if (AUTHORITY_MODULES[imp.module]?.has(imp.name)) return "seed";
    return resolveExport(imp.module, imp.name);
  };
  const authorityMemo = new Map<string, boolean>();
  const isAuthorityUnit = (mod: Module, unitName: string): boolean => {
    const key = id(mod, unitName);
    if (authorityMemo.has(key)) return authorityMemo.get(key)!;
    authorityMemo.set(key, false); // recursion guard: cycles prove nothing
    const fn = functionOf(mod, mod.units.get(unitName));
    let ok = false;
    if (fn?.body && ts.isBlock(fn.body)) {
      const { stmts } = dominatingStatements(fn.body, "helper");
      // Atlas repair #1: every normal return path must authenticate first, so no return statement (outside nested
      // functions) may start before the first dominating awaited authority statement.
      const idx = stmts.findIndex(s => awaitedAuthority(mod, s, true));
      ok = idx >= 0 && !returnBefore(fn.body, stmts[idx].getStart(mod.sf));
    } else if (fn?.body) {
      const e = ts.isAwaitExpression(fn.body) ? fn.body.expression : fn.body;
      ok = ts.isCallExpression(e) && isAuthorityCall(mod, e);
    }
    authorityMemo.set(key, ok);
    return ok;
  };
  const isAuthorityCall = (mod: Module, call: ts.CallExpression): boolean => {
    const t = calleeTarget(mod, call.expression);
    return t === "seed" || (!!t && isAuthorityUnit(t.mod, t.unit));
  };
  const awaitedAuthority = (mod: Module, st: ts.Statement, allowReturn: boolean): boolean => {
    const awaited = (e: ts.Expression | undefined) => !!e && ts.isAwaitExpression(e) && ts.isCallExpression(e.expression) && isAuthorityCall(mod, e.expression);
    if (ts.isExpressionStatement(st)) return awaited(st.expression);
    if (ts.isVariableStatement(st)) return st.declarationList.declarations.some(d => awaited(d.initializer));
    if (allowReturn && ts.isReturnStatement(st) && st.expression)
      return awaited(st.expression) || (ts.isCallExpression(st.expression) && isAuthorityCall(mod, st.expression));
    return false;
  };

  const result: ScanResult & { nonPropagatingProvisioners: string[] } = {
    provisioningHandlers: [], offenders: [], review: [], nonPropagatingProvisioners: nonPropagatingProvisioners.sort(),
  };
  for (const mod of modules.values())
    for (const u of mod.units.values())
      for (const code of new Set(u.review)) {
        const key = `${mod.path}.ts#${u.name}:${code}`;
        if (!reviewed[key] && !reviewed[`${mod.path}.tsx#${u.name}:${code}`]) result.review.push({ file: `${mod.path}.ts`, unit: u.name, code });
      }

  for (const mod of modules.values()) {
    const isRoute = /^app\/api\/.+\/route$/.test(mod.path);
    if (!isRoute && !mod.useServer) continue;
    const file = tree.files.find(f => f.replace(/\.tsx?$/, "") === mod.path)!;
    for (const [exportName, exp] of mod.exports) {
      if (isRoute && !HTTP_METHODS.has(exportName)) continue;
      const resolved = exp.local && mod.units.has(exp.local) ? { mod, unit: exp.local } : exp.reexport ? resolveExport(exp.reexport.module, exp.reexport.name) : null;
      // Unsupported shapes fail closed (Atlas R3 #4): an exported handler whose implementation cannot be resolved
      // to a function needs explicit review even when no write is visible.
      const reviewKey = `${file}#${exportName}:UNRESOLVED_HANDLER_EXPORT`;
      if (!resolved || !functionOf(resolved.mod, resolved.mod.units.get(resolved.unit))) {
        if (!reviewed[reviewKey]) result.review.push({ file, unit: exportName, code: "UNRESOLVED_HANDLER_EXPORT" });
        if (!resolved) continue;
      }
      if (!provisions.has(id(resolved.mod, resolved.unit))) continue;
      result.provisioningHandlers.push(`${file} ${exportName}`);
      if (reviewed[`${file} ${exportName}`]) continue;
      const code = checkHandler(resolved.mod, resolved.mod.units.get(resolved.unit)!, {
        isPublic: publicEntryPoints.includes(file),
        provisioningRef: r => refProvisions(resolved.mod, r),
        authorityStatement: st => awaitedAuthority(resolved.mod, st, false),
      });
      if (code) result.offenders.push({ file, handler: exportName, code });
    }
  }
  result.provisioningHandlers.sort();
  result.offenders.sort((a, b) => `${a.file} ${a.handler}`.localeCompare(`${b.file} ${b.handler}`));
  return result;
}


/**
 * The function implementing a unit: a declaration, a const initialised by a function, or a wrapper call whose
 * function argument is inline or a local function unit. Anything else is unresolved (fails closed to REVIEW).
 */
function functionOf(mod: Module, unit: Unit | undefined, seen = new Set<string>()): ts.FunctionLikeDeclaration | null {
  if (!unit || seen.has(unit.name)) return null;
  seen.add(unit.name);
  const n = unit.node;
  if (ts.isFunctionDeclaration(n)) return n;
  const init = ts.isVariableDeclaration(n) ? n.initializer : ts.isExpression(n as ts.Expression) ? (n as ts.Expression) : undefined;
  if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) return init;
  // `export const GET = POST;`: an alias of a local function unit.
  if (init && ts.isIdentifier(init) && mod.units.has(init.text)) return functionOf(mod, mod.units.get(init.text), seen);
  if (init && ts.isCallExpression(init)) {
    const inline = init.arguments.find(a => ts.isArrowFunction(a) || ts.isFunctionExpression(a));
    if (inline) return inline as ts.FunctionLikeDeclaration;
    const named = init.arguments.find(a => ts.isIdentifier(a) && mod.units.has(a.text)) as ts.Identifier | undefined;
    if (named) return functionOf(mod, mod.units.get(named.text), seen);
  }
  return null;
}

/** True when every path through the statement ends in return/throw (`throwOnly`: only throw counts). */
function exits(st: ts.Statement, throwOnly: boolean): boolean {
  if (ts.isThrowStatement(st)) return true;
  if (ts.isReturnStatement(st)) return !throwOnly;
  if (ts.isBlock(st)) return st.statements.some(s => exits(s, throwOnly));
  if (ts.isIfStatement(st)) return !!st.elseStatement && exits(st.thenStatement, throwOnly) && exits(st.elseStatement, throwOnly);
  return false;
}
/** True when a return statement (outside nested functions) starts before `pos`. */
function returnBefore(body: ts.Node, pos: number): boolean {
  let found = false;
  const visit = (c: ts.Node) => {
    if (found || ts.isFunctionLike(c)) return;
    if (ts.isReturnStatement(c) && c.getStart() < pos) found = true;
    else ts.forEachChild(c, visit);
  };
  ts.forEachChild(body, visit);
  return found;
}
function containsReturn(n: ts.Node): boolean {
  let found = false;
  const visit = (c: ts.Node) => {
    if (ts.isFunctionLike(c)) return;
    if (ts.isReturnStatement(c)) found = true;
    else ts.forEachChild(c, visit);
  };
  ts.forEachChild(n, visit);
  return found;
}

/**
 * Statements that execute in order on every path that reaches later statements (Atlas R3 #3). A top-level try
 * contributes its try-block statements only when its catch always exits (handler: return or throw; helper: throw)
 * and its finally cannot return. Otherwise the try is unsupported: nothing inside it dominates.
 */
function dominatingStatements(body: ts.Block, mode: "handler" | "helper") {
  const stmts: ts.Statement[] = [];
  const unsupported: ts.TryStatement[] = [];
  for (const st of body.statements) {
    if (!ts.isTryStatement(st)) { stmts.push(st); continue; }
    // Helper (Atlas repair #2): the catch must rethrow on every path and contain no return at all; a conditional
    // early return before a later throw swallows the authority failure.
    const catchOk = !st.catchClause || (mode === "helper"
      ? !containsReturn(st.catchClause.block) && exits(st.catchClause.block, true)
      : exits(st.catchClause.block, false));
    const finallyOk = !st.finallyBlock || !containsReturn(st.finallyBlock);
    if (catchOk && finallyOk) stmts.push(...st.tryBlock.statements);
    else unsupported.push(st);
  }
  return { stmts, unsupported };
}

function checkHandler(
  mod: Module,
  unit: Unit,
  opts: { isPublic: boolean; provisioningRef: (r: Unit["refs"][number]) => boolean; authorityStatement: (st: ts.Statement) => boolean }
): string | null {
  const fn = functionOf(mod, unit);
  if (!fn || !fn.body) return "HANDLER_SHAPE_UNRESOLVED";
  const sf = mod.sf;
  const freezeNames = new Set<string>();
  const freezeNamespaces = new Set<string>();
  for (const [local, imp] of mod.imports) {
    if (imp.module === FREEZE_MODULE && imp.name === FREEZE_EXPORT) freezeNames.add(local);
    if (imp.module === FREEZE_MODULE && imp.name === "*") freezeNamespaces.add(local);
  }
  const isFreezeCall = (e: ts.Node | undefined) =>
    !!e && ts.isCallExpression(e) && e.arguments.length === 0 &&
    ((ts.isIdentifier(e.expression) && freezeNames.has(e.expression.text)) ||
      (ts.isPropertyAccessExpression(e.expression) && ts.isIdentifier(e.expression.expression) &&
        freezeNamespaces.has(e.expression.expression.text) && e.expression.name.text === FREEZE_EXPORT));
  let anyFreezeCall = false;
  const findFreeze = (n: ts.Node) => { if (isFreezeCall(n)) anyFreezeCall = true; else ts.forEachChild(n, findFreeze); };
  findFreeze(fn.body);
  // An expression body has no statement that can dominate.
  if (!ts.isBlock(fn.body)) return anyFreezeCall ? "UNSUPPORTED_GUARD_PLACEMENT" : "MISSING_DOMINATING_GUARD";

  const seq = dominatingStatements(fn.body, "handler").stmts;
  let guardIndex = -1;
  for (let i = 0; i < seq.length - 1; i++) {
    const st = seq[i], next = seq[i + 1];
    if (!ts.isVariableStatement(st) || st.declarationList.declarations.length !== 1) continue;
    const d = st.declarationList.declarations[0];
    if (!ts.isIdentifier(d.name) || !isFreezeCall(d.initializer)) continue;
    const v = d.name.text;
    const returnsV = (s: ts.Statement): boolean =>
      (ts.isReturnStatement(s) && !!s.expression && ts.isIdentifier(s.expression) && s.expression.text === v) ||
      (ts.isBlock(s) && s.statements.length === 1 && returnsV(s.statements[0]));
    if (ts.isIfStatement(next) && !next.elseStatement && ts.isIdentifier(next.expression) && next.expression.text === v && returnsV(next.thenStatement)) {
      guardIndex = i;
      break;
    }
  }
  // A freeze call exists but not in a supported dominating shape: fail closed, never silently accept.
  if (guardIndex < 0) return anyFreezeCall ? "UNSUPPORTED_GUARD_PLACEMENT" : "MISSING_DOMINATING_GUARD";
  const guardPos = seq[guardIndex].getStart(sf);

  const inHandler = (pos: number) => pos >= fn.getStart(sf) && pos <= fn.end;
  for (const w of unit.direct) if (inHandler(w.pos) && w.pos < guardPos) return "WRITE_BEFORE_GUARD";
  for (const r of unit.refs) if (inHandler(r.pos) && r.pos < guardPos && opts.provisioningRef(r)) return "PROVISIONING_BEFORE_GUARD";

  const reqParam = fn.parameters[0] && ts.isIdentifier(fn.parameters[0].name) ? fn.parameters[0].name.text : null;
  let bodyReadBefore = false;
  const scanBody = (n: ts.Node) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && ts.isIdentifier(n.expression.expression) &&
        n.expression.expression.text === reqParam && BODY_READS.has(n.expression.name.text) && n.getStart(sf) < guardPos)
      bodyReadBefore = true;
    ts.forEachChild(n, scanBody);
  };
  if (reqParam) scanBody(fn.body);
  if (bodyReadBefore) return "BODY_READ_BEFORE_GUARD";

  if (!opts.isPublic && !seq.slice(0, guardIndex).some(st => opts.authorityStatement(st))) return "GUARD_BEFORE_AUTHORITY";
  return null;
}
