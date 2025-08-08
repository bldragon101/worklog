import { FlatCompat } from '@eslint/eslintrc';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: [
      '.next/',
      'node_modules/',
      'dist/',
      'build/',
      'out/',
      'public/',
      'eslint.config.mjs',
      'next.config.ts',
      'postcss.config.mjs',
      'tailwind.config.js',
      'components.json',
      'prisma/',
      'scripts/'
    ]
  }
];