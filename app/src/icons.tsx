// Inline stroke icons (no icon font, works offline).
import type { ReactNode } from "react";

const I = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

export const Logo = () => (
  <svg viewBox="0 0 32 32" aria-hidden="true">
    <rect x="1" y="1" width="30" height="30" rx="8" fill="var(--accent)" />
    <path d="M9 12h14v11H9z" fill="none" stroke="var(--accent-ink)" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M9 12l3-4h8l3 4" fill="none" stroke="var(--accent-ink)" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M16 12v11" stroke="var(--accent-ink)" strokeWidth="1.6" strokeDasharray="2 1.6" />
  </svg>
);

export const Download = () => (
  <I>
    <path d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14" />
  </I>
);
export const Back = () => (
  <I>
    <path d="M15 6l-6 6 6 6" />
  </I>
);
export const Play = () => (
  <I>
    <path d="M8 5v14l11-7z" />
  </I>
);
export const Fit = () => (
  <I>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </I>
);
export const LinkIcon = () => (
  <I>
    <path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" />
  </I>
);
export const Save = () => (
  <I>
    <path d="M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6" />
  </I>
);
export const Close = () => (
  <I>
    <path d="M6 6l12 12M18 6L6 18" />
  </I>
);
export const Trash = () => (
  <I>
    <path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" />
  </I>
);
export const Reset = () => (
  <I>
    <path d="M4 12a8 8 0 108-8 8 8 0 00-6 2.7M4 4v4h4" />
  </I>
);
