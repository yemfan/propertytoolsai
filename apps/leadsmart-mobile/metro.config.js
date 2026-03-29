import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDefaultConfig } from "expo/metro-config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.disableHierarchicalLookup = true;
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];
// Help pnpm workspace symlinks resolve to `packages/*` source trees.
config.resolver = {
  ...config.resolver,
  unstable_enableSymlinks: true,
};

export default config;
