/**
 * Climb-timeline chart. X = months (oldest → newest), Y = level 1..10.
 * Renders with react-native-svg so the tier bands, paycheck line, and
 * milestone halos all stay crisp at any width.
 *
 * Spec elements implemented (Phase 1):
 *   - Tier bands (each tier color @ ~6% alpha over its level range)
 *   - Paycheck-line at Level 5 (dashed cyan)
 *   - Catmull-Rom-smoothed line in the current-tier color
 *   - Area fill under the line, gradient → transparent
 *   - One dot per month, tier-colored
 *   - The newest dot is enlarged + white with a tier-color ring
 *   - Milestone months get a halo ring
 *
 * Phase 2: dashed drop-line at milestone months, X-axis month labels.
 */
import React from "react";
import { View } from "react-native";
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Line,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";

import {
  TIERS,
  type MonthGrade,
  tierForLevel,
} from "@/lib/altitude";

interface AltitudeChartProps {
  history: MonthGrade[];
  width: number;
  height: number;
}

export function AltitudeChart({ history, width, height }: AltitudeChartProps) {
  const padX = 12;
  const padTop = 14;
  const padBottom = 22;
  const innerW = width - padX * 2;
  const innerH = height - padTop - padBottom;

  // ── Coordinate helpers ──────────────────────────────────────────────────
  /** Map a level (1..10) to a Y pixel. 10 = top, 1 = bottom. */
  const yForLevel = (level: number): number => {
    const clamped = Math.max(1, Math.min(10, level));
    return padTop + (1 - (clamped - 1) / 9) * innerH;
  };
  /** Map a month index to an X pixel. */
  const xForIdx = (i: number, count: number): number => {
    if (count <= 1) return padX + innerW / 2;
    return padX + (i / (count - 1)) * innerW;
  };

  // ── Empty state ─────────────────────────────────────────────────────────
  if (history.length === 0) {
    return (
      <View style={{ width, height, alignItems: "center", justifyContent: "center" }}>
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          {renderTierBands(padX, padTop, innerW, innerH, yForLevel)}
          {renderPaycheckLine(padX, innerW, yForLevel)}
        </Svg>
      </View>
    );
  }

  // ── Smoothed line path (Catmull-Rom → cubic Bézier) ─────────────────────
  const points = history.map((m, i) => ({
    x: xForIdx(i, history.length),
    y: yForLevel(m.level),
    level: m.level,
    milestone: m.milestone,
  }));

  const linePath = catmullRomPath(points);
  const areaPath = `${linePath} L${points[points.length - 1]!.x},${padTop + innerH} L${points[0]!.x},${padTop + innerH} Z`;

  const newest = points[points.length - 1]!;
  const tier = tierForLevel(newest.level);

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id="climb-area" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={tier.color} stopOpacity="0.45" />
            <Stop offset="1" stopColor={tier.color} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {renderTierBands(padX, padTop, innerW, innerH, yForLevel)}
        {renderPaycheckLine(padX, innerW, yForLevel)}

        {/* Area under line */}
        <Path d={areaPath} fill="url(#climb-area)" />

        {/* Main line */}
        <Path
          d={linePath}
          fill="none"
          stroke={tier.color}
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Per-month dots */}
        {points.map((p, i) => {
          const dotTier = tierForLevel(p.level);
          const isNewest = i === points.length - 1;
          const isMilestone = !!p.milestone;
          return (
            <G key={i}>
              {isMilestone ? (
                <Circle
                  cx={p.x}
                  cy={p.y}
                  r={9}
                  fill="none"
                  stroke={dotTier.color}
                  strokeOpacity={0.4}
                  strokeWidth={1.5}
                />
              ) : null}
              {isNewest ? (
                <Circle cx={p.x} cy={p.y} r={6} fill="white" />
              ) : null}
              <Circle
                cx={p.x}
                cy={p.y}
                r={isNewest ? 4 : 3.5}
                fill={isNewest ? dotTier.color : dotTier.color}
              />
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

// ─── SVG primitives ───────────────────────────────────────────────────────────

function renderTierBands(
  padX: number,
  padTop: number,
  innerW: number,
  innerH: number,
  yForLevel: (lvl: number) => number,
) {
  return TIERS.map((t) => {
    const top = yForLevel(t.range[1]);
    const bottom = yForLevel(t.range[0]);
    const h = bottom - top;
    return (
      <Rect
        key={t.id}
        x={padX}
        y={top}
        width={innerW}
        height={Math.max(2, h)}
        fill={t.color}
        opacity={0.06}
      />
    );
  });
}

function renderPaycheckLine(
  padX: number,
  innerW: number,
  yForLevel: (lvl: number) => number,
) {
  const y = yForLevel(5);
  return (
    <G>
      <Line
        x1={padX}
        x2={padX + innerW}
        y1={y}
        y2={y}
        stroke="#B4EBEB"
        strokeOpacity={0.55}
        strokeWidth={1.2}
        strokeDasharray="4,3"
      />
      <SvgText
        x={padX + 4}
        y={y - 4}
        fontSize={8}
        fill="#B4EBEB"
        fillOpacity={0.85}
        fontWeight="600"
      >
        PAYCHECK LINE
      </SvgText>
    </G>
  );
}

// ─── Smoothing ────────────────────────────────────────────────────────────────

/**
 * Builds an SVG path from a series of points using a Catmull-Rom → cubic
 * Bézier conversion. The result is a smooth line that passes through every
 * data point — same look as Swift Charts' `.catmullRom`.
 */
function catmullRomPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M${points[0]!.x},${points[0]!.y}`;

  const tension = 0.5;
  let d = `M${points[0]!.x},${points[0]!.y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1]! : points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = i + 2 < points.length ? points[i + 2]! : p2;
    const cp1x = p1.x + (p2.x - p0.x) * (tension / 3);
    const cp1y = p1.y + (p2.y - p0.y) * (tension / 3);
    const cp2x = p2.x - (p3.x - p1.x) * (tension / 3);
    const cp2y = p2.y - (p3.y - p1.y) * (tension / 3);
    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}
