"use client";
import { useRouter } from "next/navigation";
import { PROMPT_KEY } from "@/app/workspace/prompts";

export default function PromptChip({ text }: { text: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        try { sessionStorage.setItem(PROMPT_KEY, text); } catch {}
        router.push("/workspace");
      }}
      className="chip text-left hover:bg-[var(--surface-soft)]"
    >
      {text}
    </button>
  );
}
