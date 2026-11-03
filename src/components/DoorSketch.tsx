/**
 * Набросок чернилами: гермодверь бункера «УБЕЖИЩЕ 7-Б» в бетонном портале.
 * Перенесён из утверждённого макета главной (дизайн v2).
 */
import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { colors } from '../theme';
import { useLampFlicker } from '../ui/anim';

const INK = '#2a241d';
export const SKETCH_W = 252;
export const SKETCH_H = 168;

/** Бетонный портал, земля и всё вокруг двери (без самой двери). */
export function PortalLines() {
  return (
    <G fill="none" stroke={INK} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M0 150 Q60 146 126 149 T252 147" strokeWidth={1.6} />
      <Path d="M8 157 L22 151 M40 158 L52 152 M190 158 L204 151 M222 157 L236 151" strokeWidth={1} opacity={0.6} />
      <Path d="M58 150 L64 18 L188 18 L194 150" strokeWidth={2.2} />
      <Path d="M52 18 L200 18 L196 10 L56 10 Z" strokeWidth={1.8} />
      <Path
        d="M166 24 L186 44 M168 40 L188 60 M170 58 L189 77 M171 76 L190 95 M172 94 L191 113 M173 112 L192 131 M174 130 L192 148"
        strokeWidth={1}
        opacity={0.55}
      />
      <Path d="M60 140 L190 140" strokeWidth={1.2} />
      <Path
        d="M64 140 l8 9 M80 140 l8 9 M96 140 l8 9 M112 140 l8 9 M128 140 l8 9 M144 140 l8 9 M160 140 l8 9 M176 140 l8 9"
        strokeWidth={3}
        opacity={0.75}
      />
      <Circle cx={200} cy={30} r={5} strokeWidth={1.6} />
      <Path d="M200 21 v-4 M209 30 h4 M206.5 23.5 l3 -3 M206.5 36.5 l3 3" strokeWidth={1.3} stroke="#c8862a" />
      <Path d="M200 35 V82 q0 5 5 5 H252" strokeWidth={1.5} />
      <Path d="M197 50 h6 M197 66 h6 M218 84 v6 M236 84 v6" strokeWidth={1.2} />
      <Rect x={206} y={100} width={30} height={22} strokeWidth={1.5} />
      <Path d="M209 105 h24 M209 109 h24 M209 113 h24 M209 117 h24" strokeWidth={1} />
      <Circle cx={209} cy={103} r={0.8} fill={INK} />
      <Circle cx={233} cy={119} r={0.8} fill={INK} />
      <Path d="M62 32 l6 7 l-3 6 l5 8 l-2 5" strokeWidth={0.9} opacity={0.7} />
      <Path d="M90 10 l3 4 l-2 3 M150 18 l2 5 l4 2" strokeWidth={0.9} opacity={0.7} />
      <Path d="M184 100 l3 6 l-2 5" strokeWidth={0.9} opacity={0.6} />
      <Circle cx={70} cy={24} r={1.8} strokeWidth={1.1} />
      <Circle cx={178} cy={24} r={1.8} strokeWidth={1.1} />
      <Circle cx={66} cy={132} r={1.8} strokeWidth={1.1} />
      <Path d="M84 150 h88 v5 h-88 z M76 155 h104 v6 h-104 z" strokeWidth={1.3} />
      <Path d="M30 104 V150" strokeWidth={1.6} />
      <Path d="M30 80 L45 106 L15 106 Z" strokeWidth={1.6} />
      <Path d="M8 150 l2 -7 l2 7 l2 -5 l2 5 M226 150 l2 -6 l2 6 l3 -8 l1 8 M44 150 l1 -5 l2 5" strokeWidth={1} />
      <Circle cx={204} cy={153} r={1.6} strokeWidth={1} />
      <Circle cx={210} cy={156} r={2.4} strokeWidth={1} />
      <Circle cx={52} cy={155} r={1.8} strokeWidth={1} />
      <SvgText x={126} y={32} textAnchor="middle" fontFamily="Oswald_700Bold" fontSize={13} letterSpacing={3} fill={INK} stroke="none">
        УБЕЖИЩЕ 7-Б
      </SvgText>
      <SvgText x={30} y={101} textAnchor="middle" fontFamily="Oswald_700Bold" fontSize={13} fill={INK} stroke="none">
        !
      </SvgText>
    </G>
  );
}

/** Дверь: круглое полотно, запорные зубья, петли, манометр. Без штурвала. */
export function DoorLeaf() {
  return (
    <G fill="none" stroke={INK} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={124} cy={88} r={52} strokeWidth={2.4} />
      <Circle cx={124} cy={88} r={43} strokeWidth={1.4} />
      <Path
        d="M124 36 v4 M150 43 l-2 3.5 M169 62 l-3.5 2 M176 88 h-4 M169 114 l-3.5 -2 M150 133 l-2 -3.5 M124 140 v-4 M98 133 l2 -3.5 M79 114 l3.5 -2 M72 88 h4 M79 62 l3.5 2 M98 43 l2 3.5"
        strokeWidth={2.6}
      />
      <Rect x={66} y={58} width={10} height={16} strokeWidth={1.6} />
      <Rect x={66} y={102} width={10} height={16} strokeWidth={1.6} />
      <Path d="M84 102 q8 20 30 26 M90 112 q8 12 22 16" strokeWidth={1} opacity={0.5} />
      <Path d="M70 60 h4 M70 112 h4" strokeWidth={1} opacity={0.6} />
      <Circle cx={150} cy={62} r={7} strokeWidth={1.4} />
      <Path d="M150 62 l4 -4" strokeWidth={1.3} stroke={colors.stamp} />
      <Path d="M145 64 l1.5 -.6 M150 56 v1.5 M155 64 l-1.5 -.6" strokeWidth={0.9} />
      <SvgText x={140} y={126} fontFamily="PTMono_400Regular" fontSize={8} fill={INK} stroke="none" opacity={0.8}>
        №042
      </SvgText>
    </G>
  );
}

/** Штурвал (6 спиц) — отдельно, чтобы его можно было вращать. Центр — (124, 88). */
export function Wheel() {
  return (
    <G fill="none" stroke={INK} strokeLinecap="round">
      <Circle cx={124} cy={88} r={18} strokeWidth={2.2} />
      <Circle cx={124} cy={88} r={4} strokeWidth={2} />
      <Path d="M124 70 v14 M124 92 v14 M108.4 79 l12 7 M127.6 90 l12 7 M108.4 97 l12 -7 M127.6 86 l12 -7" strokeWidth={2} />
    </G>
  );
}

/** Красная обводка штурвала чернилами. */
export function WheelCircle() {
  return (
    <Ellipse
      cx={124}
      cy={88}
      rx={27}
      ry={25}
      fill="none"
      stroke={colors.stamp}
      strokeWidth={2}
      transform="rotate(-8 124 88)"
      opacity={0.85}
    />
  );
}

/** Весь набросок для главной: портал, дверь, штурвал, обводка; лампа справа тихо мигает. */
export function DoorSketch({ width }: { width: number }) {
  const height = (width * SKETCH_H) / SKETCH_W;
  const k = width / SKETCH_W;
  const lamp = useLampFlicker(true);
  return (
    <View style={{ width, height }} accessible accessibilityRole="image" accessibilityLabel="Набросок гермодвери бункера в бетонном портале">
      <Svg width={width} height={height} viewBox={`0 0 ${SKETCH_W} ${SKETCH_H}`} style={styles.paper}>
        <PortalLines />
        <DoorLeaf />
        <Wheel />
        <WheelCircle />
      </Svg>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.lamp,
          { left: (200 - 6) * k, top: (30 - 6) * k, width: 12 * k, height: 12 * k, borderRadius: 6 * k, opacity: lamp },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  paper: { backgroundColor: '#ebe2cc' },
  lamp: { position: 'absolute', backgroundColor: 'rgba(224, 164, 58, 0.55)' },
});
