import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
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
      "postcss.config.mjs",
      "tailwind.config.js",
      "components.json",
      "prisma/",
      "scripts/",
    ],
  },
];

export default eslintConfig;
