/**
 * GameWebView — the host for the existing React + Three.js game.
 *
 * Loads the locally-bundled, fully self-contained game build (a single HTML
 * string produced by scripts/build-game.js -> src/gameBundle.ts) into a
 * react-native-webview. Wires up:
 *   - the injected bridge (haptics, ready signal, error reporting)
 *   - Android hardware back button delegation
 *   - app lifecycle pause/resume forwarding
 *
 * The game itself is untouched; it runs exactly as it does in a browser.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from 'react-native-webview';
import { StatusBar } from 'expo-status-bar';
import { NavigationBar } from 'expo-navigation-bar';

import { GAME_HTML } from './gameBundle';
import { INJECTED_BRIDGE_JS } from './bridge/injectedJs';
import { createBridgeDispatcher, parseBridgeMessage } from './bridge/GameBridge';
import { useBackButton } from './hooks/useBackButton';
import { useImmersiveMode } from './hooks/useImmersiveMode';
import { useLifecycle } from './hooks/useLifecycle';
import { useOrientationLock } from './hooks/useOrientationLock';
import { BootSplash } from './ui/BootSplash';
import { ErrorScreen } from './ui/ErrorScreen';
import { RotatePrompt } from './ui/RotatePrompt';

type LoadState = 'loading' | 'ready' | 'error';

export function GameWebView() {
  const webViewRef = useRef<WebView | null>(null);
  const atRootRef = useRef(true); // game starts at the main menu (root)
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const { width, height } = useWindowDimensions();
  const isPortrait = height > width;

  useOrientationLock();
  useLifecycle(webViewRef);
  useBackButton(webViewRef, atRootRef);
  useImmersiveMode();

  // Fallback: if the bridge's `ready` message never arrives within 8s, hide
  // the boot splash anyway so the user isn't stuck on an infinite loader.
  useEffect(() => {
    if (loadState !== 'loading') return;
    const t = setTimeout(() => setLoadState('ready'), 8000);
    return () => clearTimeout(t);
  }, [loadState]);

  const dispatch = useMemo(
    () =>
      createBridgeDispatcher({
        onReady: () => setLoadState('ready'),
        onError: (message: string) => {
          setErrorMessage(message);
          if (loadState === 'loading') setLoadState('error');
        },
      }),
    [loadState],
  );

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const raw = event.nativeEvent.data;
      const msg = parseBridgeMessage(raw);
      if (msg?.kind === 'nav') {
        atRootRef.current = msg.atRoot;
        return;
      }
      dispatch(raw);
    },
    [dispatch],
  );

  const onNavigationStateChange = useCallback((_nav: WebViewNavigation) => {
    // Single-page app; no external navigation to follow.
  }, []);

  const reload = useCallback(() => {
    setLoadState('loading');
    setErrorMessage('');
    webViewRef.current?.reload();
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar hidden animated style="light" />
      <NavigationBar hidden style="light" />
      <WebView
        ref={webViewRef}
        source={{ html: GAME_HTML, baseUrl: 'webview://ashbound/game/' }}
        style={styles.webview}
        originWhitelist={['*']}
        injectedJavaScriptBeforeContentLoaded={INJECTED_BRIDGE_JS}
        onMessage={onMessage}
        onNavigationStateChange={onNavigationStateChange}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        scrollEnabled={false}
        bounces={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        // Android: let the viewport meta tag control scaling (not the WebView's
        // legacy scalesPageToFit). Without this, source={{ html }} can default
        // to a 980px-wide "desktop" viewport, pushing touch controls toward the
        // screen center instead of the corners.
        scalesPageToFit={false}
        containerStyle={styles.webview}
        onError={(e: { nativeEvent: { description?: string } }) => {
          setErrorMessage(e.nativeEvent.description || 'WebView failed to load.');
          setLoadState('error');
        }}
      />

      {isPortrait && loadState !== 'error' ? <RotatePrompt /> : null}
      {loadState === 'loading' ? <BootSplash visible /> : null}
      {loadState === 'error' ? (
        <ErrorScreen message={errorMessage} onRetry={reload} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0b0c10',
  },
  webview: {
    flex: 1,
    backgroundColor: '#0b0c10',
  },
});
