import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme/tokens';

/**
 * Marca do AgroVax.
 * - `large`: a logo completa (simbolo + nome), usada no login e na abertura.
 * - `small`: so o simbolo ao lado do nome em texto, para o topo das telas,
 *   onde a logo completa ficaria ilegivel.
 *
 * As imagens tem fundo transparente e ficam em `assets/` (logo-full.png e
 * logo-mark.png). Proporcoes originais: 325x307 e 287x221.
 */
const FULL = require('../../assets/logo-full.png');
const MARK = require('../../assets/logo-mark.png');

const FULL_RATIO = 325 / 307;
const MARK_RATIO = 287 / 221;

export function Logo({ size = 'large' }: { size?: 'large' | 'small' }) {
  if (size === 'large') {
    return (
      <View style={styles.center} accessibilityRole="header" accessibilityLabel="AgroVax">
        <Image source={FULL} style={{ height: 170, width: 170 * FULL_RATIO }} resizeMode="contain" />
        <Text style={styles.tagline}>Sanidade do rebanho na palma da mão</Text>
      </View>
    );
  }

  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="AgroVax">
      <Image source={MARK} style={{ height: 40, width: 40 * MARK_RATIO }} resizeMode="contain" />
      <Text style={styles.name}>AgroVax</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { fontSize: 22, fontWeight: '800', color: colors.primaryDark, letterSpacing: -0.5 },
  tagline: { fontSize: 14, color: colors.textMuted },
});
