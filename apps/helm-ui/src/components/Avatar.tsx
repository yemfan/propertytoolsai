/**
 * Avatar — the shared AI-employee / persona avatar set.
 *
 * 20 illustrated personas (DiceBear "Notionists", CC0) served as static SVGs from
 * the host app's `/public/avatars/`. The set is shared across every vertical and
 * every AI employee (build once, configure many). A business assigns one per AI
 * employee; `defaultAvatarForSeed` gives a stable fallback before they choose.
 */

import React from 'react';

/** The 20 avatar ids. Files live at `/avatars/<id>.svg` in the host app. */
export const AVATARS: readonly string[] = Array.from(
  { length: 20 },
  (_, i) => `persona-${String(i + 1).padStart(2, '0')}`,
);

/** Public URL for an avatar id. */
export function avatarUrl(id: string): string {
  return `/avatars/${id}.svg`;
}

/** Stable, deterministic avatar for a seed (e.g. an employee slug) — used until a business picks one. */
export function defaultAvatarForSeed(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return AVATARS[Math.abs(h) % AVATARS.length];
}

export interface AvatarProps {
  /** Avatar id, e.g. "persona-03". */
  id: string;
  /** Pixel size (width = height). Defaults to 40. */
  size?: number;
  /** Accessible label. */
  alt?: string;
  className?: string;
}

/** A single circular persona avatar. */
export function Avatar({ id, size = 40, alt = '', className }: AvatarProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatarUrl(id)}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'block',
        objectFit: 'cover',
        background: 'var(--color-background-secondary, #f1f5f9)',
        flexShrink: 0,
      }}
    />
  );
}

export interface AvatarPickerProps {
  /** Currently selected avatar id. */
  value?: string;
  /** Called with the chosen avatar id. */
  onSelect: (id: string) => void;
  /** Tile size in px. Defaults to 56. */
  size?: number;
  /** Disable interaction (e.g. while saving). */
  disabled?: boolean;
  className?: string;
}

/** A grid of all 20 avatars; highlights the selected one. */
export function AvatarPicker({ value, onSelect, size = 56, disabled, className }: AvatarPickerProps) {
  return (
    <div
      className={className}
      role="radiogroup"
      aria-label="Choose an avatar"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(5, ${size}px)`,
        gap: 10,
      }}
    >
      {AVATARS.map((id) => {
        const selected = id === value;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onSelect(id)}
            title={id}
            style={{
              padding: 2,
              borderRadius: '50%',
              border: selected
                ? '2px solid var(--brand)'
                : '2px solid transparent',
              outline: selected ? '2px solid color-mix(in srgb, var(--brand) 30%, transparent)' : 'none',
              outlineOffset: 1,
              background: 'transparent',
              cursor: disabled ? 'default' : 'pointer',
              lineHeight: 0,
              transition: 'border-color var(--duration-fast, 120ms) ease',
            } as React.CSSProperties}
          >
            <Avatar id={id} size={size} />
          </button>
        );
      })}
    </div>
  );
}
