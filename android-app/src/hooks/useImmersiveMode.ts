/**
 * useImmersiveMode — hides the Android status bar and navigation bar for a
 * true fullscreen game experience (like premium Android games).
 *
 * Both bars are hidden on mount and re-hidden if they reappear (e.g. the user
 * swipes from an edge to temporarily reveal them — Android's "sticky immersive"
 * behavior). The bars slide back out automatically after a few seconds.
 *
 * On iOS/web this is a no-op.
 */
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { setStatusBarHidden } from 'expo-status-bar';
import { NavigationBar, addVisibilityListener } from 'expo-navigation-bar';

export function useImmersiveMode() {
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const hideBars = () => {
      try {
        setStatusBarHidden(true, 'slide');
        NavigationBar.setHidden(true);
      } catch {
        // Library may not be available in all contexts (e.g. Expo Go on older
        // Android). Silently ignore — the config plugin handles the initial
        // state at boot.
      }
    };

    hideBars();

    // Re-hide on app focus (returning from recents/notification shade can
    // restore the bars).
    const subscription = addVisibilityListener(() => {
      hideBars();
    });

    return () => {
      subscription.remove();
    };
  }, []);
}
