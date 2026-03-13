const palette = {
  indigo: "#6366f1",
  indigoLight: "#818cf8",
  indigoDark: "#4f46e5",

  dark: {
    bg: "#0f0f0f",
    surface: "#1a1a1e",
    surfaceElevated: "#242428",
    border: "#2a2a2e",
    foreground: "#f5f5f7",
    muted: "#8e8e93",
  },

  light: {
    bg: "#f8f8fa",
    surface: "#ffffff",
    surfaceElevated: "#f2f2f7",
    border: "#e5e5ea",
    foreground: "#1c1c1e",
    muted: "#8e8e93",
  },
};

const Colors = {
  light: {
    background: palette.light.bg,
    surface: palette.light.surface,
    surfaceElevated: palette.light.surfaceElevated,
    border: palette.light.border,
    foreground: palette.light.foreground,
    muted: palette.light.muted,
    primary: palette.indigo,
    primaryForeground: "#ffffff",
    destructive: "#ff3b30",
    accent: palette.indigoLight,
    tint: palette.indigo,
    tabIconDefault: palette.light.muted,
    tabIconSelected: palette.indigo,
    text: palette.light.foreground,
  },
  dark: {
    background: palette.dark.bg,
    surface: palette.dark.surface,
    surfaceElevated: palette.dark.surfaceElevated,
    border: palette.dark.border,
    foreground: palette.dark.foreground,
    muted: palette.dark.muted,
    primary: palette.indigoLight,
    primaryForeground: "#ffffff",
    destructive: "#ff453a",
    accent: palette.indigoLight,
    tint: palette.indigoLight,
    tabIconDefault: palette.dark.muted,
    tabIconSelected: palette.indigoLight,
    text: palette.dark.foreground,
  },
};

export default Colors;
export { palette };
