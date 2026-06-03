/**
 * Input — Text input with label, hint, error, icon slots, and search variant.
 * Also exports Textarea with the same pattern.
 */

import React from 'react';
import { Search } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Field label rendered above the input. */
  label?: string;
  /** Helper text rendered below the input. Hidden when error is present. */
  hint?: string;
  /** Error message. When present, renders below input in red and applies error border. */
  error?: string;
  /** Icon node rendered inside the left edge of the input. */
  leftIcon?: React.ReactNode;
  /** Icon node rendered inside the right edge of the input. */
  rightIcon?: React.ReactNode;
  /**
   * Visual variant:
   * - 'default': standard bordered input
   * - 'search': prepends a Search icon, rounded pill style
   */
  variant?: 'default' | 'search';
  /** Additional class names for the outermost wrapper div. */
  className?: string;
}

const LABEL_STYLE: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--color-text-primary)',
  marginBottom: 5,
  fontFamily: 'var(--font-sans)',
};

const HINT_STYLE: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--color-text-tertiary)',
  marginTop: 4,
  fontFamily: 'var(--font-sans)',
};

const ERROR_STYLE: React.CSSProperties = {
  fontSize: 12,
  color: '#dc2626',
  marginTop: 4,
  fontFamily: 'var(--font-sans)',
};

export function Input({
  label,
  hint,
  error,
  leftIcon,
  rightIcon,
  variant = 'default',
  className,
  style,
  id,
  ...rest
}: InputProps) {
  const [focused, setFocused] = React.useState(false);
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  const isSearch = variant === 'search';
  const effectiveLeftIcon = isSearch ? <Search size={14} /> : leftIcon;
  const hasLeft = !!effectiveLeftIcon;
  const hasRight = !!rightIcon;
  const hasError = !!error;

  const wrapperStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    background: 'var(--color-background-primary)',
    border: hasError
      ? '1px solid #dc2626'
      : focused
      ? '1px solid var(--brand)'
      : '1px solid var(--color-border-primary)',
    borderRadius: isSearch ? '999px' : 'var(--radius-md)',
    boxShadow: focused
      ? `0 0 0 3px color-mix(in srgb, var(--brand) 18%, transparent)`
      : 'none',
    transition: `border-color var(--duration-fast) var(--ease-standard),
                 box-shadow var(--duration-fast) var(--ease-standard)`,
    overflow: 'hidden',
  };

  const inputStyle: React.CSSProperties = {
    flex: 1,
    padding: isSearch ? '8px 14px' : '9px 12px',
    paddingLeft: hasLeft ? (isSearch ? 36 : 36) : isSearch ? 14 : 12,
    paddingRight: hasRight ? 36 : 12,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    fontSize: 14,
    color: 'var(--color-text-primary)',
    fontFamily: 'var(--font-sans)',
    width: '100%',
    ...style,
  };

  const iconStyle: React.CSSProperties = {
    position: 'absolute',
    display: 'flex',
    alignItems: 'center',
    color: focused ? 'var(--brand)' : 'var(--color-text-tertiary)',
    pointerEvents: 'none',
    transition: `color var(--duration-fast) var(--ease-standard)`,
  };

  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column' }}>
      {label && (
        <label htmlFor={inputId} style={LABEL_STYLE}>
          {label}
        </label>
      )}

      <div style={{ position: 'relative' }}>
        <div style={wrapperStyle}>
          {hasLeft && (
            <span style={{ ...iconStyle, left: 11, top: '50%', transform: 'translateY(-50%)' }}>
              {effectiveLeftIcon}
            </span>
          )}
          <input
            id={inputId}
            style={inputStyle}
            onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
            onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
            aria-invalid={hasError}
            aria-describedby={
              hasError ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
            }
            {...rest}
          />
          {hasRight && (
            <span style={{ ...iconStyle, right: 11, top: '50%', transform: 'translateY(-50%)' }}>
              {rightIcon}
            </span>
          )}
        </div>
      </div>

      {hasError && (
        <span id={`${inputId}-error`} role="alert" style={ERROR_STYLE}>
          {error}
        </span>
      )}
      {!hasError && hint && (
        <span id={`${inputId}-hint`} style={HINT_STYLE}>
          {hint}
        </span>
      )}
    </div>
  );
}

// ─── Textarea ─────────────────────────────────────────────────────────────────

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Field label rendered above the textarea. */
  label?: string;
  /** Helper text rendered below. Hidden when error is present. */
  hint?: string;
  /** Error message. When present, renders below in red and applies error border. */
  error?: string;
  /** Additional class names for the outermost wrapper div. */
  className?: string;
}

export function Textarea({ label, hint, error, className, id, style, ...rest }: TextareaProps) {
  const [focused, setFocused] = React.useState(false);
  const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  const hasError = !!error;

  const wrapperStyle: React.CSSProperties = {
    background: 'var(--color-background-primary)',
    border: hasError
      ? '1px solid #dc2626'
      : focused
      ? '1px solid var(--brand)'
      : '1px solid var(--color-border-primary)',
    borderRadius: 'var(--radius-md)',
    boxShadow: focused
      ? `0 0 0 3px color-mix(in srgb, var(--brand) 18%, transparent)`
      : 'none',
    transition: `border-color var(--duration-fast) var(--ease-standard),
                 box-shadow var(--duration-fast) var(--ease-standard)`,
  };

  const textareaStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '9px 12px',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    fontSize: 14,
    color: 'var(--color-text-primary)',
    fontFamily: 'var(--font-sans)',
    resize: 'vertical',
    minHeight: 96,
    boxSizing: 'border-box',
    ...style,
  };

  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column' }}>
      {label && (
        <label htmlFor={textareaId} style={LABEL_STYLE}>
          {label}
        </label>
      )}
      <div style={wrapperStyle}>
        <textarea
          id={textareaId}
          style={textareaStyle}
          onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
          aria-invalid={hasError}
          aria-describedby={
            hasError ? `${textareaId}-error` : hint ? `${textareaId}-hint` : undefined
          }
          {...rest}
        />
      </div>
      {hasError && (
        <span id={`${textareaId}-error`} role="alert" style={ERROR_STYLE}>
          {error}
        </span>
      )}
      {!hasError && hint && (
        <span id={`${textareaId}-hint`} style={HINT_STYLE}>
          {hint}
        </span>
      )}
    </div>
  );
}
