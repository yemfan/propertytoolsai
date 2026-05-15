const path = require("node:path");

const monorepoRoot = path.resolve(__dirname, "../..");

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "module-resolver",
        {
          extensions: [".tsx", ".ts", ".js", ".json"],
          alias: {
            "@leadsmart/shared": path.join(monorepoRoot, "packages/shared/src"),
            "@leadsmart/api-client": path.join(monorepoRoot, "packages/api-client/src"),
          },
        },
      ],
      // CRITICAL: react-native-reanimated/plugin MUST be the last
      // entry in this array. The plugin scans every transformed file
      // for `worklet` directives and inlines them into native bytecode;
      // anything that runs after it sees the already-rewritten AST and
      // breaks the worklet contract. See:
      // https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/installation
      "react-native-reanimated/plugin",
    ],
  };
};
