import {defineConfig} from 'vitest/config';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
export default defineConfig({root,envDir:false,resolve:{alias:{'@':'C:/liberia-learn/.task-worktrees/t1-preview-app'}},test:{environment:'node',globals:true,maxWorkers:1,fileParallelism:false,include:['independent.test.ts']}});
