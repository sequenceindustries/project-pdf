"use client";
import { useId, useState } from "react";
import { Upload, type LucideIcon } from "lucide-react";

/**
 * File picker + drop target. The real <input type="file"> is visually hidden
 * but stays focusable, so keyboard and screen-reader users can Tab to it and
 * press Enter/Space to browse. Files are only read locally by the tool.
 */
export default function Dropzone({
  accept,
  multiple = false,
  onFiles,
  title,
  subtitle,
  icon: Icon = Upload,
  disabled = false,
}: {
  accept: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  disabled?: boolean;
}) {
  const id = useId();
  const [over, setOver] = useState(false);

  return (
    <label
      htmlFor={id}
      onDragOver={(e) => {
        e.preventDefault();
        if (!over) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled) onFiles(Array.from(e.dataTransfer.files));
      }}
      className={`mt-8 flex cursor-pointer flex-col items-center rounded-[1.25rem] border-2 border-dashed px-4 py-10 text-center transition-colors focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent)] focus-within:ring-offset-2 hover:border-[var(--accent)] sm:mt-10 sm:px-6 sm:py-14 ${
        over ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)] bg-[var(--surface-soft)]"
      }`}
    >
      <input
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          onFiles(Array.from(e.target.files || []));
          e.currentTarget.value = "";
        }}
      />
      <span
        aria-hidden="true"
        className="flex h-12 w-12 items-center justify-center rounded-[0.85rem] border-2 border-[var(--accent-dark)] bg-[var(--accent-soft)]"
      >
        <Icon size={22} className="text-[var(--accent-dark)]" />
      </span>
      <span className="font-display mt-4 text-base font-bold sm:text-lg">{title}</span>
      {subtitle && <span className="mt-2 text-sm text-[var(--muted)]">{subtitle}</span>}
      <span className="mt-3 text-xs text-[var(--muted)]">
        Processed on your device · never uploaded
      </span>
    </label>
  );
}
