import Link from "next/link";

export default function CompressPage(){
 return <main className="min-h-screen"><header className="border-b bg-white"><div className="mx-auto max-w-5xl px-6 py-5"><Link href="/" className="text-xl font-bold">PDF<span className="text-[var(--accent)]">.</span></Link></div></header><section className="mx-auto max-w-4xl px-6 py-16 text-center"><h1 className="text-4xl font-bold">Compress PDF</h1><p className="mt-4 text-[var(--muted)]">Compression workflow being integrated into the processing engine.</p></section></main>
}
