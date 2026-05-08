import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef } from 'react';
import { Keyboard, Platform, View } from 'react-native';
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

// Wrapper de tab transition + swipe horizontal estilo Apple "card stack".
//
// Entrance (al ganar foco):
//   · scale 0.94 → 1   (spring corto, ~220ms)
//   · borderRadius 28 → 0
//   · opacity 0.7 → 1
//   · sombra estática que se ve mientras la tarjeta es < pantalla
// El fondo detrás es muy oscuro (#06080f) para dar profundidad estilo iOS.
//
// Swipe (mismo comportamiento que antes):
//   · Pan horizontal mueve translateX 1:1 con rubber-band en bordes.
//   · Soltar pasando 80px o 500px/s navega a la tab adyacente.
//   · activeOffsetX/failOffsetY mantienen scroll vertical intacto.
//   · keyboardOpenRef desactiva el swipe mientras hay teclado abierto.
//   · TextInput focused → keyboard abierto → swipe desactivado (mismo flag).
//   · Modal/ActionSheet RN se renderizan encima — el gesture pan no llega.
//   · En primera/última tab no hay tab adyacente → no navega.
//
// Performance:
//   · Toda la animación corre en UI thread vía worklets de Reanimated.
//   · Sin gradientes ni blur. Sombra estática (cacheada por iOS).
//   · Sin re-renders en JS thread durante animación.
//   · Spring corto (~220ms) — dentro del rango 180-260ms pedido.
//
// Red de seguridad: useFocusEffect resetea translateX y dispara la entrance
// al ganar foco. Cubre cualquier caso donde un gesto interrumpido haya
// dejado los valores intermedios.
export function SwipeNavigator({ currentTab, children }: Props) {
  const navigation = useNavigation<{ navigate: (name: string) => void }>();
  const tabIndex = TAB_ORDER.indexOf(currentTab);

  const translateX = useSharedValue(0);
  // 0 = recién entrando (atrás del stack), 1 = settled (frente, full screen).
  const enterProgress = useSharedValue(0);
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

  // Entrance + reset al ganar foco.
  useFocusEffect(
    useCallback(() => {
      translateX.value = 0;
      enterProgress.value = 0;
      enterProgress.value = withSpring(1, {
        damping: 22,
        stiffness: 320,
        mass: 0.5,
      });
    }, [translateX, enterProgress]),
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
        translateX.value = withSpring(0, { damping: 26, stiffness: 320, mass: 0.5 });
      } else if (passed && goingRight && !isFirst) {
        runOnJS(goPrev)();
        translateX.value = withSpring(0, { damping: 26, stiffness: 320, mass: 0.5 });
      } else {
        translateX.value = withSpring(0, { damping: 22, stiffness: 220, mass: 0.6 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => {
    const e = enterProgress.value;
    const scale = 0.94 + 0.06 * e;        // 0.94 → 1.0
    const radius = (1 - e) * 28;          // 28 → 0
    const opacity = 0.7 + 0.3 * e;        // 0.7 → 1.0
    return {
      transform: [{ translateX: translateX.value }, { scale }],
      borderRadius: radius,
      opacity,
    };
  });

  return (
    <View style={styles.depthBg}>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.card, animatedStyle]}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

// Estilos estáticos (no animados) — iOS los cachea, sombra sin costo de
// re-render durante la animación.
const styles = {
  // Fondo oscuro estilo iOS multitasking: solo se ve durante la transición
  // (en las pequeñas franjas que deja la tarjeta cuando scale < 1).
  depthBg: {
    flex: 1,
    backgroundColor: '#06080f',
  },
  card: {
    flex: 1,
    overflow: 'hidden' as const,
    backgroundColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
  },
};
