/**
 * Native boot splash shown over the WebView while the bundled game loads.
 * Mirrors the in-game BootSplash aesthetic (flame on charcoal) so the
 * transition from native splash -> this overlay -> game is seamless.
 */
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { useEffect, useRef } from 'react';

export function BootSplash({ visible }: { visible: boolean }) {
  const fade = useRef(1);

  // Keep the component mounted but invisible once hidden so React Native can
  // unmount it after the WebView is interactive without a flash.
  useEffect(() => {
    if (!visible) fade.current = 0;
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={styles.root} pointerEvents="none">
      <View style={styles.flame} />
      <Text style={styles.title}>
        Ash<Text style={styles.accent}>bound</Text>
      </Text>
      <Text style={styles.sub}>Kindling the last flame…</Text>
      <ActivityIndicator style={styles.spinner} color="#ea6a1a" size="small" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0b0c10',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  flame: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ea6a1a',
    marginBottom: 16,
    shadowColor: '#ea6a1a',
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  title: {
    color: '#e7e2d6',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 2,
  },
  accent: {
    color: '#f59e2b',
  },
  sub: {
    color: '#6b6760',
    fontSize: 10,
    marginTop: 4,
    letterSpacing: 1,
  },
  spinner: {
    marginTop: 18,
  },
});
