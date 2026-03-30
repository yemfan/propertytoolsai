const path = require("node:path");
const { getDefaultConfig } = require("@expo/metro-config");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

/** @type {import('@expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver = {
  ...config.resolver,
  disableHierarchicalLookup: true,
  nodeModulesPaths: [
    path.resolve(projectRoot, "node_modules"),
    path.resolve(monorepoRoot, "node_modules"),
  ],
  unstable_enableSymlinks: true,
};

module.exports = config;
