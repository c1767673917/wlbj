module.exports = {
  env: {
    node: true,
    browser: true,
    es2021: true,
    jest: true
  },
  extends: [
    'eslint:recommended',
    'plugin:node/recommended',
    'plugin:jest/recommended',
    'prettier'
  ],
  plugins: ['node', 'jest'],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module'
  },
  rules: {
    // 代码质量规则
    'no-console': 'warn',
    'no-debugger': 'error',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-var': 'error',
    'prefer-const': 'error',
    'prefer-arrow-callback': 'error',
    'no-duplicate-imports': 'error',
    'no-useless-return': 'error',
    'no-useless-concat': 'error',
    'no-useless-escape': 'error',

    // 复杂度控制
    'complexity': ['error', 10],
    'max-depth': ['error', 4],
    'max-lines': ['error', 300],
    'max-lines-per-function': ['error', 50],
    'max-params': ['error', 5],
    'max-nested-callbacks': ['error', 3],

    // 异步编程规则
    'prefer-promise-reject-errors': 'error',
    'no-async-promise-executor': 'error',
    'require-await': 'error',
    'no-return-await': 'error',
    'no-await-in-loop': 'warn',

    // 安全规则
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',

    // 性能规则
    'no-loop-func': 'error',
    'no-inner-declarations': 'error',

    // Node.js 特定规则
    'node/no-unpublished-require': 'off',
    'node/no-missing-require': 'error',
    'node/no-extraneous-require': 'error',
    'node/prefer-global/process': 'error',
    'node/prefer-global/buffer': 'error',

    // Jest 测试规则
    'jest/expect-expect': 'error',
    'jest/no-disabled-tests': 'warn',
    'jest/no-focused-tests': 'error',
    'jest/prefer-to-have-length': 'warn',
    'jest/valid-expect': 'error',
    'jest/no-identical-title': 'error',
    'jest/prefer-strict-equal': 'warn'
  },
  overrides: [
    {
      files: ['tests/**/*.js'],
      rules: {
        'no-console': 'off',
        'max-lines-per-function': 'off'
      }
    },
    {
      files: ['migrations/**/*.js', 'seeds/**/*.js'],
      rules: {
        'node/no-unpublished-require': 'off'
      }
    },
    {
      // 前端代码特定规则
      files: ['frontend/**/*.{js,jsx,ts,tsx}', '**/*.{jsx,tsx}'],
      env: {
        browser: true,
        node: false
      },
      extends: [
        'eslint:recommended',
        '@typescript-eslint/recommended'
      ],
      parser: '@typescript-eslint/parser',
      plugins: ['@typescript-eslint', 'react', 'react-hooks'],
      rules: {
        // React 特定规则
        'react/jsx-uses-react': 'error',
        'react/jsx-uses-vars': 'error',
        'react/prop-types': 'off', // 使用 TypeScript
        'react-hooks/rules-of-hooks': 'error',
        'react-hooks/exhaustive-deps': 'warn',

        // TypeScript 特定规则
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/no-explicit-any': 'warn',
        '@typescript-eslint/prefer-const': 'error',

        // 浏览器环境规则
        'no-console': 'warn', // 前端允许console但警告
        'node/no-missing-require': 'off', // 前端不使用require
        'node/no-extraneous-require': 'off'
      }
    },
    {
      // 配置文件特定规则
      files: ['*.config.js', '*.config.ts', 'vite.config.*', 'tailwind.config.*'],
      rules: {
        'no-console': 'off',
        'node/no-unpublished-require': 'off'
      }
    }
  ]
};
