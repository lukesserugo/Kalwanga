// packages/mobile/app.config.ts
import { ExpoConfig, ConfigContext } from "expo/config";
import * as path from "node:path";
import * as fs from "node:fs";
import * as dotenv from "dotenv";

// ============================================================
// ROOT .env LOADER
// ============================================================
//
// Reads EXPO_PUBLIC_* variables from the monorepo root .env
// (D:\Projects\Kalwanga\.env) and surfaces them through
// `extra`, which is serialized into the bundle and readable
// at runtime via `expo-constants`.
//
// Expo's built-in loader only reads `.env*` files that sit
// next to this app's package.json, so it cannot see the root
// file. We read it ourselves.

function findRootEnv(startDir: string): string | null {
  let dir = startDir;
  let fallback: string | null = null;
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

const INVALID = new Set(["", "undefined", "null", "None"]);

function isValidEnvValue(v: unknown): v is string {
  if (typeof v !== "string") return false;
  return !INVALID.has(v.trim());
}

const rootEnvPath = findRootEnv(__dirname);
const rootEnv: Record<string, string> = rootEnvPath
  ? dotenv.parse(fs.readFileSync(rootEnvPath, "utf8"))
  : {};

const publicVarsFromRoot: Record<string, string> = {};
const rejected: string[] = [];

for (const [key, value] of Object.entries(rootEnv)) {
  if (!key.startsWith("EXPO_PUBLIC_")) continue;
  if (!isValidEnvValue(value)) {
    rejected.push(`${key}=${JSON.stringify(value)}`);
    continue;
  }
  publicVarsFromRoot[key] = value.trim();
}

if (rejected.length > 0) {
  console.warn(
    "[app.config] Rejected malformed EXPO_PUBLIC_* entries in root .env:\n" +
      rejected.map((l) => `  ${l}`).join("\n")
  );
}

console.log(
  "[app.config] root .env:",
  rootEnvPath ?? "(not found)",
  "| accepted EXPO_PUBLIC_* keys:",
  Object.keys(publicVarsFromRoot)
);

// ============================================================
// STATIC CONFIG
// ============================================================
//
// Migrated from app.json. In app.config.ts we return these
// fields UNWRAPPED — no top-level "expo" key. `ConfigContext`
// provides the unwrapped baseline.

const staticConfig: Omit<ExpoConfig, "extra"> = {
  name: "POS System",
  slug: "pos-system",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "pos",
  userInterfaceStyle: "automatic",
  splash: {
    image: "./assets/images/splash.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  assetBundlePatterns: ["**/*"],
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.pos.system",
    buildNumber: "1.0.0",
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
    package: "com.pos.system",
    versionCode: 1,
  },
  web: {
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-barcode-scanner",
    "expo-camera",
    "expo-secure-store",
    "expo-notifications",
    "expo-router",
  ],
  experiments: {
    tsconfigPaths: true,
    typedRoutes: true,
  },
};

// ============================================================
// EXPORT
// ============================================================

export default ({ config }: ConfigContext): ExpoConfig => {
  // Precedence for env vars (highest wins):
  //   1. root .env          ← version-controlled source of truth
  //   2. process.env shell  ← CI overrides
  //   3. config.extra       ← any prior resolved extra
  const mergedExtra: Record<string, unknown> = {
    ...(config.extra ?? {}),
  };

  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith("EXPO_PUBLIC_")) continue;
    if (!isValidEnvValue(value)) continue;
    mergedExtra[key] = value;
  }

  for (const [key, value] of Object.entries(publicVarsFromRoot)) {
    mergedExtra[key] = value;
  }

  return {
    // Start from Expo's resolved baseline, which includes internal
    // fields (`_internal`, `sdkVersion`, `platforms`) that are
    // needed at bundle time.
    ...(config as Partial<ExpoConfig>),

    // Then apply our static config. These override anything the
    // resolver derived from a stale source.
    ...staticConfig,

    // Deep-merge the platform blocks so any fields Expo injected
    // (e.g. `ios.infoPlist` from a plugin) survive alongside ours.
    ios: { ...(config.ios ?? {}), ...staticConfig.ios },
    android: { ...(config.android ?? {}), ...staticConfig.android },
    web: { ...(config.web ?? {}), ...staticConfig.web },

    // The extra is entirely ours.
    extra: mergedExtra,
  };
};
