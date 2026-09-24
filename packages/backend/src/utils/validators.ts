// packages/backend/src/utils/validators.ts
//
// ⚠️ This file is a thin re-export shim.
//
// The schema definitions live in `@pos/shared`, a workspace package
// consumed by backend, web, mobile, desktop, and scanner.
//
// Keeping this file as a passthrough preserves every existing
// `import { ... } from '../utils/validators.js'` call site in the
// backend without touching a single controller.
//
// If you need to change a schema, do it in:
//     packages/shared/src/schemas/<name>.ts
// NEVER here.

export * from "@pos/shared";
export { default } from "@pos/shared";
