// packages/mobile/metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// ============================================================
// MONOREPO RESOLUTION
// ============================================================

config.watchFolders = [
  workspaceRoot,
  path.resolve(workspaceRoot, "packages/shared"),
  // NOTE: do NOT add projectRoot/shims here. projectRoot is watched
  // by default and adding a subfolder causes Metro to try to read
  // the directory as a file, producing ENOENT warnings.
];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

config.resolver.extraNodeModules = {
  "@pos/shared": path.resolve(workspaceRoot, "packages/shared/src"),
};

// ============================================================
// POLYFILL ORDERING (serializer, not transformer)
// ============================================================

config.serializer.getModulesRunBeforeMainModule = () => [
  path.resolve(projectRoot, "polyfills.js"),
];

// ============================================================
// WEB-ONLY: whatwg-url-without-unicode → native URL shim
// ============================================================
// The shim now lives at packages/mobile/url-shim.js — directly in
// projectRoot, which Metro's file-map always covers.

const nativeUrlShim = path.resolve(projectRoot, "url-shim.js");

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    platform === "web" &&
    (moduleName === "whatwg-url-without-unicode" ||
      moduleName.startsWith("whatwg-url-without-unicode/"))
  ) {
    return {
      type: "sourceFile",
      filePath: nativeUrlShim,
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
