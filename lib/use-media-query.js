import { useSyncExternalStore } from "react";

// true while the window matches the CSS media query, e.g. useMediaQuery("(max-width: 767px)").
// The server snapshot is false: only use it in components that are rendered once the page is loaded in the browser.
export function useMediaQuery(query) {
  return useSyncExternalStore(
    (notify) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", notify);
      return () => list.removeEventListener("change", notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
