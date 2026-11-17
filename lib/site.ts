export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://peedf.com").replace(/\/$/, "");

export const TOOL_PAGES = [
  { path: "compress", title: "Compress PDF online, free", description: "Shrink a PDF's file size in your browser. Nothing is uploaded." },
  { path: "merge", title: "Merge PDF files online, free", description: "Combine several PDFs into one document in your browser. Nothing is uploaded." },
  { path: "split", title: "Split PDF and extract pages, free", description: "Pull pages or page ranges out of a PDF in your browser. Nothing is uploaded." },
  { path: "image-to-pdf", title: "JPG to PDF converter, free", description: "Turn JPG and PNG images into a single PDF in your browser. Nothing is uploaded." },
  { path: "watermark", title: "Add a watermark to a PDF, free", description: "Stamp text across every page of a PDF in your browser. Nothing is uploaded." },
  { path: "rotate", title: "Rotate PDF pages online, free", description: "Rotate every page of a PDF in your browser. Nothing is uploaded." },
  { path: "pdf-to-jpg", title: "PDF to JPG converter, free", description: "Export each page of a PDF as a JPG image in your browser. Nothing is uploaded." },
  { path: "protect", title: "Password protect a PDF, free", description: "Encrypt a PDF with a password in your browser. Nothing is uploaded." },
] as const;
