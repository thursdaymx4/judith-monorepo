import React from "react";
import Svg, { Circle, G, Path, Rect } from "react-native-svg";

/**
 * Monoline icon set — ported 1:1 from the prototype (j-core + japp-data Icon).
 * stroke="currentColor" is resolved to the `color` prop (RN has no currentColor).
 */

export type IconName =
  | "zap"
  | "droplet"
  | "wifi"
  | "smartphone"
  | "phone"
  | "card"
  | "plus"
  | "mic"
  | "keyboard"
  | "check"
  | "bell"
  | "watch"
  | "grid"
  | "globe"
  | "chart"
  | "spark"
  | "arrow"
  | "cal"
  | "lock"
  | "star"
  | "home"
  | "receipt"
  | "gear"
  | "pencil"
  | "chev"
  | "x"
  | "refresh"
  | "play"
  | "wallet"
  | "snooze"
  | "camera"
  | "scan"
  | "sun"
  | "moon"
  | "trend"
  | "trenddown"
  | "faceCalm"
  | "faceAnxious"
  | "pie"
  | "layers"
  | "clock"
  | "flame"
  | "sliders"
  | "flash";

interface IconProps {
  name: IconName | string;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

function paths(name: string, color: string): React.ReactNode {
  switch (name) {
    case "zap":
    case "flash":
      return <Path d="M13 2 3 14h9l-1 8 10-12h-9z" />;
    case "droplet":
      return (
        <Path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />
      );
    case "wifi":
      return (
        <G>
          <Path d="M2 8.5a16 16 0 0 1 20 0" />
          <Path d="M5 12.5a11 11 0 0 1 14 0" />
          <Path d="M8.5 16.2a6 6 0 0 1 7 0" />
          <Circle cx={12} cy={20} r={0.6} fill={color} stroke="none" />
        </G>
      );
    case "smartphone":
      return (
        <G>
          <Rect x={6} y={2} width={12} height={20} rx={2.5} />
          <Path d="M11 18h2" />
        </G>
      );
    case "phone":
      return (
        <Path d="M14 16.5a1 1 0 0 0 1.2-.3l.4-.5a2 2 0 0 1 1.6-.7h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.5.4a1 1 0 0 0-.3 1.2 14 14 0 0 0 6.4 6.3z" />
      );
    case "card":
      return (
        <G>
          <Rect x={2} y={5} width={20} height={14} rx={2.5} />
          <Path d="M2 10h20" />
        </G>
      );
    case "plus":
      return (
        <G>
          <Path d="M12 5v14" />
          <Path d="M5 12h14" />
        </G>
      );
    case "mic":
      return (
        <G>
          <Rect x={9} y={2} width={6} height={12} rx={3} />
          <Path d="M5 11a7 7 0 0 0 14 0" />
          <Path d="M12 18v4" />
        </G>
      );
    case "keyboard":
      return (
        <G>
          <Rect x={2} y={6} width={20} height={12} rx={2} />
          <Path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" />
        </G>
      );
    case "check":
      return <Path d="M20 6 9 17l-5-5" />;
    case "bell":
      return (
        <G>
          <Path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </G>
      );
    case "watch":
      return (
        <G>
          <Rect x={6} y={6} width={12} height={12} rx={3} />
          <Path d="M9 6V3h6v3M9 18v3h6v-3M12 10v2.5l1.5 1" />
        </G>
      );
    case "grid":
      return (
        <G>
          <Rect x={3} y={3} width={7} height={7} rx={1.5} />
          <Rect x={14} y={3} width={7} height={7} rx={1.5} />
          <Rect x={3} y={14} width={7} height={7} rx={1.5} />
          <Rect x={14} y={14} width={7} height={7} rx={1.5} />
        </G>
      );
    case "globe":
      return (
        <G>
          <Circle cx={12} cy={12} r={9} />
          <Path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18" />
        </G>
      );
    case "chart":
      return (
        <G>
          <Path d="M3 3v18h18" />
          <Path d="M7 14v3M12 9v8M17 5v12" />
        </G>
      );
    case "spark":
      return <Path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />;
    case "arrow":
      return (
        <G>
          <Path d="M5 12h14" />
          <Path d="M13 6l6 6-6 6" />
        </G>
      );
    case "cal":
      return (
        <G>
          <Rect x={3} y={4} width={18} height={17} rx={2.5} />
          <Path d="M3 9h18M8 2v4M16 2v4" />
        </G>
      );
    case "lock":
      return (
        <G>
          <Rect x={4} y={11} width={16} height={9} rx={2.5} />
          <Path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </G>
      );
    case "star":
      return <Path d="M12 3l2.6 6.3L21 10l-5 4 1.6 6.6L12 17l-5.6 3.6L8 14l-5-4 6.4-.7z" />;
    case "home":
      return (
        <G>
          <Path d="M3 10.5 12 3l9 7.5" />
          <Path d="M5 9.5V20h14V9.5" />
        </G>
      );
    case "receipt":
      return (
        <G>
          <Path d="M5 3v18l2.5-1.5L10 21l2-1.5L14 21l2.5-1.5L19 21V3l-2.5 1.5L14 3l-2 1.5L10 3 7.5 4.5z" />
          <Path d="M9 8h6M9 12h6" />
        </G>
      );
    case "gear":
      return (
        <G>
          <Circle cx={12} cy={12} r={3.2} />
          <Path d="M19.4 13.5a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </G>
      );
    case "pencil":
      return (
        <G>
          <Path d="M12 20h9" />
          <Path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
        </G>
      );
    case "chev":
      return <Path d="M9 6l6 6-6 6" />;
    case "x":
      return <Path d="M18 6 6 18M6 6l12 12" />;
    case "refresh":
      return (
        <G>
          <Path d="M21 12a9 9 0 1 1-3-6.7" />
          <Path d="M21 3v5h-5" />
        </G>
      );
    case "play":
      return <Path d="M7 4v16l13-8z" fill={color} stroke="none" />;
    case "wallet":
      return (
        <G>
          <Path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2" />
          <Path d="M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-3" />
          <Path d="M21 12h-4a2 2 0 1 0 0 4h4z" />
        </G>
      );
    case "snooze":
      return (
        <G>
          <Circle cx={12} cy={13} r={8} />
          <Path d="M12 9v4l2.5 1.5M9 2h6M5 5l2-2" />
        </G>
      );
    case "camera":
      return (
        <G>
          <Path d="M3 8.5A2 2 0 0 1 5 6.5h2L8.5 4h7L17 6.5h2a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <Circle cx={12} cy={13} r={3.4} />
        </G>
      );
    case "scan":
      return (
        <G>
          <Path d="M4 7V5.5A1.5 1.5 0 0 1 5.5 4H7M17 4h1.5A1.5 1.5 0 0 1 20 5.5V7M20 17v1.5a1.5 1.5 0 0 1-1.5 1.5H17M7 20H5.5A1.5 1.5 0 0 1 4 18.5V17" />
          <Path d="M4 12h16" />
        </G>
      );
    case "sun":
      return (
        <G>
          <Circle cx={12} cy={12} r={4} />
          <Path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
        </G>
      );
    case "moon":
      return <Path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />;
    case "trend":
      return (
        <G>
          <Path d="M3 17l6-6 4 4 7-7" />
          <Path d="M17 7h4v4" />
        </G>
      );
    case "trenddown":
      return (
        <G>
          <Path d="M3 7l6 6 4-4 7 7" />
          <Path d="M17 17h4v-4" />
        </G>
      );
    case "faceCalm":
      return (
        <G>
          <Circle cx={12} cy={12} r={9} />
          <Path d="M9 10.5h.01" />
          <Path d="M15 10.5h.01" />
          <Path d="M8.5 14.5q3.5 3 7 0" />
        </G>
      );
    case "faceAnxious":
      return (
        <G>
          <Circle cx={12} cy={12} r={9} />
          <Path d="M8 9.2l2 1.1" />
          <Path d="M16 9.2l-2 1.1" />
          <Path d="M9 11.5h.01" />
          <Path d="M15 11.5h.01" />
          <Path d="M8.5 15.5q1.2-1.4 2.3 0 1.2 1.4 2.3 0 1.2-1.4 2.3 0" />
        </G>
      );
    case "pie":
      return (
        <G>
          <Path d="M12 2a10 10 0 1 0 10 10h-10z" />
          <Path d="M13 2.5A10 10 0 0 1 21.5 11H13z" />
        </G>
      );
    case "layers":
      return (
        <G>
          <Path d="M12 3 3 8l9 5 9-5z" />
          <Path d="M3 12.5l9 5 9-5" />
        </G>
      );
    case "clock":
      return (
        <G>
          <Circle cx={12} cy={12} r={9} />
          <Path d="M12 7v5l3.5 2" />
        </G>
      );
    case "flame":
      return (
        <Path d="M12 22c4 0 7-2.7 7-7 0-4-3-6-3-6 .5 2-1 3.5-1 3.5C15 9 13 3 10.5 2c.7 3-1.5 5-3 7.5C6 11.5 5 13 5 15c0 4.3 3 7 7 7z" />
      );
    case "sliders":
      return (
        <G>
          <Path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" />
          <Path d="M1 14h6M9 8h6M17 16h6" />
        </G>
      );
    default:
      return <Path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />;
  }
}

export function Icon({ name, size = 22, color = "currentColor", strokeWidth = 1.8 }: IconProps) {
  const resolved = color === "currentColor" ? "#f3f5f8" : color;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <G
        stroke={resolved}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        {paths(name, resolved)}
      </G>
    </Svg>
  );
}

export default Icon;
