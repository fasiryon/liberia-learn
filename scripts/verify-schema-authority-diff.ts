import fs from "node:fs";
import path from "node:path";
import {
  validateSchemaAuthorityDiff,
  type SchemaAuthorityRegistry,
} from "../lib/db/schemaAuthority";

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`Missing ${name}`);
  return process.argv[index + 1];
}

const diffFile = path.resolve(argument("--diff-file"));
const registryFile = path.resolve(
  process.argv.includes("--registry")
    ? argument("--registry")
    : "prisma/canonical/schema-authority-registry.json",
);
const reportFile = process.argv.includes("--report")
  ? path.resolve(argument("--report"))
  : null;

const diffSql = fs.readFileSync(diffFile, "utf8");
const registry = JSON.parse(fs.readFileSync(registryFile, "utf8")) as SchemaAuthorityRegistry;
const result = validateSchemaAuthorityDiff(diffSql, registry);

const report = {
  schemaVersion: 1,
  result: result.ok ? "PASS" : "FAIL",
  registry: path.relative(process.cwd(), registryFile).replaceAll("\\", "/"),
  diffStatementKeys: result.actualKeys,
  destructiveRegisteredKeys: result.destructiveKeys,
  declaredPendingKeys: result.declaredPendingKeys,
  unregisteredKeys: result.unregisteredKeys,
  staleRegistryKeys: result.staleRegistryKeys,
};

if (reportFile) {
  fs.mkdirSync(path.dirname(reportFile), { recursive: true });
  fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!result.ok) process.exitCode = 1;
