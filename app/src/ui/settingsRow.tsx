import type { ReactNode } from "react";

export function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="row">
      <div className="lab">
        <b>{label}</b>
        {hint && <span>{hint}</span>}
      </div>
      <div>{children}</div>
    </div>
  );
}
