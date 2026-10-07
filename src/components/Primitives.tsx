'use client';

import { useState, type ReactNode } from 'react';
import { statusLabel, type Intent } from '../lib/format';

/** A section's title, with an optional action on its right. */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 max-w-[60ch]">
        <h1 className="text-[26px] md:text-[30px]">{title}</h1>
        {description ? (
          <p className="mt-2 text-[14px] leading-relaxed text-text-muted">{description}</p>
        ) : null}
      </div>
      {action}
    </header>
  );
}

export function Status({ status, english: en }: { status: Intent['status']; english: boolean }) {
  const [label, tone] = statusLabel(status, en);
  return <span className={`chip shrink-0 ${tone}`}>{label}</span>;
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-3 last:border-0">
      <span className="shrink-0 text-[13px] text-text-muted">{label}</span>
      <span className="min-w-0 break-all text-right text-[13px]">{children}</span>
    </div>
  );
}

/** Copies `value` and says so for two seconds. */
export function CopyButton({
  value,
  label,
  english: en,
  className = 'btn btn-ghost btn-sm',
}: {
  value: string;
  label?: string;
  english: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={() =>
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
      }
    >
      {copied ? (en ? 'Copied ✓' : 'Copiado ✓') : (label ?? (en ? 'Copy' : 'Copiar'))}
    </button>
  );
}

/** A secret Flow returns only once, when it is created. */
export function OneTimeSecret({ value, english: en }: { value: string; english: boolean }) {
  return (
    <div
      className="mb-6 border-y border-r border-l-4 border-pending bg-pending/8 p-4"
      role="status"
    >
      <p className="text-[13px] font-semibold text-pending">
        {en
          ? 'Copy it now: it will not be shown again.'
          : 'Cópiala ahora: no se volverá a mostrar.'}
      </p>
      <code className="mt-2 block font-mono text-[13px] break-all">{value}</code>
      <CopyButton value={value} english={en} className="btn btn-ghost btn-sm mt-3" />
    </div>
  );
}

/** "Remove", then "Remove / Cancel" side by side: one tap never deletes. */
export function ConfirmAction({
  label,
  confirmLabel,
  busy,
  english: en,
  onConfirm,
}: {
  label: string;
  confirmLabel: string;
  busy: boolean;
  english: boolean;
  onConfirm: () => void;
}) {
  const [asking, setAsking] = useState(false);
  if (!asking)
    return (
      <button type="button" className="btn-text text-danger" onClick={() => setAsking(true)}>
        {label}
      </button>
    );
  return (
    <span className="flex shrink-0 gap-2">
      <button type="button" disabled={busy} className="btn btn-danger btn-sm" onClick={onConfirm}>
        {confirmLabel}
      </button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAsking(false)}>
        {en ? 'Cancel' : 'Cancelar'}
      </button>
    </span>
  );
}

export function RowsLoading({ count = 4 }: { count?: number }) {
  return (
    <div className="card divide-y divide-border" aria-busy="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex items-center gap-4 px-4 py-4">
          <div className="flex-1">
            <div className="skeleton mb-2 h-3.5 w-1/3" />
            <div className="skeleton h-2.5 w-1/2" />
          </div>
          <div className="skeleton h-6 w-20" />
        </div>
      ))}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="card px-4 py-10 text-center text-[14px] text-text-muted">{children}</p>;
}

export function Failure({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="mb-4 border-l-4 border-danger bg-danger/8 px-4 py-3 text-[13px]">
      {children}
    </p>
  );
}
