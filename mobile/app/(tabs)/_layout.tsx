import { Tabs } from 'expo-router';

import { CustomTabBar } from '@/components/ui/CustomTabBar';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: 'none',
        freezeOnBlur: true,
        lazy: true,
        tabBarHideOnKeyboard: true,
      }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: 'Mi día' }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendario' }} />
      <Tabs.Screen name="nova" options={{ title: 'Nova' }} />
      <Tabs.Screen name="tasks" options={{ title: 'Tareas' }} />
      <Tabs.Screen name="settings" options={{ title: 'Ajustes' }} />
    </Tabs>
  );
}
