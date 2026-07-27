import { useEffect, useState } from "react";

// The redesign has two shells: a top tab bar (desktop) and a bottom tab bar
// (mobile). Most of the difference is CSS, but the recipe view genuinely renders
// a different tree, so the breakpoint is also needed in JS. 768px matches the
// `<768px` breakpoint documented in the design.
const QUERY = "(max-width: 767px)";

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia(QUERY).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const onChange = (e) => setIsMobile(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
