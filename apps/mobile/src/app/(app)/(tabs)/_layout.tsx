import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { colors } from '../../../theme/tokens';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const icon =
  (name: IconName) =>
  ({ color }: { color: ColorValue }) => <MaterialCommunityIcons name={name} size={28} color={color} />;

/**
 * Navegacao principal. Cinco abas cabem com folga em telas pequenas;
 * Vigilancia, Doencas e Perfil ficam em "Mais".
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 13, fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          minHeight: 68,
          paddingTop: 6,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Início', tabBarIcon: icon('home-variant') }} />
      <Tabs.Screen name="animals" options={{ title: 'Animais', tabBarIcon: icon('cow') }} />
      <Tabs.Screen name="herds" options={{ title: 'Rebanhos', tabBarIcon: icon('fence') }} />
      <Tabs.Screen name="alerts" options={{ title: 'Alertas', tabBarIcon: icon('bell') }} />
      <Tabs.Screen name="more" options={{ title: 'Mais', tabBarIcon: icon('menu') }} />
    </Tabs>
  );
}
