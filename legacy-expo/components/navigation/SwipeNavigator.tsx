import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef } from 'react';
import { Keyboard, Platform, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

// Orden estricto de tabs — debe coincidir con (tabs)/_layout.tsx.
const TAB_ORDER = ['index', 'calendar', 'nova', 'tasks', 'settings'] as const;
export type SwipeTabName = (typeof TAB_ORDER)[number];

type Props = {
  currentTab: SwipeTabName;
  children: React.ReactNode;
};

const SWIPE_VEL = 500;
const AXIS_DECIDE_PX = 8;
const AXIS_LOCK_RATIO = 1.55;
const SYSTEM_EDGE_PX = 20;

// Wrapper de swipe horizontal entre tabs con feedback visual estilo iOS.
//
// Diseño:
//   · Durante el pan, el contenido sigue al dedo con translateX 1:1.
//   · En los extremos (primer/última tab) hay rubber-band damping.
//   · Al soltar pasando el threshold, navegamos INMEDIATAMENTE y el
//     translateX hace spring rápido a 0. El cambio de tab cubre el spring
//     visualmente — el usuario percibe "snap" iOS sin que el contenido
//     anterior quede off-screen.
//   · CRÍTICO: cada SwipeNavigator es una instancia por tab montada (RN
//     mantiene tabs en memoria). Si dejáramos translateX en -SCREEN_W al
//     navegar, al volver a esa tab el contenido seguiría trasladado y se
//     vería en blanco. Por eso animamos siempre de vuelta a 0 y, además,
//     useFocusEffect resetea translateX al ganar foco como red de seguridad.
//   · activeOffsetX/failOffsetY mantienen scroll vertical intacto.
export function SwipeNavigator({ currentTab, children }: Props) {
  const navigation = useNavigation<{ navigate: (name: string) => void }>();
  const { width } = useWindowDimensions();
  const tabIndex = TAB_ORDER.indexOf(currentTab);

  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const keyboardOpen = useSharedValue(false);
  const keyboardOpenRef = useRef(false);
  const swipeDistance = Math.min(Math.max(width * 0.28, 72), 116);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => {
      keyboardOpenRef.current = true;
      keyboardOpen.value = true;
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      keyboardOpenRef.current = false;
      keyboardOpen.value = false;
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardOpen]);

  // Red de seguridad: cuando esta tab gana foco, el translateX vuelve a 0.
  // Cubre cualquier caso donde un gesto interrumpido haya dejado el valor
  // intermedio (ej. crash de la animación, navegación por tap del tab bar).
  useFocusEffect(
    useCallback(() => {
      translateX.value = 0;
    }, [translateX]),
  );

  const navigateTo = useCallback(
    (name: string) => {
      if (Platform.OS === 'ios') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      navigation.navigate(name);
    },
    [navigation],
  );

  const goPrev = useCallback(() => {
    if (keyboardOpenRef.current) return;
    const prev = TAB_ORDER[tabIndex - 1];
    if (!prev) return;
    navigateTo(prev);
  }, [tabIndex, navigateTo]);

  const goNext = useCallback(() => {
    if (keyboardOpenRef.current) return;
    const next = TAB_ORDER[tabIndex + 1];
    if (!next) return;
    navigateTo(next);
  }, [tabIndex, navigateTo]);

  const isFirst = tabIndex === 0;
  const isLast = tabIndex === TAB_ORDER.length - 1;

  const pan = Gesture.Pan()
    .manualActivation(true)
    .cancelsTouchesInView(false)
    .onTouchesDown((e, manager) => {
      'worklet';
      const touch = e.allTouches[0];
      if (!touch || keyboardOpen.value || touch.absoluteX < SYSTEM_EDGE_PX) {
        manager.fail();
        return;
      }
      startX.value = touch.absoluteX;
      startY.value = touch.absoluteY;
    })
    .onTouchesMove((e, manager) => {
      'worklet';
      if (keyboardOpen.value) {
        manager.fail();
        return;
      }

      const touch = e.allTouches[0];
      if (!touch) {
        manager.fail();
        return;
      }

      const dx = touch.absoluteX - startX.value;
      const dy = touch.absoluteY - startY.value;
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);

      if (ax < AXIS_DECIDE_PX && ay < AXIS_DECIDE_PX) return;

      if (ax > ay * AXIS_LOCK_RATIO) {
        manager.activate();
      } else {
        manager.fail();
      }
    })
    .onUpdate((e) => {
      'worklet';
      const goingRight = e.translationX > 0;
      const goingLeft = e.translationX < 0;
      // Rubber-band en los bordes: si no hay tab a la que ir, el movimiento
      // se atenúa para dar feedback de "no hay más" sin quedarse pegado.
      const atEdge = (goingRight && isFirst) || (goingLeft && isLast);
      const factor = atEdge ? 0.28 : 1;
      translateX.value = e.translationX * factor;
    })
    .onEnd((e) => {
      'worklet';
      const passed =
        Math.abs(e.translationX) > swipeDistance || Math.abs(e.velocityX) > SWIPE_VEL;
      const goingLeft = e.translationX < 0;
      const goingRight = e.translationX > 0;

      if (!keyboardOpen.value && passed && goingLeft && !isLast) {
        runOnJS(goNext)();
        // Spring rápido a 0 — el cambio de tab cubre el reset visualmente.
        translateX.value = withSpring(0, { damping: 28, stiffness: 360, mass: 0.45 });
      } else if (!keyboardOpen.value && passed && goingRight && !isFirst) {
        runOnJS(goPrev)();
        translateX.value = withSpring(0, { damping: 28, stiffness: 360, mass: 0.45 });
      } else {
        // No pasó el threshold: vuelve con spring más lento (sensación elástica).
        translateX.value = withSpring(0, { damping: 28, stiffness: 300, mass: 0.55 });
      }
    })
    .onFinalize(() => {
      'worklet';
      if (translateX.value !== 0) {
        translateX.value = withSpring(0, { damping: 28, stiffness: 320, mass: 0.55 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[{ flex: 1 }, animatedStyle]}>{children}</Animated.View>
    </GestureDetector>
  );
}
