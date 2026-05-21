// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// react-native-svg's "react-native" entry points to TypeScript source
// that uses react-native/Libraries/Types/CodegenTypes — a subpath blocked
// by RN 0.81's package-exports map.  Point Metro at the pre-compiled
// CommonJS build instead so all relative imports stay inside lib/commonjs.
config.resolver.assetExts = [...config.resolver.assetExts, 'wasm'];

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'react-native-svg': path.resolve(
    __dirname,
    'node_modules/react-native-svg/lib/commonjs/index.js'
  ),
};

module.exports = config;
