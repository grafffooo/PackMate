import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Close } from "./icons";
import { format, parseLength, round, toDisplay, type Unit } from "../units";

// ---------- Dialog ----------

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function Dialog({
  title,
  subtitle,
  onClose,
  closeLabel,
  width,
  height,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  closeLabel: string;
  width: number;
  height?: number;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current!;
    (
      el.querySelector<HTMLElement>("[data-autofocus]") ??
      el.querySelector<HTMLElement>(FOCUSABLE) ??
      el
    ).focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      } else if (e.key === "Tab") {
        const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
          (x) => x.offsetParent !== null,
        );
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div
      className="scrim"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={ref}
        className="dlg"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{ width, height }}
      >
        <header className="dlg-h">
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            type="button"
            className="iconbtn flat"
            onClick={onClose}
            aria-label={closeLabel}
          >
            <Close />
          </button>
        </header>
        <div className="dlg-body">{children}</div>
        {footer && <footer className="dlg-f">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

// ---------- Segmented control ----------

export function Seg<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------- Circle checkbox ----------

export function Check({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="chk">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{children}</span>
    </label>
  );
}

// ---------- Popover menu ----------

export function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open, close]);
  return ref;
}

export function Menu({
  items,
  onClose,
  align = "right",
}: {
  items: {
    key: string;
    label: string;
    icon?: ReactNode;
    danger?: boolean;
    onSelect: () => void;
  }[];
  onClose: () => void;
  align?: "left" | "right";
}) {
  return (
    <div className={`menu ${align}`} role="menu">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          role="menuitem"
          className={it.danger ? "danger" : ""}
          onClick={() => {
            onClose();
            it.onSelect();
          }}
        >
          {it.icon}
          {it.label}
        </button>
      ))}
    </div>
  );
}

// ---------- Length input (units aware) ----------

export function LengthInput({
  value,
  unit,
  min,
  max,
  onChange,
  id,
  label,
  align = "right",
  suffix = true,
}: {
  value: number;
  unit: Unit;
  min: number;
  max: number;
  onChange: (mm: number) => void;
  id: string;
  label: string;
  align?: "left" | "right";
  suffix?: boolean;
}) {
  const shown = () => String(round(toDisplay(value, unit), unit));
  const [text, setText] = useState(shown);
  const [bad, setBad] = useState(false);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(shown());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, unit]);

  const clamp = (v: number) => Math.min(max, Math.max(min, v));

  const commit = (s: string, final: boolean) => {
    const mm = parseLength(s, unit);
    const ok = mm !== null && mm >= min - 1e-9 && mm <= max + 1e-9;
    setBad(!ok && s.trim() !== "");
    if (ok) onChange(mm);
    if (final) {
      const next = ok ? mm : clamp(mm ?? value);
      if (mm !== null && !ok) onChange(next);
      setBad(false);
      focused.current = false;
      setText(String(round(toDisplay(next, unit), unit)));
    }
  };

  return (
    <div className={`inp ${align === "left" ? "left" : ""}`}>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        aria-label={label}
        aria-invalid={bad || undefined}
        className={bad ? "bad" : ""}
        value={text}
        title={`${format(min, unit)} – ${format(max, unit)}`}
        onFocus={(e) => {
          focused.current = true;
          e.target.select();
        }}
        onChange={(e) => {
          setText(e.target.value);
          commit(e.target.value, false);
        }}
        onBlur={(e) => commit(e.target.value, true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const step =
              (unit === "in" ? 0.0625 * 25.4 : 1) * (e.shiftKey ? 10 : 1);
            const next = clamp(value + (e.key === "ArrowUp" ? step : -step));
            onChange(next);
            setText(String(round(toDisplay(next, unit), unit)));
          }
        }}
      />
      {suffix && <span>{unit === "in" ? "in" : "mm"}</span>}
    </div>
  );
}
