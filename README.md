# Pagecraft — Private PDF Organizer

A static, client-side PDF page organizer. Add several PDFs, select source pages, arrange them in a horizontal filmstrip, and download a new PDF. **Your PDFs are not uploaded to any server.**

## Run locally

Requirements: Node.js 22+ and npm.

```bash
npm install
npm run dev
```

Open the localhost URL printed by Vite. For a production preview:

```bash
npm run build
npm run preview
```

## Deploy to GitHub Pages

1. Create a **new GitHub repository** (public, or private with GitHub Pages available on your plan).
2. Copy the **contents** of this directory to the root of the repository, including `.github/workflows/deploy.yml`.
3. Optionally run `npm install` locally and commit the generated `package-lock.json` for fully reproducible dependency resolution. The included workflow also works without a lockfile.
4. Commit and push everything to the repository's `main` branch.
5. In repository **Settings → Pages → Build and deployment**, set **Source** to **GitHub Actions**.
6. Wait for the `Deploy to GitHub Pages` workflow to finish, then open the URL shown in **Settings → Pages**.

The Vite `base: './'` setting makes the site work at repository project paths without changing configuration.

## Features

- Add multiple files, including via drag-and-drop
- Scrollable source-file list, thumbnail preview grid, full-size page preview
- Click, shift-click, select-all, and clear source selection
- Add selected pages to the start or end of the output
- Reuse any source page more than once
- Horizontal output filmstrip; drag to reorder or remove pages individually
- Undo/redo for output changes (buttons and keyboard shortcuts)
- Name and download the generated PDF
- Local PDF processing; no backend, credentials, analytics, or CDN runtime dependencies

## Dependencies

- `pdfjs-dist` — read and render thumbnail previews
- `pdf-lib` — copy original page content into the exported PDF
- `sortablejs` — drag and drop ordering
- `vite` — static build and dev server

## Known limitations

- Encrypted/password-protected PDF files aren't supported in v1.
- Digital signatures, bookmarks, attachments and complex document-level features may not survive page extraction. The app is intended for visual PDF pages, not specialized PDF editing.
- Very large PDFs can use substantial browser memory during thumbnail generation or export.
- Clearing browser memory/reloading the page loses the session; there is no server persistence.
- PDF content is not uploaded; GitHub Pages only hosts the app's code.

## Version 1.1 UI changes

Removed the application header and redundant helper copy, moved the output filename and Generate PDF button into the Output document heading, and added a local SVG favicon. PDF processing behavior remains unchanged.
