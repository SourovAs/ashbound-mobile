/**
 * JavaScript injected into the WebView BEFORE the game loads.
 *
 * It installs a tiny bridge so the existing game (which only uses standard web
 * APIs) can request native capabilities that a bare WebView lacks:
 *
 *   - navigator.vibrate()  -> routed to expo-haptics (Android Vibrator)
 *   - window.__ashboundBridge.post(event) -> generic message channel
 *
 * The game code is NOT modified. It already guards every navigator.vibrate
 * call with `if (navigator.vibrate)`, so overriding the function is enough.
 *
 * Messages are sent via ReactNativeWebView.postMessage as a JSON string and
 * decoded on the native side by GameBridge.
 *
 * This file is exported as a string so it can be passed to WebView's
 * injectedJavaScriptBeforeContentLoaded prop.
 */

export const INJECTED_BRIDGE_JS = String.raw`
(function () {
  'use strict';

  /* ---- Bridge channel (set up FIRST, before anything that can throw) ---- */
  var __bridgeReady = false;
  var __pending = [];

  function send(payload) {
    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        return true;
      }
    } catch (e) { /* best-effort */ }
    return false;
  }

  function flush() {
    while (__pending.length) {
      if (!send(__pending.shift())) break;
    }
  }

  // Public bridge the game *could* call (future native/storage integration).
  window.__ashboundBridge = {
    post: function (event) {
      if (!send(event)) __pending.push(event);
    },
    onNative: function (handler) { window.__ashboundOnNative = handler; }
  };

  // Native -> WebView messages arrive here.
  window.__ashboundDispatchNative = function (raw) {
    try {
      var msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (typeof window.__ashboundOnNative === 'function') window.__ashboundOnNative(msg);
    } catch (e) { /* ignore malformed */ }
  };

  /* ---- Haptics: route navigator.vibrate() to native ---- */
  try {
    if (typeof navigator !== 'undefined') {
      navigator.vibrate = function (pattern) {
        send({ kind: 'haptic', ms: typeof pattern === 'number' ? pattern : 0 });
        return true;
      };
    }
  } catch (e) { /* navigator may be read-only on some webviews */ }

  /* ---- Ready signal (with retry) ----
     The native shell hides its boot splash when it receives {kind:'ready'}.
     We send it on DOMContentLoaded AND on load, and also retry a few times
     in case ReactNativeWebView wasn't ready on the first attempt. */
  var __readySent = false;
  function announceReady() {
    if (__readySent) return;
    if (send({ kind: 'ready' })) {
      __readySent = true;
      __bridgeReady = true;
      flush();
    }
  }
  // Retry loop: try every 300ms for up to 5 seconds.
  var __readyTries = 0;
  var __readyTimer = setInterval(function () {
    if (__readySent || __readyTries >= 16) { clearInterval(__readyTimer); return; }
    __readyTries++;
    announceReady();
  }, 300);

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    announceReady();
  } else {
    document.addEventListener('DOMContentLoaded', announceReady);
    window.addEventListener('load', announceReady);
  }

  /* ---- Error reporting ---- */
  window.addEventListener('error', function (e) {
    send({ kind: 'error', message: String(e && e.message ? e.message : e), source: String(e && e.filename || '') });
  });
  window.addEventListener('unhandledrejection', function (e) {
    send({ kind: 'error', message: 'Unhandled promise rejection: ' + String(e && e.reason) });
  });

  /* ---- Viewport fix (deferred until <head> exists) ----
     When HTML is loaded via source={{ html }} on Android, the layout viewport
     can default to a wide "desktop" width (e.g. 980px) instead of the device
     width. This makes absolutely-positioned touch controls appear centered
     instead of in the corners. We fix it by ensuring a correct viewport meta
     tag and pinning html/body/#root to 100vw/100vh.

     IMPORTANT: This MUST be deferred — document.head is null when
     injectedJavaScriptBeforeContentLoaded runs, so calling appendChild
     immediately would throw and kill the whole IIFE. */
  function fixViewport() {
    try {
      var head = document.head;
      if (!head) return false;

      var desired = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
      var existing = document.querySelector('meta[name="viewport"]');
      if (!existing) {
        var meta = document.createElement('meta');
        meta.name = 'viewport';
        meta.content = desired;
        head.appendChild(meta);
      } else if (existing.getAttribute('content') !== desired) {
        existing.setAttribute('content', desired);
      }

      if (!document.getElementById('__ashboundViewportFix')) {
        var style = document.createElement('style');
        style.id = '__ashboundViewportFix';
        style.textContent = [
          'html, body, #root {',
          '  width: 100vw !important;',
          '  height: 100vh !important;',
          '  margin: 0 !important;',
          '  padding: 0 !important;',
          '  overflow: hidden !important;',
          '}',
          'body { position: fixed !important; top: 0; left: 0; right: 0; bottom: 0; }'
        ].join('\n');
        head.appendChild(style);
      }
      return true;
    } catch (e) { /* non-fatal */ }
    return false;
  }
  // Try immediately (might work if head already exists), then retry until it does.
  if (!fixViewport()) {
    var __vpTimer = setInterval(function () {
      if (fixViewport()) clearInterval(__vpTimer);
    }, 50);
    // Give up after 5 seconds.
    setTimeout(function () { clearInterval(__vpTimer); }, 5000);
  }
})();
true;
`;
