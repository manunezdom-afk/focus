import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef } from 'react';
import { Keyboard, Platform, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

// Orden estricto de tabs — debe coincidir con (tabs)/_layout.tsx.
const TAB_ORDER = ['index', 'calendar', 'nova', 'tasks', 'settings'] as const;
export type SwipeTabName = (typeof TAB_ORDER)[number];

type Props = {
  currentTab: SwipeTabName;
  children: React.ReactNode;
};

// Wrapper minimalista que detecta swipe horizontal y navega entre tabs.
//
// Diseño priorizado para STABILITY > efecto visual:
//   · activeOffsetX([-15, 15]) — solo activa con movimiento X claro.
//   · failOffsetY([-15, 15])   — falla si el usuario va vertical, cede a
//     ScrollView/FlatList interno (no rompe scroll).
//   · NO arrastra el contenido durante el gesto. La pasada anterior
//     hacía translateX en cada onChange — eso contribuía al lag percibido.
//     Ahora el gesto es invisible: detecta y dispara navegación cuando
//     supera el threshold; sin animación de damping.
//   · Threshold más alto (80px / 500px·s) para evitar disparar por
//     accidente al hacer scroll diagonal.
//   · Mientras el teclado está abierto, navega no se ejecuta — el ref
//     se chequea en JS thread cuando runOnJS dispara la callback.
//   · navigation.navigate del Tab navigator local (más rápido que
//     router.navigate de expo-router) — no toca la URL stack.
//   · Sin nuevas dependencias.
export function SwipeNavigator({ currentTab, children }: Props) {
  const navigation = useNavigation<{ navigate: (name: string) => void }>();
  const tabIndex = TAB_ORDER.indexOf(currentTab);

  // Ref JS-thread accesible desde callbacks runOnJS-ed.
  const keyboardOpenRef = useRef(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => {
      keyboardOpenRef.current = true;
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      keyboardOpenRef.current = false;
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const goPrev = useCallback(() => {
    if (keyboardOpenRef.current) return;
    const prev = TAB_ORDER[tabIndex - 1];
    if (!prev) return;
    if (Platform.OS === 'ios') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    navigation.navigate(prev);
  }, [tabIndex, navigation]);

  const goNext = useCallback(() => {
    if (keyboardOpenRef.current) return;
    const next = TAB_ORDER[tabIndex + 1];
    if (!next) return;
    if (Platform.OS === 'ios') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    navigation.navigate(next);
  }, [tabIndex, navigation]);

  const pan = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-15, 15])
    .onEnd((e) => {
      'worklet';
      const SWIPE_DIST = 80;
      const SWIPE_VEL = 500;
      if (e.translationX < -SWIPE_DIST || e.velocityX < -SWIPE_VEL) {
        if (tabIndex < TAB_ORDER.length - 1) {
          runOnJS(goNext)();
        }
      } else if (e.translationX > SWIPE_DIST || e.velocityX > SWIPE_VEL) {
        if (tabIndex > 0) {
          runOnJS(goPrev)();
        }
      }
    });

  return (
    <GestureDetector gesture={pan}>
      <View style={{ flex: 1 }}>{children}</View>
    </GestureDetector>
  );
}
