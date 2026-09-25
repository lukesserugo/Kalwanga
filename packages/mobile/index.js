// packages/mobile/index.js
//
// Expo Router entry override.
//
// The TextDecoder polyfill must run BEFORE expo-router's internals are
// evaluated. expo-router's WHATWG URL polyfill captures TextDecoder at
// module initialization, so setting globalThis.TextDecoder after the
// fact is too late — the polyfill has already stored `undefined`.
//
// By overriding the entry point, we guarantee the order:
//   1. ./polyfills       ← sets globalThis.TextDecoder
//   2. expo-router/entry ← now finds a real TextDecoder

require("./polyfills");
require("expo-router/entry");
