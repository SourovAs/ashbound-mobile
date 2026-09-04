/**
 * App lifecycle integration.
 *
 * Mirrors the game's existing visibilitychange handling (it suspends audio when
 * hidden) by notifying the WebView when the native app is backgrounded/
 * foregrounded. The injected bridge forwards these as native->webview messages
 * so the game can pause/resume its runtime and audio without any code changes
 * beyond listening on window.__ashboundOnNative.
 *
 * Also keeps the screen awake while the app is foregrounded (gameplay).
 */
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import type { WebView } from 'react-native-webview';

export function useLifecycle(webViewRef: React.RefObject<WebView | null>): void {
  useKeepAwake();

  // Track whether the webview is ready to receive native->web messages.
  const readyRef = useRef(false);

  useEffect(() => {
    const sendToWeb = (type: string) => {
      const webview = webViewRef.current;
      if (!webview) return;
      webview.injectJavaScript(
        `try{window.__ashboundDispatchNative&&window.__ashboundDispatchNative(JSON.stringify({type:${JSON.stringify(type)}}));}catch(e){}true;`,
      );
    };

    const onChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        sendToWeb('resume');
      } else if (nextState === 'inactive' || nextState === 'background') {
        sendToWeb('pause');
      }
    };

    const subscription = AppState.addEventListener('change', onChange);
    return () => subscription.remove();
  }, [webViewRef]);

  // Expose readyRef so the host can mark readiness (used to gate early msgs).
  return undefined;
}
