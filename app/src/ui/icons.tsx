// Inline stroke icons: no icon font, works offline.
import type { ReactNode } from "react";

const I = ({
  children,
  size = 18,
  fill,
}: {
  children: ReactNode;
  size?: number;
  fill?: boolean;
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={fill ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth={1.9}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

type P = { size?: number };

export const Logo = ({ size = 32 }: P) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
    <circle cx="16" cy="16" r="16" style={{ fill: "var(--acc)" }} />
    <path
      d="M9.5 13.5h13v9h-13zM9.5 13.5l3-4.5h7l3 4.5"
      fill="none"
      stroke="#fff"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path
      d="M16 13.5v9"
      stroke="#fff"
      strokeWidth="1.6"
      strokeDasharray="2 1.8"
    />
  </svg>
);

export const Plus = ({ size }: P) => (
  <I size={size}>
    <path d="M12 5v14M5 12h14" />
  </I>
);
export const Chevron = ({ size }: P) => (
  <I size={size}>
    <path d="M9 6l6 6-6 6" />
  </I>
);
export const ChevronDown = ({ size }: P) => (
  <I size={size}>
    <path d="M6 9l6 6 6-6" />
  </I>
);
export const Close = ({ size }: P) => (
  <I size={size}>
    <path d="M6 6l12 12M18 6L6 18" />
  </I>
);
export const Back = ({ size }: P) => (
  <I size={size}>
    <path d="M15 6l-6 6 6 6" />
  </I>
);
export const Download = ({ size }: P) => (
  <I size={size}>
    <path d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14" />
  </I>
);
export const Sliders = ({ size }: P) => (
  <I size={size}>
    <path d="M4 7h9M19 7h1M4 17h1M11 17h9" />
    <circle cx="16" cy="7" r="2.5" />
    <circle cx="8" cy="17" r="2.5" />
  </I>
);
export const Grid = ({ size }: P) => (
  <I size={size}>
    <rect x="4" y="4" width="7" height="7" rx="2" />
    <rect x="13" y="4" width="7" height="7" rx="2" />
    <rect x="4" y="13" width="7" height="7" rx="2" />
    <rect x="13" y="13" width="7" height="7" rx="2" />
  </I>
);
export const Swap = ({ size }: P) => (
  <I size={size}>
    <path d="M7 7h11l-3-3M17 17H6l3 3" />
  </I>
);
export const Play = ({ size }: P) => (
  <I size={size} fill>
    <path d="M8 5v14l11-7z" />
  </I>
);
export const Pause = ({ size }: P) => (
  <I size={size} fill>
    <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
  </I>
);
export const Folder = ({ size }: P) => (
  <I size={size}>
    <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
  </I>
);
export const FolderPlus = ({ size }: P) => (
  <I size={size}>
    <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    <path d="M12 10v6M9 13h6" />
  </I>
);
export const Check = ({ size }: P) => (
  <I size={size}>
    <path d="M5 12l5 5 9-10" />
  </I>
);
export const More = ({ size }: P) => (
  <I size={size}>
    <circle cx="5" cy="12" r="1.2" fill="currentColor" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    <circle cx="19" cy="12" r="1.2" fill="currentColor" />
  </I>
);
export const Box3 = ({ size }: P) => (
  <I size={size}>
    <path d="M4 8l8-4 8 4v8l-8 4-8-4z" />
    <path d="M4 8l8 4 8-4M12 12v8" />
  </I>
);
export const Ruler = ({ size }: P) => (
  <I size={size}>
    <path d="M4 16l12-12 4 4L8 20H4z" />
    <path d="M12 8l2 2M9 11l1.5 1.5" />
  </I>
);
export const FolderBig = ({ size = 38 }: P) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    <path d="M12 10.5v5M9.5 13h5" />
  </svg>
);
