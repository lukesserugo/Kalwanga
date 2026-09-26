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
];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Pin React and related singletons to the app's own node_modules.
// Without this, pnpm's strict layout lets expo-router, @expo/metro-runtime,
// and react-dom each resolve their own React copy → "Invalid hook call".
const singletons = [
  "react",
  "react-dom",
  "react-native",
  "expo",
  "expo-router",
  "expo-modules-core",
  "expo-constants",
  "@expo/metro-runtime",
];

config.resolver.extraNodeModules = singletons.reduce(
  (acc, name) => {
    acc[name] = path.resolve(projectRoot, "node_modules", name);
    return acc;
  },
  {
    // Keep the workspace alias you already had
    "@pos/shared": path.resolve(workspaceRoot, "packages/shared/src"),
  }
);

// Required for Metro to follow pnpm's symlinks into .pnpm store
config.resolver.unstable_enableSymlinks = true;

// ============================================================
// POLYFILL ORDERING (serializer, not transformer)
// ============================================================

config.serializer.getModulesRunBeforeMainModule = () => [
  path.resolve(projectRoot, "polyfills.js"),
];

// ============================================================
// WEB-ONLY: whatwg-url-without-unicode → native URL shim
// ============================================================

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
