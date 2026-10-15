# Peedf

Peedf (peedf.com) is a PDF workspace by Sequence Industries.

**Upload a PDF. Tell Peedf what you need. Get it done.**

- **Workspace (homepage):** upload PDFs or images, type an instruction ("remove pages 5–8 and compress", "merge these", "summarise this and list key dates"), and download the result. Jobs are durable, processed by a background worker in sandboxed threads, verified, and deleted after 24 hours.
- **Single tools** (`/merge`, `/split`, `/compress`, …): run entirely in the browser. Nothing is uploaded.

Stack: Next.js 15 · TypeScript · Postgres (Railway) · pdf-lib · pdf.js + @napi-rs/canvas · Anthropic API (optional).

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for design, security, retention and deployment, and `.env.example` for configuration.

```bash
npm install
npm run dev            # web
npm run dev:worker     # background worker
npm test               # unit + PDF operation tests
DATABASE_URL=postgres://…/peedf_test npm run test:integration
```
