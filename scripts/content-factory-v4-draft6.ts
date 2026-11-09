import { generateDraft6 } from "../lib/content-factory/v4/draft6/generate";

generateDraft6().then(receipt => console.log(JSON.stringify({ version: receipt.version, packages: receipt.packages, published: false }, null, 2)))
  .catch(error => { console.error(error); process.exitCode = 1; });
