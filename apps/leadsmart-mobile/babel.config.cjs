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
    ],
  };
};
