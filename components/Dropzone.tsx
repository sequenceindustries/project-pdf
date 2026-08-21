"use client";
import { Upload, type LucideIcon } from "lucide-react";

export default function Dropzone({
  accept,
  multiple = false,
  onFiles,
  title,
  subtitle,
  icon: Icon = Upload,
}: {
  accept: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
}) {
  return (
    <label
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onFiles(Array.from(e.dataTransfer.files));
      }}
      className="mt-8 flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center transition-colors hover:border-[var(--accent)]/50 sm:mt-10 sm:rounded-3xl sm:px-6 sm:py-14"
    >
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          onFiles(Array.from(e.target.files || []));
          e.currentTarget.value = "";
        }}
      />
      <Icon size={28} className="text-[var(--muted)]" />
      <div className="font-display mt-4 text-base font-semibold sm:text-lg">{title}</div>
      {subtitle && <div className="mt-2 text-sm text-[var(--muted)]">{subtitle}</div>}
    </label>
  );
}
