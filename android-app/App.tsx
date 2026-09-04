/**
 * ASHBOUND: The Last Flame — Android application shell.
 *
 * Architecture:
 *   Expo + React Native (this file) -> react-native-webview -> locally bundled
 *   React + Three.js game (untouched).
 *
 * This shell owns: native splash, orientation lock, Android back button,
 * app lifecycle, haptics bridging, and loading/error states. All gameplay lives
 * inside the WebView.
 */
import { useEffect, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';

import { GameWebView } from './src/GameWebView';

// Prevent the native splash from auto-hiding; we hide it once the WebView host
// has mounted so there is no gap between native splash and the boot overlay.
SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function App() {
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    // The native splash only needs to stay until the first RN frame is painted.
    // GameWebView renders its own BootSplash overlay for the rest of the load.
    const t = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => undefined);
      setAppReady(true);
    }, 200);
    return () => clearTimeout(t);
  }, []);

  if (!appReady) return null;

  return <GameWebView />;
}
