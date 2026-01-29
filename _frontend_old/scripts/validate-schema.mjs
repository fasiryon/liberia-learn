import fs from "fs";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const schemaPath = process.argv[2];
const jsonPath = process.argv[3];

if (!schemaPath || !jsonPath) {
  console.error("Usage: node scripts/validate-schema.mjs <schemaPath> <jsonPath>");
  process.exit(2);
}

const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const validate = ajv.compile(schema);
const valid = validate(data);

if (!valid) {
  console.error("SCHEMA VALIDATION FAILED");
  console.error(JSON.stringify(validate.errors, null, 2));
  process.exit(1);
}

console.log("Schema validation passed");
process.exit(0);
