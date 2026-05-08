import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';

// Tab bar custom con paridad legacy:
// - bg-slate-50/70 backdrop-blur-2xl border-t (semi-transparente con blur via
//   backgroundColor + borderTopColor; en RN no tenemos blur builtin y queremos
//   evitar BlurView para no agregar dependencia native — usamos color con
//   alpha que se ve casi igual sobre cualquier scroll)
// - text-blue-600 active / text-slate-400 inactive
// - dot animado bajo label cuando active (h-1 w-1 bg-blue-600 -bottom-0.5)
// - icon FILL=1 cuando active (en SF Symbols se logra usando .fill variant en
//   iOS; en MaterialIcons fallback no se nota — el color cambia que es lo
//   importante)
// - text-[10.5px] font-semibold

type TabKey = 'index' | 'calendar' | 'nova' | 'tasks' | 'settings';

const TABS: Record<TabKey, { label: string; iconActive: any; iconInactive: any }> = {
  index: { label: 'Mi día', iconActive: 'sun.max.fill', iconInactive: 'sun.max.fill' },
  calendar: { label: 'Calendario', iconActive: 'calendar', iconInactive: 'calendar' },
  nova: { label: 'Nova', iconActive: 'sparkles', iconInactive: 'sparkles' },
  tasks: { label: 'Tareas', iconActive: 'checklist', iconInactive: 'checklist' },
  settings: { label: 'Ajustes', iconActive: 'gearshape.fill', iconInactive: 'gearshape.fill' },
};

export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: c.background,
          borderTopColor: c.border,
          paddingBottom: Math.max(insets.bottom, Spacing.sm),
        },
      ]}
    >
      {state.routes.map((route, idx) => {
        const focused = state.index === idx;
        const cfg = TABS[route.name as TabKey];
        if (!cfg) return null;

        function handlePress() {
          if (!focused && Platform.OS === 'ios') {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name as any);
          }
        }

        return (
          <ScaleTabItem
            key={route.key}
            onPress={handlePress}
            accessibilityLabel={cfg.label}
            accessibilityState={{ selected: focused }}
          >
            <TabIcon
              name={focused ? cfg.iconActive : cfg.iconInactive}
              focused={focused}
              activeColor={c.primary}
              inactiveColor={c.tabIconDefault}
            />
            <Text
              style={[
                styles.label,
                { color: focused ? c.primary : c.tabIconDefault },
              ]}
              numberOfLines={1}
            >
              {cfg.label}
            </Text>
            <Dot focused={focused} color={c.primary} />
          </ScaleTabItem>
        );
      })}
    </View>
  );
}

// Tab item con spring scale en UI thread — reemplaza el pressed?0.94:1 del
// Pressable que corría en JS thread y causaba micro-jank perceptible.
function ScaleTabItem({
  onPress,
  accessibilityLabel,
  accessibilityState,
  children,
}: {
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityState: { selected: boolean };
  children: React.ReactNode;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.88, { damping: 12, stiffness: 500, mass: 0.4 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 14, stiffness: 400, mass: 0.4 });
      }}
      style={styles.tab}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
    >
      <Animated.View style={[styles.tabInner, animStyle]}>{children}</Animated.View>
    </Pressable>
  );
}

// Punto animado bajo el label cuando la tab está activa.
// Usa reanimated para que la transición sea spring (legacy: stiffness 500
// damping 32). Cuando inactiva, opacity = 0 y scale = 0.
function Dot({ focused, color }: { focused: boolean; color: string }) {
  const animStyle = useAnimatedStyle(() => ({
    opacity: withSpring(focused ? 1 : 0, { stiffness: 500, damping: 32 }),
    transform: [
      { scale: withSpring(focused ? 1 : 0, { stiffness: 500, damping: 32 }) },
    ],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.dot,
        { backgroundColor: color },
        animStyle,
      ]}
    />
  );
}

// Ícono de tab con scale animado al activarse: 1 → 1.08 con timing 220ms.
// Sutil pero suficiente para que el cambio se sienta vivo. Color animado
// vía cambio de prop (RN no anima color en native driver de Reanimated 4
// sin extra config; el color cambia instantáneo y la escala suaviza).
function TabIcon({
  name,
  focused,
  activeColor,
  inactiveColor,
}: {
  name: any;
  focused: boolean;
  activeColor: string;
  inactiveColor: string;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: withTiming(focused ? 1.08 : 1, { duration: 220 }) }],
  }));
  return (
    <Animated.View style={style}>
      <IconSymbol name={name} size={26} color={focused ? activeColor : inactiveColor} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingHorizontal: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    gap: 2,
    width: '100%',
  },
  label: {
    fontSize: 10.5,
    fontWeight: '700',
    lineHeight: 13,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
});
