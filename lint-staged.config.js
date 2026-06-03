/**
 * @type {import('lint-staged').Configuration}
 */
export default {
    '*': ['pnpm run check'],
    // Type check (runs once, not per file)
    '*.{ts,tsx}': () => 'pnpm exec tsc --noEmit',
}
