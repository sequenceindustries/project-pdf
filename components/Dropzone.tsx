"use client";
import { Upload, type LucideIcon } from "lucide-react";

export default function Dropzone({
  accept,
  multiple = false,
  onFiles,
  title,
  subtitle,
  icon: Icon = Upload,
  compact = false,
}: {
  accept: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  compact?: boolean;
}) {
  return (
    <label
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onFiles(Array.from(e.dataTransfer.files));
      }}
      className={`${compact ? "mt-0 px-4 py-8" : "mt-8 px-4 py-10 sm:mt-10 sm:px-6 sm:py-14"} flex cursor-pointer flex-col items-center rounded-[1.75rem] border-[1.5px] border-dotted border-[var(--fg)] ${compact ? "bg-transparent" : "bg-[var(--surface)]"} text-center transition-colors hover:bg-[var(--surface-soft)]`}
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
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent)]">
        <Icon size={22} className="text-[var(--accent-ink)]" />
      </div>
      <div className="font-display mt-4 text-base font-bold sm:text-lg">{title}</div>
      {subtitle && <div className="mt-2 text-sm text-[var(--muted)]">{subtitle}</div>}
    </label>
  );
}
