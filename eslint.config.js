import js from '@eslint/js';
import globals from 'globals';
import babelParser from '@babel/eslint-parser';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

const tsReactParserOptions = {
  requireConfigFile: false,
  babelOptions: {
    presets: [
      '@babel/preset-typescript',
      ['@babel/preset-react', { runtime: 'automatic' }],
    ],
  },
};

const sharedCodeQualityRules = {
  // TypeScript handles symbol/type resolution via `tsc --noEmit`
  'no-undef': 'off',
  'no-redeclare': 'off',
  'no-unused-vars': [
    'warn',
    {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
    },
  ],
  'no-empty': ['warn', { allowEmptyCatch: true }],
  'no-useless-escape': 'warn',
  'no-useless-assignment': 'warn',
  'preserve-caught-error': 'warn',
  'prefer-const': 'warn',
};

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'public/**',
      'UPDATES/**',
      'coverage/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: babelParser,
      parserOptions: tsReactParserOptions,
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...sharedCodeQualityRules,

      // React Hooks rules (React + Vite)
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Vite React Fast Refresh rule
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  {
    files: ['server.ts', 'server/**/*.{ts,js}', 'api/**/*.{ts,js}', 'scripts/**/*.{ts,js}', 'vite.config.ts'],
    languageOptions: {
      parser: babelParser,
      parserOptions: tsReactParserOptions,
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    rules: {
      ...sharedCodeQualityRules,
    },
  },
  {
    files: ['tests/**/*.{ts,tsx}'],
    languageOptions: {
      parser: babelParser,
      parserOptions: tsReactParserOptions,
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2022,
      },
    },
    rules: {
      ...sharedCodeQualityRules,
    },
  },
];
