/**
 * Fallback rotate prompt. Normally the runtime orientation lock + manifest
 * `orientation: landscape` keep the app in landscape. This overlay is shown
 * only if the lock could not be applied and the device is in portrait, so the
 * user is never stuck looking at a sideways game.
 */
import { StyleSheet, View, Text } from 'react-native';

export function RotatePrompt() {
  return (
    <View style={styles.root}>
      <View style={styles.device}>
        <View style={styles.dot} />
      </View>
      <Text style={styles.title}>Rotate your device</Text>
      <Text style={styles.body}>
        ASHBOUND is played in landscape. Turn your device sideways to continue the journey.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0b0c10',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    zIndex: 15,
  },
  device: {
    width: 96,
    height: 64,
    borderWidth: 1,
    borderColor: '#4a463f',
    backgroundColor: '#13151b',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#f59e2b',
  },
  title: {
    color: '#e7e2d6',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  body: {
    color: '#9a958c',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
