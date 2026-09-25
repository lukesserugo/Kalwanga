// packages/mobile/babel.config.js
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

function findRootEnv(startDir) {
  let dir = startDir;
  let fallback = null;
  for (let i = 0; i < 12; i++) {
    const envPath = path.join(dir, ".env");
    const hasEnv = fs.existsSync(envPath);
    const isRoot =
      fs.existsSync(path.join(dir, "pnpm-workspace.yaml")) ||
      fs.existsSync(path.join(dir, "lerna.json"));
    if (hasEnv && isRoot) return envPath;
    if (hasEnv && !fallback) fallback = envPath;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return fallback;
}

const envPath = findRootEnv(__dirname);
const rootEnv = envPath ? dotenv.parse(fs.readFileSync(envPath, "utf8")) : {};

const INVALID = new Set(["", "undefined", "null", "None"]);
const publicKeys = [];

for (const [key, value] of Object.entries(rootEnv)) {
  if (!key.startsWith("EXPO_PUBLIC_")) continue;
  if (!value || INVALID.has(value.trim())) {
    console.warn(`[babel.config] skipping invalid ${key}=${JSON.stringify(value)}`);
    continue;
  }
  process.env[key] = value.trim();
  publicKeys.push(key);
}

console.log(
  "[babel.config] root .env:",
  envPath ?? "(not found)",
  "| inlining:",
  publicKeys
);

module.exports = function (api) {
  // MUST be false. With true, Babel caches the substitution across
  // restarts, and env changes are never picked up.
  api.cache(false);

  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "transform-inline-environment-variables",
        { include: publicKeys },
      ],
    ],
  };
};
