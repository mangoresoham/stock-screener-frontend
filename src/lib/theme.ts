// Dark is the default (see src/styles.css's ":root" comment) -- the ".light" class flips
// every CSS variable over to the light palette already defined there. This module is the
// one place that reads/writes the persisted choice and toggles that class, so the
// FOUC-prevention inline script (see __root.tsx) and the Settings page toggle can't drift
// out of sync on the storage key or the class name.
const THEME_KEY = "screener.theme";
export type Theme = "dark" | "light";

export function getStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(THEME_KEY);
  return v === "light" || v === "dark" ? v : null;
}

export function getCurrentTheme(): Theme {
  return getStoredTheme() ?? "dark";
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("light", theme === "light");
}

export function setTheme(theme: Theme) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}

// Inlined into <head> as a blocking <script> (see __root.tsx) so the right class is set
// before first paint -- doing this only in a useEffect would flash the default (dark)
// theme first for anyone who's chosen light. Kept as a single source-of-truth string
// (not hand-duplicated in JSX) so the storage key/class name below can't drift from the
// functions above.
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var t = window.localStorage.getItem(${JSON.stringify(THEME_KEY)});
    if (t === "light") document.documentElement.classList.add("light");
  } catch (e) {}
})();
`;
