# PDF Organizer 

A lightweight static site for rearranging pages from multiple PDF files. All PDF
processing runs client-side. No backend, Vite, Node.js, npm, or build step.

## One-time setup to bundle the libraries locally

Run **once** in the project directory (Python 3 with Internet access is required):

```sh
python3 scripts/download_libraries.py
```

This downloads four version-pinned JavaScript assets into `vendor/`. Commit the
`vendor/` files to GitHub with the rest of the site. Once those files are present,
**all application dependencies load locally**, even with no external CDN access.

**Important:** The four libraries are NOT already present in this ZIP: the
packaging environment could not reach their servers. To make the source ZIP
usable before the one-time step, the site falls back to their version-pinned
CDN URLs if a local asset is missing. The PDF contents themselves are never
sent to any server.

## GitHub Pages deployment without Actions

1. Upload all files to your repository's root (including `src/`, `vendor/`, and `favicon.svg`).
2. Run the vendor downloader above on your computer and commit the four new files.
3. Remove the old `.github/workflows/deploy.yml` and other Vite files from the
   existing GitHub repository (`package.json`, `package-lock.json`, `vite.config.js`).
4. In **Settings → Pages → Build and deployment**, select **Deploy from a branch**.
5. Select **main**, folder **/(root)**, and Save.
6. The site will be available at `https://<username>.github.io/<repository>/`.

No build or workflow is necessary. Relative paths work inside GitHub Pages project sites.

## Run locally

Use any simple HTTP server, for example:

```sh
python3 -m http.server 8000
```

Open http://localhost:8000/. Avoid opening `index.html` as a `file://` URL: browser
security rules can block JavaScript modules, PDF.js workers, and PDF file loading.

## Features

- Add multiple PDFs or drag PDFs onto the app
- Select pages, including ranges, and add them to the beginning or end
- Preview source and output pages
- Drag to reorder output pages
- Undo/redo output arrangement
- Remove source files; their output pages and undo history references are removed
- Generate a PDF with the chosen filename and page order

## Limitations

- Password-protected/encrypted files aren't supported.
- Signed PDFs and complex form/document metadata may not survive extraction.
- Large PDFs can consume substantial browser memory.
- Refreshing the page clears the session.
