import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ThemeMode = "light" | "dark" | "sepia" | "eink" | "oled";
export type AppTheme = ThemeMode;

type ThemeContextValue = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  fontSize: number;
  lineHeight: number;
  margins: number;
  setFontSize: (value: number) => void;
  setLineHeight: (value: number) => void;
  setMargins: (value: number) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function normalizeMode(mode: ThemeMode): ThemeMode {
  return mode;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("light");
  const [fontSize, setFontSize] = useState(18);
  const [lineHeight, setLineHeight] = useState(1.7);
  const [margins, setMargins] = useState(20);

  const setMode = (next: ThemeMode) => setModeState(normalizeMode(next));

  useEffect(() => {
    document.documentElement.dataset.theme = mode;
  }, [mode]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--kl-reader-font-size", `${fontSize}px`);
    root.style.setProperty("--kl-reader-line-height", String(lineHeight));
    root.style.setProperty("--kl-reader-margins", `${margins}px`);
  }, [fontSize, lineHeight, margins]);

  const value = useMemo(
    () => ({
      mode,
      setMode,
      theme: mode,
      setTheme: setMode,
      fontSize,
      lineHeight,
      margins,
      setFontSize,
      setLineHeight,
      setMargins,
    }),
    [mode, fontSize, lineHeight, margins],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }
  return value;
}
