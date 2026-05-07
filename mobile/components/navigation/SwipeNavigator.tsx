import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { Keyboard, Platform } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

// Orden estricto de tabs — debe coincidir con (tabs)/_layout.tsx.
const TAB_ORDER = ['index', 'calendar', 'nova', 'tasks', 'settings'] as const;
export type SwipeTabName = (typeof TAB_ORDER)[number];

const TAB_HREFS: Record<SwipeTabName, string> = {
  index: '/(tabs)',
  calendar: '/(tabs)/calendar',
  nova: '/(tabs)/nova',
  tasks: '/(tabs)/tasks',
  settings: '/(tabs)/settings',
};

type Props = {
  currentTab: SwipeTabName;
  children: React.ReactNode;
};

// Wrapper que envuelve el contenido de cada tab y detecta swipes horizontales
// para navegar a la tab anterior/siguiente. Diseñado para sentirse iOS-native:
//
//   · activeOffsetX([-12,12]) — solo activa cuando el dedo se mueve > 12px en X.
//   · failOffsetY([-12,12])   — falla si el usuario empieza vertical, cediendo
//     a ScrollView/FlatList interno.
//   · Damping visual: durante el gesto el contenido se traslada hasta ±50px
//     siguiendo el dedo, dando feedback táctil sin volverse pager-view.
//   · Al soltar: si pasa threshold de distancia (70px) o velocidad (380px/s),
//     dispara navegación y haptic Light. Si no, vuelve a 0 con timing 220ms.
//   · Mientras el teclado está abierto, ignora todos los gestos (evita
//     activarlos accidentalmente cuando el usuario escribe).
//   · Sin nuevas dependencias: usa react-native-gesture-handler y
//     reanimated que ya están instaladas vía Expo.
export function SwipeNavigator({ currentTab, children }: Props) {
  const tabIndex = TAB_ORDER.indexOf(currentTab);
  const translateX = useSharedValue(0);
  // 0 = teclado cerrado, 1 = abierto. Se usa desde el worklet de gesture.
  const keyboardOpen = useSharedValue(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => {
      keyboardOpen.value = 1;
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      keyboardOpen.value = 0;
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardOpen]);

  const goPrev = useCallback(() => {
    const prev = TAB_ORDER[tabIndex - 1];
    if (!prev) return;
    if (Platform.OS === 'ios') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.navigate(TAB_HREFS[prev] as never);
  }, [tabIndex]);

  const goNext = useCallback(() => {
    const next = TAB_ORDER[tabIndex + 1];
    if (!next) return;
    if (Platform.OS === 'ios') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.navigate(TAB_HREFS[next] as never);
  }, [tabIndex]);

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-12, 12])
    .onChange((e) => {
      if (keyboardOpen.value === 1) return;
      // Damping: el contenido sigue al dedo pero capped a ±50.
      const damped = Math.max(-50, Math.min(50, e.translationX * 0.35));
      translateX.value = damped;
    })
    .onEnd((e) => {
      const SWIPE_DIST = 70;
      const SWIPE_VEL = 380;
      const ignored = keyboardOpen.value === 1;

      if (!ignored) {
        if (
          (e.translationX < -SWIPE_DIST || e.velocityX < -SWIPE_VEL) &&
          tabIndex < TAB_ORDER.length - 1
        ) {
          runOnJS(goNext)();
        } else if (
          (e.translationX > SWIPE_DIST || e.velocityX > SWIPE_VEL) &&
          tabIndex > 0
        ) {
          runOnJS(goPrev)();
        }
      }
      translateX.value = withTiming(0, { duration: 220 });
    });

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[{ flex: 1 }, animStyle]}>{children}</Animated.View>
    </GestureDetector>
  );
}
