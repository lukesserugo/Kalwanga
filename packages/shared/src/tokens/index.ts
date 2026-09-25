// packages/shared/src/tokens/index.ts
//
// Barrel for @pos/shared/tokens.
//
// These values are consumed by:
//   - Web:   via `packages/web/tailwind.config.js` (see ./tailwind-preset)
//   - Mobile: via plain StyleSheet — the values are identical.
//
// ⚠️ Do NOT re-export from './tailwind-preset'. That file nests
// `colors`, `spacing`, etc. inside a `preset` object, and re-exporting
// it alongside the flat `./colors` and `./spacing` modules causes
// Metro to throw "Cannot redefine property: spacing" at runtime.
// Import the preset directly where needed:
//     require('@pos/shared/tokens/tailwind-preset').default

export * from './colors';
export * from './typography';
export * from './spacing';
export * from './shadows';
export * from './z-index';
export * from './animation';
