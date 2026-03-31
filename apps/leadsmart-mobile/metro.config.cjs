const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Monorepo: keep every folder Expo already watches, then add the repo root (expo-doctor
// requires defaults to remain a subset of watchFolders).
const baseWatch = config.watchFolders ?? [];
config.watchFolders = [...new Set([...baseWatch, monorepoRoot])];

config.resolver = {
  ...config.resolver,
  nodeModulesPaths: [
    path.resolve(projectRoot, "node_modules"),
    path.resolve(monorepoRoot, "node_modules"),
  ],
  // Match Metro defaults (expo-doctor flags pnpm/symlink overrides).
  disableHierarchicalLookup: false,
};
if ("unstable_enableSymlinks" in config.resolver) {
  delete config.resolver.unstable_enableSymlinks;
}

module.exports = config;
