// packages/mobile/polyfills.js
//
// TextDecoder / TextEncoder polyfill for react-native-web.
//
// `whatwg-url-without-unicode` (pulled in by expo-router and Clerk)
// captures `TextDecoder` at its own module-evaluation time. If it's
// undefined then, URL construction crashes later with:
//   "Cannot read properties of undefined (reading 'decode')"
// at url-state-machine.js.
//
// react-native-web does not provide a spec-compliant TextDecoder, so
// we install one as early as possible. This module is injected via
// metro.config.js -> transformer.getModulesRunBeforeMainModule so it
// runs BEFORE Metro's prelude, before expo-router, and before Clerk.

// ============================================================
// 1. Install the real `text-encoding` implementation if available.
// ============================================================

let installedReal = false;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const encoding = require("text-encoding");
  const RealDecoder = encoding.TextDecoder;
  const RealEncoder = encoding.TextEncoder;

  if (typeof RealDecoder === "function" && typeof RealEncoder === "function") {
    globalThis.TextDecoder = RealDecoder;
    globalThis.TextEncoder = RealEncoder;

    // Some libraries read `global.*` instead of `globalThis.*`.
    if (typeof global !== "undefined") {
      global.TextDecoder = RealDecoder;
      global.TextEncoder = RealEncoder;
    }

    installedReal = true;
  }
} catch (err) {
  // eslint-disable-next-line no-console
  console.warn(
    "[polyfills] text-encoding unavailable, using inline fallback:",
    err && err.message ? err.message : err
  );
}

// ============================================================
// 2. Fallback decoder / encoder.
// ============================================================
//
// We install the fallback whenever the current global is missing OR
// lacks a usable `decode` method. The check is on the method, not on
// the constructor, because a half-defined stub is worse than nothing
// — it makes libraries think TextDecoder is available, then crash
// when they call `.decode`.

function installFallbackDecoder() {
  const existing = globalThis.TextDecoder;
  const hasWorkingDecode =
    existing && typeof existing.prototype?.decode === "function";

  if (hasWorkingDecode) return;

  const FallbackDecoder = class TextDecoder {
    constructor(encoding) {
      this.encoding = (encoding || "utf-8").toLowerCase();
    }
    decode(buf) {
      if (buf == null) return "";
      if (typeof buf === "string") return buf;

      let bytes;
      if (buf instanceof Uint8Array) {
        bytes = buf;
      } else if (buf instanceof ArrayBuffer) {
        bytes = new Uint8Array(buf);
      } else if (ArrayBuffer.isView(buf)) {
        bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
      } else if (Array.isArray(buf)) {
        bytes = new Uint8Array(buf);
      } else {
        return String(buf);
      }

      // Minimal UTF-8 decoder. `whatwg-url-without-unicode` only
      // decodes ASCII-compatible URL bytes, so a full UTF-8 decoder
      // isn't necessary — but we handle multi-byte sequences anyway
      // to avoid corrupting non-ASCII input.
      let out = "";
      let i = 0;
      while (i < bytes.length) {
        const b0 = bytes[i++];
        if (b0 < 0x80) {
          out += String.fromCharCode(b0);
          continue;
        }
        if (b0 < 0xc0) {
          // Continuation byte where a lead byte was expected — skip.
          continue;
        }
        if (b0 < 0xe0) {
          const b1 = bytes[i++] & 0x3f;
          out += String.fromCharCode(((b0 & 0x1f) << 6) | b1);
          continue;
        }
        if (b0 < 0xf0) {
          const b1 = bytes[i++] & 0x3f;
          const b2 = bytes[i++] & 0x3f;
          out += String.fromCharCode(
            ((b0 & 0x0f) << 12) | (b1 << 6) | b2
          );
          continue;
        }
        // 4-byte sequence → surrogate pair.
        const b1 = bytes[i++] & 0x3f;
        const b2 = bytes[i++] & 0x3f;
        const b3 = bytes[i++] & 0x3f;
        const codePoint =
          ((b0 & 0x07) << 18) |
          (b1 << 12) |
          (b2 << 6) |
          b3;
        const high = 0xd800 + ((codePoint - 0x10000) >> 10);
        const low = 0xdc00 + ((codePoint - 0x10000) & 0x3ff);
        out += String.fromCharCode(high, low);
      }
      return out;
    }
  };

  globalThis.TextDecoder = FallbackDecoder;
  if (typeof global !== "undefined") global.TextDecoder = FallbackDecoder;
}

function installFallbackEncoder() {
  const existing = globalThis.TextEncoder;
  const hasWorkingEncode =
    existing && typeof existing.prototype?.encode === "function";

  if (hasWorkingEncode) return;

  const FallbackEncoder = class TextEncoder {
    encode(str) {
      const s = str == null ? "" : String(str);
      const out = [];
      for (let i = 0; i < s.length; i++) {
        let code = s.charCodeAt(i);
        if (code >= 0xd800 && code <= 0xdbff && i + 1 < s.length) {
          const next = s.charCodeAt(i + 1);
          if (next >= 0xdc00 && next <= 0xdfff) {
            code = ((code - 0xd800) << 10) + (next - 0xdc00) + 0x10000;
            i++;
          }
        }
        if (code < 0x80) {
          out.push(code);
        } else if (code < 0x800) {
          out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
        } else if (code < 0x10000) {
          out.push(
            0xe0 | (code >> 12),
            0x80 | ((code >> 6) & 0x3f),
            0x80 | (code & 0x3f)
          );
        } else {
          out.push(
            0xf0 | (code >> 18),
            0x80 | ((code >> 12) & 0x3f),
            0x80 | ((code >> 6) & 0x3f),
            0x80 | (code & 0x3f)
          );
        }
      }
      return new Uint8Array(out);
    }
  };

  globalThis.TextEncoder = FallbackEncoder;
  if (typeof global !== "undefined") global.TextEncoder = FallbackEncoder;
}

installFallbackDecoder();
installFallbackEncoder();

// ============================================================
// 3. Buffer shim.
// ============================================================
//
// `whatwg-url-without-unicode` tries several decoding strategies.
// If TextDecoder is somehow still unavailable when it evaluates, it
// falls back to a `Buffer`-based path. react-native-web provides a
// partial Buffer, but not the `Buffer.from` overloads this library
// needs, so we ensure at least a minimal one exists.

if (typeof globalThis.Buffer === "undefined") {
  const BufferShim = {
    from(input, encoding) {
      if (typeof input === "string") {
        if (encoding === "base64") {
          // Minimal base64 decoder.
          const chars =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
          const clean = input.replace(/[^A-Za-z0-9+/=]/g, "");
          const bytes = [];
          let buffer = 0;
          let bits = 0;
          for (let i = 0; i < clean.length; i++) {
            const c = clean.charAt(i);
            if (c === "=") break;
            const val = chars.indexOf(c);
            if (val === -1) continue;
            buffer = (buffer << 6) | val;
            bits += 6;
            if (bits >= 8) {
              bits -= 8;
              bytes.push((buffer >> bits) & 0xff);
            }
          }
          return new Uint8Array(bytes);
        }
        const bytes = new Uint8Array(input.length);
        for (let i = 0; i < input.length; i++) {
          bytes[i] = input.charCodeAt(i) & 0xff;
        }
        return bytes;
      }
      if (input instanceof ArrayBuffer) return new Uint8Array(input);
      if (input instanceof Uint8Array) return input;
      if (ArrayBuffer.isView(input)) {
        return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
      }
      if (Array.isArray(input)) return new Uint8Array(input);
      return new Uint8Array(0);
    },
  };

  globalThis.Buffer = BufferShim;
  if (typeof global !== "undefined" && !global.Buffer) {
    global.Buffer = BufferShim;
  }
}

// ============================================================
// 4. Diagnostic.
// ============================================================
//
// This line tells you WHEN the polyfill ran. If you don't see it
// in the browser console before the first Clerk log, the polyfill
// is not being injected early enough, and
// `metro.config.js -> getModulesRunBeforeMainModule` needs fixing.

// eslint-disable-next-line no-console
console.log(
  "[polyfills] source:",
  installedReal ? "text-encoding" : "inline-fallback",
  "| TextDecoder.decode:",
  typeof globalThis.TextDecoder?.prototype?.decode,
  "| TextEncoder.encode:",
  typeof globalThis.TextEncoder?.prototype?.encode,
  "| Buffer:",
  typeof globalThis.Buffer
);
