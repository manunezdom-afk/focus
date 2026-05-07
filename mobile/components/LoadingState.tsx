import { ActivityIndicator, StyleSheet, View } from 'react-native';

export function LoadingState() {
  return (
    <View style={styles.box}>
      <ActivityIndicator />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
