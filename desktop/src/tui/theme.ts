/**
 * src/tui/theme.ts — Cyber-Obsidian Theme Tokens
 *
 * Ports the CSS design tokens from renderer/styles/main.css
 * into blessed-compatible color definitions.
 *
 * Color palette:
 *   Background: #0D1117 (deep), #111820 (panel), #161B24 (surface)
 *   Accents:    #39FF14 (emerald), #00FFFF (cyan), #00E5FF (teal)
 *   Coral:      #FF6B6B, Gold: #FFD700
 *   Text:       #E6EDF3 (primary), #A0AEC0 (secondary), #6B7280 (tertiary)
 */

/** Cyber-Obsidian color constants */
export const C = {
  /** Background palette */
  BG_DEEP: '#0D1117',
  BG_PANEL: '#111820',
  BG_SURFACE: '#161B24',
  BG_ELEVATED: '#1C2330',
  BG_HOVER: '#1E2634',

  /** Accent colors */
  ACCENT_EMERALD: '#39FF14',
  ACCENT_CYAN: '#00FFFF',
  ACCENT_TEAL: '#00E5FF',
  ACCENT_CORAL: '#FF6B6B',
  ACCENT_GOLD: '#FFD700',

  /** Text colors */
  TEXT_PRIMARY: '#E6EDF3',
  TEXT_SECONDARY: '#A0AEC0',
  TEXT_TERTIARY: '#6B7280',
  TEXT_MUTED: '#484F58',

  /** Borders */
  BORDER: '#30363D',
  BORDER_ACTIVE: '#00FFFF',

  /** Quick hex colors for blessed (no # prefix needed) */
  BLACK: 'black',
  WHITE: 'white',
  GREEN: 'green',
  CYAN: 'cyan',
  RED: 'red',
  YELLOW: 'yellow',
  MAGENTA: 'magenta',
  BLUE: 'blue',
} as const;

/** Blessed border style presets */
export const BORDER = {
  /** Thin glass border */
  glass: { type: 'line' as const, fg: C.BORDER },
  /** Active/glowing border */
  active: { type: 'line' as const, fg: C.ACCENT_CYAN },
  /** Emerald glow */
  emerald: { type: 'line' as const, fg: C.ACCENT_EMERALD },
  /** No border */
  none: { type: 'line' as const, fg: C.BG_DEEP },
} as const;

/** Blessed style presets for common elements */
export const STYLE = {
  /** Title bar text */
  title: { fg: C.ACCENT_CYAN, bold: true },
  /** Section headers */
  sectionHeader: { fg: C.TEXT_TERTIARY, bold: true },
  /** Primary text */
  text: { fg: C.TEXT_PRIMARY },
  /** Secondary/dimmed text */
  dim: { fg: C.TEXT_SECONDARY },
  /** Emerald-highlighted text */
  emerald: { fg: C.ACCENT_EMERALD, bold: true },
  /** Cyan-highlighted text */
  cyan: { fg: C.ACCENT_CYAN },
  /** Coral/error text */
  coral: { fg: C.ACCENT_CORAL },
  /** Gold/warning text */
  gold: { fg: C.ACCENT_GOLD },
  /** Monospace font for terminal-style text */
  mono: { fg: C.TEXT_PRIMARY },
} as const;

/** Layout dimensions */
export const LAYOUT = {
  /** Header height */
  HEADER_H: 3,
  /** Command bar height */
  CMD_H: 3,
  /** Left sidebar width */
  SIDEBAR_L_W: 28,
  /** Right sidebar width */
  SIDEBAR_R_W: 34,
  /** Minimum terminal width */
  MIN_WIDTH: 100,
  /** Minimum terminal height */
  MIN_HEIGHT: 30,
} as const;

/**
 * Build a blessed label string with color formatting.
 * blessed uses {...} for color tags, not ansi escape codes directly.
 */
export function label(text: string, color: string = C.TEXT_PRIMARY): string {
  return `{${color}-fg}${text}{/${color}-fg}`;
}

/** Emerald-green highlighted label */
export function emerald(text: string): string {
  return label(text, C.ACCENT_EMERALD);
}

/** Cyan-highlighted label */
export function cyan(text: string): string {
  return label(text, C.ACCENT_CYAN);
}

/** Coral/error label */
export function coral(text: string): string {
  return label(text, C.ACCENT_CORAL);
}

/** Gold/warning label */
export function gold(text: string): string {
  return label(text, C.ACCENT_GOLD);
}

/** Dimmed secondary label */
export function dim(text: string): string {
  return label(text, C.TEXT_SECONDARY);
}

/** Format a number with k/M suffix */
export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

/** Format USD currency */
export function formatUSD(n: number): string {
  return `$${n.toFixed(2)}`;
}

/** Format a timestamp as relative time */
export function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
