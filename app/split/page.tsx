import Link from "next/link";

export default function SplitPage(){
 return <main className="min-h-screen"><header className="border-b bg-white"><div className="mx-auto max-w-5xl px-6 py-5"><Link href="/" className="text-xl font-bold">PDF<span className="text-[var(--accent)]">.</span></Link></div></header><section className="mx-auto max-w-4xl px-6 py-16 text-center"><h1 className="text-4xl font-bold">Split PDF</h1><p className="mt-4 text-[var(--muted)]">Page extraction engine coming in the next MVP build pass.</p><div className="mt-8 rounded-2xl border bg-white p-8">Upload workflow placeholder</div></section></main>
}
