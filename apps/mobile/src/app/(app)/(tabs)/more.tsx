import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../../components/Screen';
import { colors, radius, spacing, touchTarget, typography } from '../../../theme/tokens';

interface Item {
  href: Href;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  subtitle: string;
}

const ITEMS: Item[] = [
  {
    href: '/surveillance',
    icon: 'shield-alert',
    title: 'Vigilância Sanitária',
    subtitle: 'Alertas de doenças na região',
  },
  {
    href: '/diseases',
    icon: 'book-open-variant',
    title: 'Biblioteca de Doenças',
    subtitle: 'Conteúdo educativo',
  },
  {
    href: '/sync',
    icon: 'cloud-sync',
    title: 'Sincronização',
    subtitle: 'Estado do envio e recebimento de dados',
  },
  {
    href: '/profile',
    icon: 'account-circle',
    title: 'Perfil e fazenda',
    subtitle: 'Seus dados, plano e saída da conta',
  },
];

export default function MoreScreen() {
  const router = useRouter();
  return (
    <Screen>
      <Text style={styles.title}>Mais</Text>
      {ITEMS.map((item) => (
        <Pressable
          key={item.title}
          accessibilityRole="button"
          onPress={() => router.push(item.href)}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <View style={styles.iconBox}>
            <MaterialCommunityIcons name={item.icon} size={28} color={colors.primary} />
          </View>
          <View style={styles.texts}>
            <Text style={styles.rowTitle}>{item.title}</Text>
            <Text style={styles.rowSubtitle}>{item.subtitle}</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={28} color={colors.textMuted} />
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text },
  row: {
    minHeight: touchTarget + 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { backgroundColor: colors.surfaceMuted },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1 },
  rowTitle: { ...typography.bodyStrong, color: colors.text },
  rowSubtitle: { ...typography.caption, color: colors.textMuted },
});
