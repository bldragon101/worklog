export default [
  {
    extends: ["next/core-web-vitals", "next/typescript"],
    ignorePatterns: [
      ".next/",
      "node_modules/",
      "dist/",
      "build/",
      "out/",
      "public/",
      "eslint.config.mjs",
      "next.config.ts",
      "postcss.config.mjs",
      "tailwind.config.js",
      "components.json",
      "prisma/",
      "scripts/"
    ]
  }
];