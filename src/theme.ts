/**
 * «Убежище-терминал»: графитовая сталь, янтарный свет аварийной лампы,
 * тёплый «бумажный» текст. Яркий цвет только один — янтарь.
 */
export const colors = {
  bg: '#16181b', // сталь
  panel: '#1f2226',
  raised: '#282c31',
  line: '#383d44',
  text: '#ece6d6', // бумага досье
  muted: '#8f9298',
  amber: '#f0a63a', // лампа
  amberDeep: '#3a2a12',
  onAmber: '#1b1408',
  good: '#8fb070',
  bad: '#d0574a',
  neutral: '#5d6269',
};

export const fonts = {
  display: 'RussoOne_400Regular',
  body: 'PTSans_400Regular',
  bold: 'PTSans_700Bold',
  mono: 'PTMono_400Regular',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = { sm: 4, md: 8 };

export function valueColor(value: number): string {
  if (value >= 2) return colors.good;
  if (value <= -2) return colors.bad;
  if (value < 0) return '#c98a45';
  return colors.neutral;
}
