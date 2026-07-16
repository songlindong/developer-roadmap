module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  extends: ['eslint:recommended'],
  plugins: ['react'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  rules: {
    'no-unused-vars': ['error', { argsIgnorePattern: '^(_|node$)' }],
    'react/jsx-uses-react': 'error',
    'react/jsx-uses-vars': 'error',
  },
};
