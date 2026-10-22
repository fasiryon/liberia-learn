import { generateReferenceBatch } from "../lib/content-factory/v4/referenceBatch";

generateReferenceBatch().then(receipt => {
  console.log(JSON.stringify(receipt, null, 2));
}).catch(error => { console.error(error); process.exitCode = 1; });
