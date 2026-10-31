export const colors = {
  bg: '#0e1210',
  panel: '#171e1a',
  panelAlt: '#1f2923',
  border: '#2c3a32',
  text: '#e8efe9',
  muted: '#8a9a8f',
  accent: '#e0a526',
  accentText: '#1a1405',
  good: '#4caf6e',
  bad: '#d9534f',
  neutral: '#6b7a70',
  danger: '#a83232',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

export function valueColor(value: number): string {
  if (value >= 2) return colors.good;
  if (value <= -2) return colors.bad;
  if (value < 0) return '#d49a3a';
  return colors.neutral;
}
