/**
 * GameBridge — the native-side decoder for messages arriving from the WebView.
 *
 * The WebView posts JSON strings (see injectedJs.ts). This module parses them
 * and routes each `kind` to the appropriate native handler (haptics, lifecycle,
 * error reporting). It keeps the WebView component free of branching logic.
 *
 * The bridge is intentionally minimal: the existing game is fully self-
 * contained, so the only messages it emits are haptics (via the overridden
 * navigator.vibrate), a one-time `ready` signal, and error reports.
 */

import * as Haptics from 'expo-haptics';

/** A message emitted by the injected bridge inside the WebView. */
export type BridgeMessage =
  | { kind: 'ready' }
  | { kind: 'haptic'; ms: number }
  | { kind: 'error'; message: string; source?: string }
  | { kind: 'nav'; atRoot: boolean };

export interface BridgeHandlers {
  /** Called once when the game signals it is interactive. */
  onReady?: () => void;
  /** Called for every uncaught error reported from the WebView. */
  onError?: (message: string, source?: string) => void;
}

/**
 * Parse a raw postMessage payload into a typed BridgeMessage, or null if it
 * isn't one of ours (the game or other libs may also post messages).
 */
export function parseBridgeMessage(raw: string): BridgeMessage | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const msg = data as Record<string, unknown>;
  switch (msg.kind) {
    case 'ready':
      return { kind: 'ready' };
    case 'haptic':
      return { kind: 'haptic', ms: typeof msg.ms === 'number' ? msg.ms : 0 };
    case 'error':
      return {
        kind: 'error',
        message: typeof msg.message === 'string' ? msg.message : String(msg.message ?? 'Unknown error'),
        source: typeof msg.source === 'string' ? msg.source : undefined,
      };
    case 'nav':
      return { kind: 'nav', atRoot: msg.atRoot === true };
    default:
      return null;
  }
}

/**
 * Create a handler that consumes parsed messages and invokes native effects.
 * Returns a function suitable to pass directly to WebView's onMessage prop
 * (it receives the native event).
 */
export function createBridgeDispatcher(handlers: BridgeHandlers) {
  return (raw: string) => {
    const msg = parseBridgeMessage(raw);
    if (!msg) return;
    switch (msg.kind) {
      case 'ready':
        handlers.onReady?.();
        break;
      case 'haptic':
        triggerHaptic(msg.ms).catch(() => undefined);
        break;
      case 'error':
        handlers.onError?.(msg.message, msg.source);
        break;
    }
  };
}

/**
 * Map a vibration duration (as the game would pass to navigator.vibrate) onto
 * an expo-haptics impact style. Small taps -> light, heavier hits -> medium.
 */
async function triggerHaptic(ms: number): Promise<void> {
  if (ms <= 0) return;
  const style = ms >= 25 ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light;
  await Haptics.impactAsync(style);
}
