// eslint.config.js
const reactPlugin = require('eslint-plugin-react');
const reactNativePlugin = require('eslint-plugin-react-native');
const typescriptEslintPlugin = require('@typescript-eslint/eslint-plugin');
const parser = require('@typescript-eslint/parser');

module.exports = [
  // Language options and parser settings
  {
    files: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: parser, // Use the TypeScript parser
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        'React': 'readonly',
        'ReactNative': 'readonly',
        'jest': 'readonly',
      },
    },
  },

  // Plugins section - define the plugins directly
  {
    plugins: {
      react: reactPlugin, // Reference the react plugin correctly
      'react-native': reactNativePlugin,
      '@typescript-eslint': typescriptEslintPlugin,
    },
  },

  // Custom rules
  {
    rules: {
      // ESLint recommended rules
      'no-unused-vars': 'off', // Corresponds to eslint:recommended
      'no-console': 'warn', // Corresponds to eslint:recommended
      'eqeqeq': 'error', // Corresponds to eslint:recommended

      // React rules
      'react/react-in-jsx-scope': 'error', // React 17+ doesn't require React to be in scope
      'react/jsx-uses-react': 'error', // Prevent unused React in JSX
      'react/jsx-uses-vars': 'error', // Prevent unused variables in JSX
      'react/prop-types': 'off', // Since you're likely using TypeScript, you can turn off prop-types rule

      // React Native rules
      'react-native/no-inline-styles': 'warn', // Avoid inline styles in React Native

      // TypeScript rules
      '@typescript-eslint/no-unused-vars': 'warn', // TypeScript-specific linting
      '@typescript-eslint/explicit-module-boundary-types': 'off', // Customize TypeScript rules as needed

    },
  },

  // React settings (this helps ESLint detect React version automatically)
  {
    settings: {
      react: {
        version: 'detect', // Automatically detect the React version
      },
    },
  },
];
