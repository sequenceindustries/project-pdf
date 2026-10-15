"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp } from "lucide-react";
import { PROMPT_KEY } from "@/app/workspace/prompts";

const QUICK = ["Summarise this document", "What are the key risks?", "List every date and amount"];

/** Hands the instruction to the workspace via sessionStorage (never in the URL). */
export default function HeroPrompt() {
  const router = useRouter();
  const [text, setText] = useState("");
  function go(value: string) {
    try { sessionStorage.setItem(PROMPT_KEY, value); } catch {}
    router.push("/workspace");
  }
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); go(text); }}
      className="rounded-[2rem] bg-[var(--surface)] p-3 sm:p-4"
    >
      <label htmlFor="hero-instr" className="sr-only">What do you need done with your PDF?</label>
      <div className="flex items-end gap-3">
        <textarea
          id="hero-instr"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); go(text); } }}
          rows={2}
          maxLength={1000}
          placeholder="Tell peedf what you need, e.g. “Summarise this lease and list the deadlines”"
          className="min-h-[3.5rem] w-full resize-none bg-transparent px-3 py-2 text-base outline-none placeholder:text-[var(--muted)]"
        />
        <button type="submit" aria-label="Continue to the workspace" className="btn btn-primary h-12 w-12 shrink-0 p-0">
          <ArrowUp size={20} />
        </button>
      </div>
      <div className="dotted-t mt-3 flex flex-wrap gap-2 pt-3">
        {QUICK.map((q) => (
          <button key={q} type="button" onClick={() => go(q)} className="chip hover:bg-[var(--surface-soft)]">{q}</button>
        ))}
      </div>
    </form>
  );
}
