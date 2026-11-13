import {defineConfig} from 'vitest/config';
import {fileURLToPath} from 'node:url';
const root='C:/liberia-learn/.task-worktrees/t1-preview-app';
const review=fileURLToPath(new URL('./independent.test.ts',import.meta.url));
export default defineConfig({root,envDir:false,resolve:{alias:{'@':root}},test:{environment:'node',globals:true,maxWorkers:1,fileParallelism:false,include:[root+'/__tests__/preview-identity-freeze.test.ts',review]}});
