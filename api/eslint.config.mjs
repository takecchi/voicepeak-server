// @ts-check
import eslint from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'eslint.config.mjs',
      '.lintstagedrc.js',
      'exportOpenAPI.ts',
      'node_modules',
      'dist',
      'test',
      'prisma',
      'coverage',
      'jest.ai-mock.ts',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    plugins: {
      import: importPlugin,
    },
    settings: {
      'import/resolver': {
        typescript: {},
      },
    },
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['jest.setup'],
              message:
                'src/jest.setup.tsはテストファイル（*.spec.ts）でのみインポート可能です。',
            },
          ],
          paths: [],
        },
      ],
      'import/no-restricted-paths': [
        'warn',
        {
          zones: [
            {
              target: './src/shared',
              from: './src',
              except: ['./shared', './types'],
              message: 'sharedからアクセス出来るのはshared, typesのみです',
            },
            {
              target: './src/domains',
              from: './src',
              except: ['./domains', './shared', './types'],
              message:
                'domainsからアクセスできるのはdomains, shared, typesのみです',
            },
            {
              target: './src/features',
              from: './src',
              except: ['./features', './domains', './shared', './types'],
              message:
                'featuresからアクセスできるのはfeatures, domains, shared, typesのみです',
            },
            {
              target: './src/routes',
              from: './src',
              except: [
                './routes',
                './features',
                './domains',
                './shared',
                './types',
              ],
              message:
                'routesからアクセスできるのはroutes, features, domains, shared, typesのみです',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.spec.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
);
