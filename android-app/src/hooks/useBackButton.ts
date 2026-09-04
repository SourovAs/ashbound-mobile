/**
 * Android hardware back button handling.
 *
 * The game runs inside a WebView and manages its own in-game navigation
 * (menu -> levels -> game -> pause, etc.) entirely in React within the WebView.
 * We expose a small protocol so the WebView can tell the native shell whether
 * it is at a root screen: when it is, back exits the app; otherwise back is
 * delegated into the WebView so the game can handle it (e.g. close pause menu).
 *
 * The game signals root-state via the bridge:
 *   { kind: 'nav', atRoot: boolean }
 * The native shell injects a synthetic back event back into the WebView:
 *   window.__ashboundDispatchNative({ type: 'back' })
 */
import { useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';
import type { WebView } from 'react-native-webview';

export function useBackButton(
  webViewRef: React.RefObject<WebView | null>,
  atRootRef: React.RefObject<boolean>,
): void {
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      const webview = webViewRef.current;
      if (!webview) return false;
      if (atRootRef.current) {
        // At a root screen — let the system exit/ background the app.
        return false;
      }
      // Delegate into the WebView so the game can pop its own navigation.
      webview.injectJavaScript(
        'try{window.__ashboundDispatchNative&&window.__ashboundDispatchNative(JSON.stringify({type:"back"}));}catch(e){}true;',
      );
      return true; // we handled it
    });
    return () => subscription.remove();
  }, [webViewRef, atRootRef]);
}
