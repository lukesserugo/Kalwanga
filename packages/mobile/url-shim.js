// packages/mobile/url-shim.js
//
// Web-only replacement for `whatwg-url-without-unicode`.
//
// Lives at the project root so Metro's default file-map covers it.
// Putting it in a subfolder (e.g. shims/) requires adding that folder
// to watchFolders, which then causes Metro to try to stat the folder
// as a file and warn with ENOENT.

const NativeURL = globalThis.URL;

if (typeof NativeURL !== "function") {
  throw new Error("[url-shim] Native URL is not available");
}

console.log("[url-shim] loaded");

module.exports = NativeURL;
module.exports.URL = NativeURL;
module.exports.default = NativeURL;
module.exports.parseURL = (url, base) => new NativeURL(url, base);
module.exports.basicURLParse = (url, base) => new NativeURL(url, base);
module.exports.serializeURL = (url) => String(url);
