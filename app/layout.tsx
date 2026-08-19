import "./globals.css";import type {Metadata} from "next";
export const metadata:Metadata={title:"PDF. — Free PDF Tools",description:"Merge, split and convert PDFs with simple browser-first tools."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}