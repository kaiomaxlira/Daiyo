module.exports = {
  root: true,
  env: { browser: true, es2021: true },
  extends: ['eslint:recommended', 'plugin:vue/recommended'],
  parser: require.resolve('vue-eslint-parser'),
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', parser: require.resolve('@typescript-eslint/parser') },
  rules: {
    'vue/multi-word-component-names': 'off',
    'vue/require-default-prop': 'off',
  },
}
