/**
 * AppShell — Root layout composing a fixed-width sidebar with a scrollable main content area.
 * The sidebar slot accepts any React node (typically <Sidebar />).
 * The main area fills the remaining horizontal space and scrolls independently.
 */

import React from 'react';

export interface AppShellProps {
  /** Sidebar content. Pass a <Sidebar /> component. */
  sidebar: React.ReactNode;
  /** Main content. Fills remaining width and scrolls independently. */
  children: React.ReactNode;
  /** Additional class names for the outermost container. */
  className?: string;
}

export function AppShell({ sidebar, children, className }: AppShellProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: 'var(--color-background-secondary)',
        overflow: 'hidden',
      } as React.CSSProperties}
    >
      {/* Sidebar — fixed width, full height */}
      <div
        style={{
          flexShrink: 0,
          position: 'sticky',
          top: 0,
          height: '100vh',
          zIndex: 40,
        }}
      >
        {sidebar}
      </div>

      {/* Main content area */}
      <main
        style={{
          flex: 1,
          minWidth: 0,
          height: '100vh',
          overflowY: 'auto',
          overflowX: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        } as React.CSSProperties}
      >
        {children}
      </main>
    </div>
  );
}
