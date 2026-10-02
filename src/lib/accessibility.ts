export type A11ySettings = {
  largeText: boolean;
  highContrast: boolean;
  reduceMotion: boolean;
  dyslexiaFont: boolean;
};

const KEY = "kurdish-library-a11y";

const DEFAULT: A11ySettings = {
  largeText: false,
  highContrast: false,
  reduceMotion: false,
  dyslexiaFont: false,
};

export function loadA11y(): A11ySettings {
  try {
    return { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return DEFAULT;
  }
}

export function saveA11y(settings: A11ySettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage failures.
  }

  applyA11y(settings);
}

export function applyA11y(settings: A11ySettings): void {
  const root = document.documentElement;

  root.toggleAttribute("data-large-text", settings.largeText);
  root.toggleAttribute("data-high-contrast", settings.highContrast);
  root.toggleAttribute("data-reduce-motion", settings.reduceMotion);
  root.toggleAttribute("data-dyslexia-font", settings.dyslexiaFont);
}
