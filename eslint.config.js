const globals = require('globals');

const REPAIRED_SCOPE = [
  'server.js',
  'src/app.js',
  'src/config/**/*.js',
  'src/jobs/**/*.js',
  'src/middleware/**/*.js',
  'src/utils/**/*.js',
  'src/modules/auth/**/*.js',
  'src/modules/email/**/*.js',
  'src/modules/employees/**/*.js',
  'src/modules/exports/export.controller.js',
  'src/modules/exports/export.routes.js',
  'src/modules/leave/**/*.js',
  'src/modules/notification/**/*.js',
  'src/modules/outbox/**/*.js',
  'src/modules/payroll/**/*.js',
  'src/modules/users/**/*.js',
  'test/**/*.js',
  'eslint.config.js'
];

module.exports = [
  {
    files: process.env.LINT_ALL === 'true' ? ['**/*.js'] : REPAIRED_SCOPE,
    ignores: ['node_modules/**', 'storage/**'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: { ...globals.node }
    },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      'no-undef': 'error'
    }
  }
];
