import React from 'react';
import Svg, {
  Path,
  Circle,
  Rect,
  Polyline,
  Line,
} from 'react-native-svg';

export default function AppIcon({
  name,
  size = 22,
  color = '#94A3B8',
  strokeWidth = 2,
  fill = 'none',
  style,
}) {
  const s = size;

  switch (name) {
    case 'home':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" style={style}>
          <Path
            d="M3 9.5L12 3l9 6.5V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9.5z"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Polyline
            points="9 22 9 12 15 12 15 22"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'timer':
    case 'focus':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" style={style}>
          <Circle
            cx="12"
            cy="13"
            r="8"
            stroke={color}
            strokeWidth={strokeWidth}
          />
          <Polyline
            points="12 9 12 13 14.5 14.5"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Line
            x1="12"
            y1="2"
            x2="12"
            y2="5"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <Line
            x1="19"
            y1="5"
            x2="17.5"
            y2="6.5"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'calendar':
    case 'planner':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" style={style}>
          <Rect
            x="3"
            y="4"
            width="18"
            height="18"
            rx="2.5"
            stroke={color}
            strokeWidth={strokeWidth}
          />
          <Line
            x1="16"
            y1="2"
            x2="16"
            y2="6"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <Line
            x1="8"
            y1="2"
            x2="8"
            y2="6"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <Line
            x1="3"
            y1="10"
            x2="21"
            y2="10"
            stroke={color}
            strokeWidth={strokeWidth}
          />
        </Svg>
      );

    case 'chart':
    case 'stats':
    case 'analytics':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" style={style}>
          <Line
            x1="18"
            y1="20"
            x2="18"
            y2="10"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <Line
            x1="12"
            y1="20"
            x2="12"
            y2="4"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <Line
            x1="6"
            y1="20"
            x2="6"
            y2="14"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'trophy':
    case 'badges':
    case 'achievements':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" style={style}>
          <Path
            d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <Path
            d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <Path
            d="M4 22h16"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <Path
            d="M10 14.66V17a1 1 0 0 1-1 1H8v4h8v-4h-1a1 1 0 0 1-1-1v-2.34"
            stroke={color}
            strokeWidth={strokeWidth}
          />
          <Path
            d="M6 4h12a2 2 0 0 1 2 2v3a8 8 0 0 1-16 0V6a2 2 0 0 1 2-2z"
            stroke={color}
            strokeWidth={strokeWidth}
          />
        </Svg>
      );

    case 'profile':
    case 'user':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" style={style}>
          <Path
            d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle
            cx="12"
            cy="7"
            r="4"
            stroke={color}
            strokeWidth={strokeWidth}
          />
        </Svg>
      );

    case 'plus':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" style={style}>
          <Line
            x1="12"
            y1="5"
            x2="12"
            y2="19"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <Line
            x1="5"
            y1="12"
            x2="19"
            y2="12"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'play':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" style={style}>
          <Path
            d="M5 3.5l14 8.5-14 8.5V3.5z"
            fill={fill !== 'none' ? fill : color}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'pause':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" style={style}>
          <Rect
            x="6"
            y="4"
            width="4"
            height="16"
            rx="1"
            fill={fill !== 'none' ? fill : color}
            stroke={color}
            strokeWidth={strokeWidth}
          />
          <Rect
            x="14"
            y="4"
            width="4"
            height="16"
            rx="1"
            fill={fill !== 'none' ? fill : color}
            stroke={color}
            strokeWidth={strokeWidth}
          />
        </Svg>
      );

    case 'stop':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" style={style}>
          <Rect
            x="5"
            y="5"
            width="14"
            height="14"
            rx="2.5"
            fill={fill !== 'none' ? fill : color}
            stroke={color}
            strokeWidth={strokeWidth}
          />
        </Svg>
      );

    case 'reset':
    case 'refresh':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" style={style}>
          <Polyline
            points="23 4 23 10 17 10"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'flame':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" style={style}>
          <Path
            d="M8.5 14.5A2.5 2.5 0 0 0 11 17c1.38 0 2.5-1.12 2.5-2.5 0-1.63-1.1-2.8-2-3.88C10.5 9.5 9 7.7 9.5 5 12 6.5 14 9 14.5 11.5c.34-.3.63-.65.86-1.04C16.8 12.7 17 14.8 16 17a6 6 0 0 1-11.5-2.5c0-2.35 1.5-4.4 2.5-6.5.7 2 1.5 4 1.5 6.5z"
            fill={fill !== 'none' ? fill : color}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'clock':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" style={style}>
          <Circle
            cx="12"
            cy="12"
            r="10"
            stroke={color}
            strokeWidth={strokeWidth}
          />
          <Polyline
            points="12 6 12 12 16 14"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'hourglass':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" style={style}>
          <Line
            x1="5"
            y1="22"
            x2="19"
            y2="22"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <Line
            x1="5"
            y1="2"
            x2="19"
            y2="2"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <Path
            d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'check':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" style={style}>
          <Polyline
            points="20 6 9 17 4 12"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'edit':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" style={style}>
          <Path
            d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'trash':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" style={style}>
          <Polyline
            points="3 6 5 6 21 6"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'work':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" style={style}>
          <Rect
            x="2"
            y="7"
            width="20"
            height="14"
            rx="2"
            stroke={color}
            strokeWidth={strokeWidth}
          />
          <Path
            d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"
            stroke={color}
            strokeWidth={strokeWidth}
          />
        </Svg>
      );

    case 'study':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" style={style}>
          <Path
            d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"
            stroke={color}
            strokeWidth={strokeWidth}
          />
          <Path
            d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"
            stroke={color}
            strokeWidth={strokeWidth}
          />
        </Svg>
      );

    case 'exercise':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" style={style}>
          <Path
            d="M6 12h12"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <Path
            d="M6.5 6.5h11"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <Path
            d="M6.5 17.5h11"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <Rect
            x="2"
            y="5"
            width="4"
            height="14"
            rx="1"
            stroke={color}
            strokeWidth={strokeWidth}
          />
          <Rect
            x="18"
            y="5"
            width="4"
            height="14"
            rx="1"
            stroke={color}
            strokeWidth={strokeWidth}
          />
        </Svg>
      );

    case 'lunch':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" style={style}>
          <Path
            d="M18 8h1a4 4 0 0 1 0 8h-1"
            stroke={color}
            strokeWidth={strokeWidth}
          />
          <Path
            d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"
            stroke={color}
            strokeWidth={strokeWidth}
          />
          <Line
            x1="6"
            y1="2"
            x2="6"
            y2="5"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <Line
            x1="10"
            y1="2"
            x2="10"
            y2="5"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <Line
            x1="14"
            y1="2"
            x2="14"
            y2="5"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'leisure':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" style={style}>
          <Rect
            x="2"
            y="6"
            width="20"
            height="12"
            rx="4"
            stroke={color}
            strokeWidth={strokeWidth}
          />
          <Line
            x1="6"
            y1="12"
            x2="10"
            y2="12"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <Line
            x1="8"
            y1="10"
            x2="8"
            y2="14"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <Circle
            cx="15"
            cy="13"
            r="1"
            fill={color}
          />
          <Circle
            cx="18"
            cy="11"
            r="1"
            fill={color}
          />
        </Svg>
      );

    case 'target':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" style={style}>
          <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={strokeWidth} />
          <Circle cx="12" cy="12" r="6" stroke={color} strokeWidth={strokeWidth} />
          <Circle cx="12" cy="12" r="2" stroke={color} strokeWidth={strokeWidth} fill={color} />
        </Svg>
      );

    case 'arrow-left':
    case 'back':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" style={style}>
          <Line
            x1="19"
            y1="12"
            x2="5"
            y2="12"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Polyline
            points="12 19 5 12 12 5"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'bell':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" style={style}>
          <Path
            d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M13.73 21a2 2 0 0 1-3.46 0"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'other':
    default:
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" style={style}>
          <Path
            d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
            stroke={color}
            strokeWidth={strokeWidth}
          />
          <Polyline
            points="14 2 14 8 20 8"
            stroke={color}
            strokeWidth={strokeWidth}
          />
          <Line
            x1="16"
            y1="13"
            x2="8"
            y2="13"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <Line
            x1="16"
            y1="17"
            x2="8"
            y2="17"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        </Svg>
      );
  }
}
