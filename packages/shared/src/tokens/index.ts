// packages/shared/src/tokens/index.ts
//
// Barrel for @pos/shared/tokens.
//
// These values are consumed by:
//   - Web:   via `packages/web/tailwind.config.js` (as a Tailwind preset)
//   - Mobile: via plain StyleSheet — the values are identical.

export * from './colors';
export * from './typography';
export * from './spacing';
export * from './shadows';
export * from './z-index';
export * from './animation';

export { preset, default } from './tailwind-preset';
