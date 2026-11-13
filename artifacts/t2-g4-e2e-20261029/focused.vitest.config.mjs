import {defineConfig} from 'vitest/config';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
export default defineConfig({root,envDir:false,resolve:{alias:{'@':root}},test:{environment:'node',globals:true,maxWorkers:1,fileParallelism:false,include:['__tests__/g4-school-day-seed-boundary.test.ts','__tests__/g4-school-day-egress.test.ts','__tests__/g4-school-day-secret-output.test.ts','__tests__/g4-school-day-egress-options.test.ts','__tests__/learning-v4/g4-schoolday-admission.test.ts']}});
