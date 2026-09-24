const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [
  workspaceRoot,
  path.resolve(workspaceRoot, "packages/shared"),
  path.resolve(workspaceRoot, "packages/tokens"),
];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

config.resolver.extraNodeModules = {
  "@pos/shared": path.resolve(workspaceRoot, "packages/shared/src"),
  "@pos/tokens": path.resolve(workspaceRoot, "packages/tokens/src"),
};

module.exports = config;
