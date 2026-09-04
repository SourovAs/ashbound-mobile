/**
 * Metro config for the Expo Android shell.
 * Uses the default Expo Metro config — no custom asset extensions needed.
 * The game bundle is imported as a TypeScript string (src/gameBundle.ts).
 */
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
