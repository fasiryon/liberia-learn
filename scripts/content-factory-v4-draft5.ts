import { generateDraft5 } from "../lib/content-factory/v4/draft5/generate";
generateDraft5().then(receipt => console.log(JSON.stringify(receipt, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
