import {resolve} from 'node:path';
import {defineConfig} from 'prisma/config';
// Intentionally no dotenv loading. setup-preview-db supplies only the validated target.
export default defineConfig({schema:resolve(process.cwd(),'prisma/schema.prisma')});
