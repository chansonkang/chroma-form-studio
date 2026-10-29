import {defaults, sanitizeParams} from './state.js';

// The old session predates the approved soft-candy default. Keep it intact for
// explicit recovery, rather than letting it silently replace the new first run.
export const PROJECT_KEY = 'chroma-project-v3';
export const LEGACY_PROJECT_KEY = 'chroma-project-v2';
export function resolveStartupProject(current, legacy) {
  return {
    params: current ? sanitizeParams(current) : {...defaults},
    legacy: legacy ? sanitizeParams(legacy) : null,
  };
}
