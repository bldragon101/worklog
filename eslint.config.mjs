import nextConfig from "eslint-config-next";

export default [
  ...nextConfig,
  {
    ignores: [
      ".next/",
      "node_modules/",
      "dist/",
      "build/",
      "out/",
      "public/",
      "eslint.config.mjs",
      "next.config.ts",
      "next-env.d.ts",
      "postcss.config.mjs",
      "tailwind.config.js",
      "components.json",
      "prisma/",
      "scripts/",
      "playwright-report/",
      "coverage/",
      "src/generated/",
    ],
  },
];
