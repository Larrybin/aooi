import { createRequire } from 'node:module';

function shouldLoadDotenvForScripts(): boolean {
  return (
    typeof process !== 'undefined' &&
    typeof process.cwd === 'function' &&
    !process.env.NEXT_RUNTIME
  );
}

/**
 * Load `.env` files for Node scripts (tsx/ts-node/drizzle-kit), but NOT in Next.js runtime.
 *
 * This module is intended for Node scripts and safe to import as a side effect:
 * `import '@/config/load-dotenv'`
 */
export function loadDotenvForScripts() {
  if (!shouldLoadDotenvForScripts()) {
    return;
  }

  try {
    const require = createRequire(import.meta.url);
    const dotenv = require('dotenv');
    dotenv.config({ path: '.env.development' });
    dotenv.config({ path: '.env', override: false });
  } catch {
    // Silently fail - dotenv might not be available in some environments
  }
}

loadDotenvForScripts();
