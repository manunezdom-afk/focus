import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef } from 'react';
import { Dimensions, Keyboard, Platform } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

// Orden estricto de tabs — debe coincidir con (tabs)/_layout.tsx.
const TAB_ORDER = ['index', 'calendar', 'nova', 'tasks', 'settings'] as const;
export type SwipeTabName = (typeof TAB_ORDER)[number];

type Props = {
  currentTab: SwipeTabName;
  children: React.ReactNode;
};

const SCREEN_W = Dimensions.get('window').width;
const SWIPE_DIST = 80;
const SWIPE_VEL = 500;

// Wrapper de swipe horizontal entre tabs con feedback visual estilo iOS:
//   · Durante el pan, el contenido sigue al dedo con translateX 1:1.
//   · En los extremos (primer/última tab) hay rubber-band damping.
//   · Al soltar pasando el threshold, el contenido sale de pantalla y
//     navegamos al tab adyacente — al volver al render con tabIndex nuevo,
//     translateX está en 0 y entra natural.
//   · Si no pasa el threshold, vuelve a 0 con spring suave.
//   · activeOffsetX/failOffsetY mantienen scroll vertical intacto.
//   · navigate del Tab navigator local (más rápido que expo-router router).
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

  // Reset translate cuando cambia la tab (al volver del navigate, el
  // contenido nuevo aparece centrado sin flicker).
  useEffect(() => {
    translateX.value = 0;
  }, [tabIndex, translateX]);

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
      // se atenúa a un tercio para dar feedback de "no hay más" sin quedarse.
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
        // Sale por la izquierda; navegación dispara y al re-render volverá a 0.
        translateX.value = withTiming(-SCREEN_W, { duration: 200 });
        runOnJS(goNext)();
      } else if (passed && goingRight && !isFirst) {
        translateX.value = withTiming(SCREEN_W, { duration: 200 });
        runOnJS(goPrev)();
      } else {
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
