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
      className="mt-8 flex cursor-pointer flex-col items-center rounded-[1.25rem] border-2 border-dashed border-[var(--border)] bg-[var(--surface-soft)] px-4 py-10 text-center transition-colors hover:border-[var(--accent)] sm:mt-10 sm:px-6 sm:py-14"
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
      <div className="flex h-12 w-12 items-center justify-center rounded-[0.85rem] border-2 border-[var(--accent-dark)] bg-[var(--accent-soft)]">
        <Icon size={22} className="text-[var(--accent-dark)]" />
      </div>
      <div className="font-display mt-4 text-base font-bold sm:text-lg">{title}</div>
      {subtitle && <div className="mt-2 text-sm text-[var(--muted)]">{subtitle}</div>}
    </label>
  );
}
