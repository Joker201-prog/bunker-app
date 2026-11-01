/**
 * «Досье на деревянном столе»: бумага, машинопись, красные штампы,
 * изолента и скрепки. Цвета чернил — как у настоящих печатей.
 */
export const colors = {
  wood: '#2b1d13', // запасной фон под текстурой дерева
  onWood: '#eadcbf', // текст и рамки прямо на дереве
  onWoodMuted: '#b9a786',
  paper: '#e2d3b2',
  paperLine: '#b9a67f',
  ink: '#2a241d',
  inkSoft: '#62574a',
  redaction: '#1c1915',
  stamp: '#a8281f', // красная печать
  stampBlue: '#2c4677', // синяя печать
  good: '#3d6a2c', // зелёные чернила
  bad: '#a8281f',
  tapeInk: '#1f1b17',
};

export const fonts = {
  display: 'Oswald_700Bold',
  displayMed: 'Oswald_500Medium',
  type: 'PTMono_400Regular', // машинопись
  body: 'PTSans_400Regular',
  bold: 'PTSans_700Bold',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const images = {
  wood: require('../assets/ui/wood.jpg'),
  paper: require('../assets/ui/paper.jpg'),
  paperclip: require('../assets/ui/paperclip.png'),
  tape: require('../assets/ui/tape.png'),
  photos: {
    m: [
      require('../assets/ui/avatar_m0.jpg'),
      require('../assets/ui/avatar_m1.jpg'),
      require('../assets/ui/avatar_m2.jpg'),
      require('../assets/ui/avatar_m3.jpg'),
      require('../assets/ui/avatar_m4.jpg'),
      require('../assets/ui/avatar_m5.jpg'),
    ],
    f: [
      require('../assets/ui/avatar_f0.jpg'),
      require('../assets/ui/avatar_f1.jpg'),
      require('../assets/ui/avatar_f2.jpg'),
      require('../assets/ui/avatar_f3.jpg'),
      require('../assets/ui/avatar_f4.jpg'),
      require('../assets/ui/avatar_f5.jpg'),
    ],
  },
};

/** Небольшой устойчивый наклон для листа, чтобы стопка выглядела живой. */
export function tilt(key: string, max = 1.2): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  const t = ((Math.abs(h) % 1000) / 1000) * 2 - 1;
  return `${(t * max).toFixed(2)}deg`;
}

export function hashIndex(key: string, n: number): number {
  let h = 7;
  for (let i = 0; i < key.length; i++) h = (h * 17 + key.charCodeAt(i)) | 0;
  return Math.abs(h) % n;
}
