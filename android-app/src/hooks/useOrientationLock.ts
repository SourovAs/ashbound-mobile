/**
 * Locks the device to landscape orientation on mount and restores the previous
 * lock on unmount. The app.json `orientation: "landscape"` handles the initial
 * launch orientation at the Activity level; this hook enforces it at runtime
 * (e.g. if the user somehow rotates).
 */
import { useEffect } from 'react';
import * as ScreenOrientation from 'expo-screen-orientation';

export function useOrientationLock(): void {
  useEffect(() => {
    let locked = false;
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE)
      .then(() => {
        locked = true;
      })
      .catch(() => {
        // Some devices/configs reject the lock; the manifest lock is the
        // authoritative fallback. Non-fatal.
      });
    return () => {
      if (locked) {
        ScreenOrientation.unlockAsync().catch(() => undefined);
      }
    };
  }, []);
}
