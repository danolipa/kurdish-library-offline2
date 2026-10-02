const DEFAULT_FONT_CSS = "/fonts/kurdish-library.css";

export async function loadKurdishFonts(): Promise<void> {
  if (typeof document === "undefined") return;
  if (document.querySelector('link[data-kurdish-fonts="1"]')) return;

  try {
    const response = await fetch(DEFAULT_FONT_CSS, { cache: "force-cache" });
    if (!response.ok) return;
    const css = await response.text();
    const style = document.createElement("style");
    style.dataset.kurdishFonts = "1";
    style.textContent = css;
    document.head.appendChild(style);
  } catch {
    // Font loading is optional; system fallbacks remain available offline.
  }
}
