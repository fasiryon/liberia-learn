// Single-file offline preflight regressions, without application-wide discovery.
import {defineConfig} from 'vitest/config';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
export default defineConfig({root,envDir:false,resolve:{alias:{'@':root}},test:{environment:'node',globals:true,pool:'forks',maxWorkers:1,fileParallelism:false,include:['__tests__/preview-database-preflight.test.ts']}});
