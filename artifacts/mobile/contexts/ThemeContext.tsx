import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useColorScheme as useSystemColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Colors from "@/constants/colors";

type ThemeMode = "system" | "light" | "dark";

type ThemeContextType = {
  mode: ThemeMode;
  isDark: boolean;
  colors: typeof Colors.dark;
  setMode: (mode: ThemeMode) => void;
  accentColor: string;
  setAccentColor: (color: string) => void;
};

const ThemeContext = createContext<ThemeContextType>({
  mode: "system",
  isDark: true,
  colors: Colors.dark,
  setMode: () => {},
  accentColor: Colors.dark.primary,
  setAccentColor: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [accentColor, setAccentColorState] = useState(Colors.dark.primary);

  useEffect(() => {
    AsyncStorage.getItem("theme_mode").then((v) => {
      if (v === "light" || v === "dark" || v === "system") setModeState(v);
    });
    AsyncStorage.getItem("accent_color").then((v) => {
      if (v) setAccentColorState(v);
    });
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem("theme_mode", m);
  }, []);

  const setAccentColor = useCallback((c: string) => {
    setAccentColorState(c);
    AsyncStorage.setItem("accent_color", c);
  }, []);

  const isDark =
    mode === "system" ? systemScheme !== "light" : mode === "dark";
  const colors = isDark ? Colors.dark : Colors.light;

  return (
    <ThemeContext.Provider
      value={{ mode, isDark, colors, setMode, accentColor, setAccentColor }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
