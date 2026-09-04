/**
 * Full-screen error state shown if the bundled game fails to load or reports an
 * uncaught fatal error from inside the WebView. Offers a retry that reloads the
 * WebView.
 */
import { StyleSheet, View, Text, Pressable } from 'react-native';

export function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.root}>
      <View style={styles.flame} />
      <Text style={styles.title}>The flame faltered</Text>
      <Text style={styles.body}>
        ASHBOUND could not start.{'\n'}
        {message}
      </Text>
      <Pressable style={styles.button} onPress={onRetry} accessibilityRole="button">
        <Text style={styles.buttonText}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0b0c10',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    zIndex: 20,
  },
  flame: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#7a2a10',
    marginBottom: 18,
  },
  title: {
    color: '#e7e2d6',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
    letterSpacing: 1,
  },
  body: {
    color: '#9a958c',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  button: {
    borderColor: '#f59e2b',
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  buttonText: {
    color: '#f59e2b',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
  },
});
