import {
  Combine,
  Scissors,
  Minimize2,
  ImagePlus,
  Stamp,
  RotateCw,
  ImageDown,
  Lock,
  type LucideIcon,
} from "lucide-react";

/**
 * Tool registry: the single source of truth for every tool page.
 *
 * The homepage and /tools grids, per-page metadata, canonical URLs, Open Graph
 * images, JSON-LD, the sitemap, footer links and "related tools" all read from
 * this list. To add a tool, add an entry here plus app/<slug>/page.tsx and
 * app/<slug>/workspace.tsx. Bump `updated` whenever a page's content changes so
 * the sitemap's <lastmod> stays honest.
 *
 * Copy rules: describe only what the code actually does. Every tool processes
 * files in the browser with JavaScript; nothing is sent to a server.
 */

export type ToolSlug =
  | "compress"
  | "merge"
  | "split"
  | "image-to-pdf"
  | "watermark"
  | "rotate"
  | "pdf-to-jpg"
  | "protect";

export type Tool = {
  slug: ToolSlug;
  /** Visible name, also the H1. */
  name: string;
  Icon: LucideIcon;
  /** One line on tool cards. */
  card: string;
  /** Line under the H1. */
  lead: string;
  /** <title> (the " · peedf" suffix is added by the layout template). */
  title: string;
  metaDescription: string;
  /** What the output is, used in the "How it works" list and JSON-LD. */
  steps: [string, string, string];
  /** Tool-specific facts about how the file is handled, shown on the page. */
  handling: string[];
  /** Limits beyond the shared per-file size limit. */
  limits: string[];
  related: ToolSlug[];
  /** ISO date of the last meaningful content change on this page. */
  updated: string;
};

export const tools: Tool[] = [
  {
    slug: "compress",
    name: "Compress PDF",
    Icon: Minimize2,
    card: "Shrink file size by recompressing pages.",
    lead: "Make a PDF smaller for email or upload forms, without sending it anywhere.",
    title: "Compress a PDF in your browser",
    metaDescription:
      "Reduce PDF file size on your own device. peedf tries two methods, keeps whichever result is smaller, and tells you if text stops being selectable.",
    steps: [
      "Choose one PDF up to 50 MB.",
      "Pick Light, Recommended or Strong.",
      "Download the smaller copy. Your original is untouched.",
    ],
    handling: [
      "peedf makes two attempts at once: a structural clean-up that keeps the pages exactly as they are, and a version where each page is redrawn as a compressed JPEG image.",
      "Whichever file comes out smaller is offered for download. If the image method wins, text in the new copy is no longer selectable or searchable, and the page says so.",
      "If neither attempt beats the original, peedf tells you rather than handing back a bigger file.",
    ],
    limits: [
      "Password-protected PDFs can't be compressed until the password is removed.",
      "Very long documents are rendered page by page in your browser, so they take longer on slower devices.",
    ],
    related: ["merge", "split", "pdf-to-jpg"],
    updated: "2026-10-08",
  },
  {
    slug: "merge",
    name: "Merge PDF",
    Icon: Combine,
    card: "Combine multiple PDFs into one document.",
    lead: "Put several PDFs together into a single file, in the order you add them.",
    title: "Merge PDF files into one",
    metaDescription:
      "Combine two or more PDFs into a single document on your own device. Files are joined in the order you add them and are never uploaded.",
    steps: [
      "Add two or more PDFs, each up to 50 MB.",
      "Remove any you don't need. Files are joined in the order shown.",
      "Download one merged PDF.",
    ],
    handling: [
      "Every page of every file is copied, in order, into a brand-new PDF built in your browser.",
      "Page content is copied as-is, not re-rendered, so text stays selectable and quality is unchanged.",
    ],
    limits: [
      "Password-protected PDFs can't be merged until the password is removed.",
      "Add files in the order you want them to appear. To change the order, remove a file and add it again.",
    ],
    related: ["split", "compress", "image-to-pdf"],
    updated: "2026-10-08",
  },
  {
    slug: "split",
    name: "Split PDF",
    Icon: Scissors,
    card: "Extract pages or ranges from a PDF.",
    lead: "Pull out just the pages you need into a new, smaller PDF.",
    title: "Split a PDF and extract pages",
    metaDescription:
      "Extract single pages or page ranges such as 1-3, 5 from a PDF into a new file. Runs entirely in your browser, so the document stays on your device.",
    steps: [
      "Choose one PDF up to 50 MB.",
      "Type the pages to keep, for example 1-3, 5, 8-10.",
      "Download a new PDF with just those pages.",
    ],
    handling: [
      "peedf reads the page count in your browser, then copies only the pages you list into a new PDF.",
      "Pages are copied as-is, so text stays selectable and image quality is unchanged.",
      "Pages always come out in their original order, and a page listed twice is only included once.",
    ],
    limits: ["Password-protected PDFs can't be split until the password is removed."],
    related: ["merge", "rotate", "compress"],
    updated: "2026-10-08",
  },
  {
    slug: "image-to-pdf",
    name: "JPG to PDF",
    Icon: ImagePlus,
    card: "Turn images into a PDF.",
    lead: "Turn JPG or PNG images, such as scans and phone photos, into one PDF.",
    title: "Convert JPG and PNG images to PDF",
    metaDescription:
      "Combine JPG and PNG images into a single PDF, one image per page, in the order you choose. Conversion happens on your device and nothing is uploaded.",
    steps: [
      "Add JPG or PNG images, each up to 50 MB.",
      "Use the arrows to set the page order.",
      "Download one PDF with an image on each page.",
    ],
    handling: [
      "Each image becomes one page, sized to match the image, so nothing is cropped or stretched.",
      "JPGs are embedded exactly as they are and PNGs are stored losslessly, so there is no quality loss.",
    ],
    limits: ["Only JPG and PNG are supported. HEIC, WebP and GIF need converting first."],
    related: ["pdf-to-jpg", "merge", "compress"],
    updated: "2026-10-08",
  },
  {
    slug: "watermark",
    name: "Watermark PDF",
    Icon: Stamp,
    card: "Stamp text across every page.",
    lead: "Stamp a word like DRAFT or CONFIDENTIAL diagonally across every page.",
    title: "Add a text watermark to a PDF",
    metaDescription:
      "Stamp diagonal text such as DRAFT or CONFIDENTIAL across every page of a PDF, with light, medium or bold intensity. Processed locally in your browser.",
    steps: [
      "Choose one PDF up to 50 MB.",
      "Type your watermark text and pick an intensity.",
      "Download the watermarked copy.",
    ],
    handling: [
      "The text is drawn in grey at 45°, centred on each page, and scaled to the page size.",
      "The watermark is added on top of the existing content. The rest of each page is left exactly as it was.",
    ],
    limits: [
      "Up to 60 characters. The built-in font covers standard Latin characters, so emoji and some non-Latin scripts aren't supported.",
      "Password-protected PDFs can't be watermarked until the password is removed.",
    ],
    related: ["protect", "rotate", "merge"],
    updated: "2026-10-08",
  },
  {
    slug: "rotate",
    name: "Rotate PDF",
    Icon: RotateCw,
    card: "Rotate every page at once.",
    lead: "Fix sideways or upside-down scans by turning every page in 90° steps.",
    title: "Rotate PDF pages",
    metaDescription:
      "Turn every page of a PDF left or right in 90° steps and save the result. Rotation happens on your device; the file is never uploaded.",
    steps: [
      "Choose one PDF up to 50 MB.",
      "Turn left or right until the preview looks right.",
      "Download the rotated PDF.",
    ],
    handling: [
      "peedf changes each page's rotation setting rather than redrawing it, so text and images keep their full quality.",
      "Rotation is added to whatever rotation a page already has.",
    ],
    limits: [
      "All pages are rotated together. To rotate only some pages, split them out first.",
      "Password-protected PDFs can't be rotated until the password is removed.",
    ],
    related: ["split", "merge", "watermark"],
    updated: "2026-10-08",
  },
  {
    slug: "pdf-to-jpg",
    name: "PDF to JPG",
    Icon: ImageDown,
    card: "Export pages as JPG images.",
    lead: "Save each page of a PDF as a JPG image for slides, chats or social posts.",
    title: "Convert PDF pages to JPG images",
    metaDescription:
      "Export every page of a PDF as a high-quality JPG. A single page downloads as a .jpg and longer documents as a zip. All rendering happens in your browser.",
    steps: [
      "Choose one PDF up to 50 MB.",
      "Start the conversion and watch each page render.",
      "Download a .jpg, or a .zip for multi-page PDFs.",
    ],
    handling: [
      "Pages are rendered in your browser at twice their normal size (about 144 DPI) and saved as JPEG at 92% quality.",
      "A one-page PDF downloads as a single .jpg. Anything longer is packaged into one .zip, also built on your device.",
    ],
    limits: [
      "Password-protected PDFs can't be converted until the password is removed.",
      "Large, image-heavy documents use a lot of memory while rendering, so phones may struggle with very long files.",
    ],
    related: ["image-to-pdf", "compress", "split"],
    updated: "2026-10-08",
  },
  {
    slug: "protect",
    name: "Password Protect PDF",
    Icon: Lock,
    card: "Encrypt a PDF with a password.",
    lead: "Lock a PDF so it asks for a password before it opens.",
    title: "Password protect a PDF",
    metaDescription:
      "Encrypt a PDF with AES-256 so it needs a password to open. Encryption runs on your device; peedf never sees your file or your password.",
    steps: [
      "Choose one PDF up to 50 MB.",
      "Enter a password twice.",
      "Download the encrypted copy.",
    ],
    handling: [
      "The PDF is encrypted with AES-256 in your browser. The password you type is used once to encrypt the file and is never sent or stored.",
      "Anyone opening the new file will be asked for that password by their PDF reader.",
    ],
    limits: [
      "There is no way to recover a lost password, so keep it somewhere safe.",
      "Files that are already encrypted can't be protected again here.",
    ],
    related: ["watermark", "compress", "merge"],
    updated: "2026-10-08",
  },
];

export const toolsBySlug = Object.fromEntries(tools.map((t) => [t.slug, t])) as Record<ToolSlug, Tool>;

export function getTool(slug: ToolSlug): Tool {
  return toolsBySlug[slug];
}

/** Static, indexable non-tool pages and when their content last changed. */
export const staticPages = [
  { path: "/", updated: "2026-10-08", priority: 1 },
  { path: "/tools", updated: "2026-10-08", priority: 0.8 },
  { path: "/privacy", updated: "2026-10-08", priority: 0.3 },
] as const;
