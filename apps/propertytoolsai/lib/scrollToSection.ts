/** Smooth-scroll to an element on the current page (reliable for hash anchors vs Next.js Link). */
export function scrollToSection(elementId: string) {
  if (typeof document === "undefined") return;
  const el = document.getElementById(elementId);
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
}
