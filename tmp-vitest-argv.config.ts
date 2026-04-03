import { defineConfig } from 'vitest/config';
console.log(JSON.stringify(process.argv));
export default defineConfig({ test: { include: ['__tests__/**/*.{test,spec}.{ts,tsx}'] } });
