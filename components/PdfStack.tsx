"use client";
import { useRef } from "react";
import { FileText, Image as ImageIcon, FileSignature } from "lucide-react";

type Card = {
  icon: typeof FileText;
  accent: string;
  rotate: number;
  x: number;
  y: number;
  depth: number;
  lines: number[];
};

const cards: Card[] = [
  { icon: FileText, accent: "var(--accent)", rotate: -9, x: -120, y: -10, depth: 1.2, lines: [70, 45, 60] },
  { icon: ImageIcon, accent: "var(--coral)", rotate: 7, x: 90, y: 20, depth: 0.8, lines: [55, 80, 40] },
  { icon: FileSignature, accent: "var(--accent-dark)", rotate: -3, x: -10, y: 60, depth: 1, lines: [65, 50, 70] },
];

export default function PdfStack() {
  const ref = useRef<HTMLDivElement>(null);

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.setProperty("--mx", String(px));
    el.style.setProperty("--my", String(py));
  }

  function handleLeave() {
    ref.current?.style.setProperty("--mx", "0");
    ref.current?.style.setProperty("--my", "0");
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className="relative mx-auto h-64 w-full max-w-sm select-none sm:h-72"
      style={{ "--mx": 0, "--my": 0 } as React.CSSProperties}
    >
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <div
            key={i}
            className="absolute left-1/2 top-1/2 w-36 rounded-[1.1rem] border-2 border-[var(--border)] bg-[var(--surface)] p-3 shadow-[0_10px_24px_rgba(24,26,31,0.08)]"
            style={{
              "--r": `${card.rotate}deg`,
              transform: `translate(-50%, -50%) translate(${card.x}px, ${card.y}px) rotate(${card.rotate}deg) translate(calc(var(--mx) * ${card.depth * 14}px), calc(var(--my) * ${card.depth * 14}px))`,
              transition: "transform 0.15s ease-out",
              animation: `float-slow ${4 + i}s ease-in-out infinite`,
              animationDelay: `${i * 0.4}s`,
              zIndex: cards.length - i,
            } as React.CSSProperties}
          >
            <div
              className="flex h-7 w-7 items-center justify-center rounded-[0.5rem]"
              style={{ background: `color-mix(in srgb, ${card.accent} 15%, white)` }}
            >
              <Icon size={14} style={{ color: card.accent }} />
            </div>
            <div className="mt-2.5 space-y-1.5">
              {card.lines.map((w, j) => (
                <div
                  key={j}
                  className="h-1.5 rounded-full bg-[var(--surface-soft)]"
                  style={{ width: `${w}%` }}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
