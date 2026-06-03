"use client";

export function PrintButton() {
  return (
    <button onClick={() => window.print()}>
      Print / Save as PDF
    </button>
  );
}
