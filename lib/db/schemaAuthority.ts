export type SchemaAuthorityRegistryEntry = {
  id: string;
  classification: string;
  acceptedAsIntentional: boolean;
  destructiveIfAutoConverged: boolean;
  allowedPrismaDiffKeys: string[];
};

export type SchemaAuthorityRegistry = {
  schemaVersion: number;
  authorityModel: string;
  entries: SchemaAuthorityRegistryEntry[];
};

export type SchemaAuthorityValidation = {
  ok: boolean;
  actualKeys: string[];
  expectedKeys: string[];
  unregisteredKeys: string[];
  staleRegistryKeys: string[];
  destructiveKeys: string[];
  declaredPendingKeys: string[];
};

function normalizedStatements(sql: string): string[] {
  const withoutComments = sql
    .split(/\r?\n/)
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
  return withoutComments
    .split(";")
    .map((statement) => statement.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function quotedName(pattern: RegExp, statement: string): RegExpExecArray | null {
  return pattern.exec(statement);
}

export function extractPrismaDiffKeys(sql: string): string[] {
  const keys: string[] = [];

  for (const statement of normalizedStatements(sql)) {
    let match = quotedName(/^ALTER TYPE "([^"]+)" ADD VALUE '([^']+)'$/, statement);
    if (match) {
      keys.push(`enum:${match[1]}.${match[2]}:add`);
      continue;
    }

    match = quotedName(/^ALTER TABLE "([^"]+)" DROP CONSTRAINT "([^"]+)"$/, statement);
    if (match) {
      const kind = match[2].endsWith("_fkey") ? "foreignKey" : "constraint";
      keys.push(`${kind}:${match[2]}:drop`);
      continue;
    }

    match = quotedName(
      /^ALTER TABLE "([^"]+)" ADD CONSTRAINT "([^"]+)" FOREIGN KEY /,
      statement,
    );
    if (match) {
      keys.push(`foreignKey:${match[2]}:add`);
      continue;
    }

    match = quotedName(
      /^ALTER TABLE "([^"]+)" RENAME CONSTRAINT "([^"]+)" TO "([^"]+)"$/,
      statement,
    );
    if (match) {
      keys.push(`foreignKey:${match[2]}->${match[3]}:rename`);
      continue;
    }

    match = quotedName(/^DROP INDEX "([^"]+)"$/, statement);
    if (match) {
      keys.push(`index:${match[1]}:drop`);
      continue;
    }

    match = quotedName(/^CREATE (?:UNIQUE )?INDEX "([^"]+)" /, statement);
    if (match) {
      keys.push(`index:${match[1]}:create`);
      continue;
    }

    match = quotedName(/^ALTER INDEX "([^"]+)" RENAME TO "([^"]+)"$/, statement);
    if (match) {
      keys.push(`index:${match[1]}->${match[2]}:rename`);
      continue;
    }

    match = quotedName(/^DROP TABLE "([^"]+)"$/, statement);
    if (match) {
      keys.push(`table:${match[1]}:drop`);
      continue;
    }

    match = quotedName(/^ALTER TABLE "([^"]+)" (.+)$/, statement);
    if (match) {
      const table = match[1];
      const operations = match[2];
      let operationCount = 0;

      for (const column of operations.matchAll(/ALTER COLUMN "([^"]+)" DROP DEFAULT/g)) {
        keys.push(`default:${table}.${column[1]}:drop`);
        operationCount += 1;
      }
      for (const column of operations.matchAll(/ALTER COLUMN "([^"]+)" SET DEFAULT/g)) {
        keys.push(`default:${table}.${column[1]}:set`);
        operationCount += 1;
      }
      for (const column of operations.matchAll(/ALTER COLUMN "([^"]+)" SET DATA TYPE/g)) {
        keys.push(`columnType:${table}.${column[1]}:alter`);
        operationCount += 1;
      }
      for (const column of operations.matchAll(/ADD COLUMN\s+"([^"]+)"/g)) {
        keys.push(`column:${table}.${column[1]}:add`);
        operationCount += 1;
      }
      for (const column of operations.matchAll(/DROP COLUMN\s+"([^"]+)"/g)) {
        keys.push(`column:${table}.${column[1]}:drop`);
        operationCount += 1;
      }
      if (operationCount > 0) continue;
    }

    keys.push(`unparsed:${statement}`);
  }

  return keys.sort();
}

function isDestructiveDiffKey(key: string): boolean {
  return (
    key.endsWith(":drop") ||
    key.endsWith(":alter") ||
    key.includes(":remove")
  );
}

export function validateSchemaAuthorityDiff(
  sql: string,
  registry: SchemaAuthorityRegistry,
): SchemaAuthorityValidation {
  if (registry.schemaVersion !== 1) {
    throw new Error(`Unsupported schema authority registry version: ${registry.schemaVersion}`);
  }
  if (registry.authorityModel !== "LAYERED_SCHEMA_AUTHORITY_MODEL") {
    throw new Error("Schema authority registry does not declare the layered model");
  }

  const ownerByKey = new Map<string, SchemaAuthorityRegistryEntry>();
  for (const entry of registry.entries) {
    for (const key of entry.allowedPrismaDiffKeys) {
      if (key.includes("*")) throw new Error(`Wildcard diff exception is forbidden: ${key}`);
      if (ownerByKey.has(key)) throw new Error(`Duplicate diff exception: ${key}`);
      ownerByKey.set(key, entry);
    }
  }

  const actualKeys = extractPrismaDiffKeys(sql);
  const expectedKeys = [...ownerByKey.keys()].sort();
  const actualSet = new Set(actualKeys);
  const unregisteredKeys = actualKeys.filter((key) => !ownerByKey.has(key));
  const staleRegistryKeys = expectedKeys.filter((key) => !actualSet.has(key));
  const destructiveKeys = actualKeys.filter(isDestructiveDiffKey);
  const declaredPendingKeys = actualKeys.filter((key) => {
    const entry = ownerByKey.get(key);
    return entry?.acceptedAsIntentional === false && entry.classification.includes("PENDING");
  });

  return {
    ok: unregisteredKeys.length === 0 && staleRegistryKeys.length === 0,
    actualKeys,
    expectedKeys,
    unregisteredKeys,
    staleRegistryKeys,
    destructiveKeys,
    declaredPendingKeys,
  };
}
