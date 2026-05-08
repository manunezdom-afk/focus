import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef } from 'react';
import { Keyboard, Platform } from 'react-native';
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

const SWIPE_DIST = 80;
const SWIPE_VEL = 500;

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
  const tabIndex = TAB_ORDER.indexOf(currentTab);

  const translateX = useSharedValue(0);
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
    .activeOffsetX([-15, 15])
    .failOffsetY([-15, 15])
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
        Math.abs(e.translationX) > SWIPE_DIST || Math.abs(e.velocityX) > SWIPE_VEL;
      const goingLeft = e.translationX < 0;
      const goingRight = e.translationX > 0;

      if (passed && goingLeft && !isLast) {
        runOnJS(goNext)();
        // Spring rápido a 0 — el cambio de tab cubre el reset visualmente.
        translateX.value = withSpring(0, { damping: 26, stiffness: 320, mass: 0.5 });
      } else if (passed && goingRight && !isFirst) {
        runOnJS(goPrev)();
        translateX.value = withSpring(0, { damping: 26, stiffness: 320, mass: 0.5 });
      } else {
        // No pasó el threshold: vuelve con spring más lento (sensación elástica).
        translateX.value = withSpring(0, { damping: 22, stiffness: 220, mass: 0.6 });
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
