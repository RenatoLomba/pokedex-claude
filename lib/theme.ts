/** A manual choice, or "system" to follow `prefers-color-scheme`. */
export type Theme = "system" | "light" | "dark";

/** localStorage key for the saved choice. "system" is stored as the absence of the key. */
export const THEME_STORAGE_KEY = "theme";

/**
 * Runs in `<head>` while the HTML is parsed, so a saved light/dark choice is on `<html data-theme>` before the
 * first paint. Without a saved choice the attribute stays off and the CSS follows the system preference.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;
