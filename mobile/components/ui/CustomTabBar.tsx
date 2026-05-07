import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

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
          <Pressable
            key={route.key}
            onPress={handlePress}
            style={styles.tab}
            accessibilityRole="button"
            accessibilityLabel={cfg.label}
            accessibilityState={{ selected: focused }}
          >
            <IconSymbol
              name={focused ? cfg.iconActive : cfg.iconInactive}
              size={26}
              color={focused ? c.primary : c.tabIconDefault}
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
          </Pressable>
        );
      })}
    </View>
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
    paddingVertical: 4,
    gap: 2,
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
