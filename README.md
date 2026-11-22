# PDF Organizer 

A lightweight, browser-based tool for combining and rearranging pages from multiple PDF files. PDF contents are processed on your device, with no backend or file-upload service. The app is a plain static site that can be hosted directly on GitHub Pages; it does not require Vite, Node.js, npm, or a build step.

## Features

- Add multiple PDF documents using the file picker or drag and drop.
- Browse source documents with page thumbnails and full-page previews.
- Select individual pages, select all, or Shift-click to select a range.
- Add selected pages to the beginning or end of the output document.
- Drag pages to reorder the horizontally scrolling output strip.
- Remove individual output pages or remove a source document and its associated pages.
- Undo or redo changes to the output arrangement.
- Choose an output filename, generate a merged PDF, and download it.
- Process PDFs entirely in the browser, without sending their contents to a server.

## Limitations

- Password-protected or encrypted PDFs are not supported.
- Digital signatures, complex interactive forms, bookmarks, and certain document-level metadata may not survive page extraction.
- Large documents can use substantial browser memory and may take longer to render or export.
- There is no saved workspace: refreshing the page resets the current session.
- This app rearranges existing pages; it does not edit text or graphics within a page.

## Run locally

Serve the project directory using any basic HTTP server. For example, with Python 3:

```sh
python3 -m http.server 8000
```

Open http://localhost:8000/ in your browser. Avoid opening `index.html` directly as a `file://` URL: browser security restrictions can interfere with JavaScript modules and PDF.js workers.

### One-time setup: local JavaScript libraries

The app uses version-pinned copies of PDF.js, pdf-lib, and SortableJS in `vendor/`. If these files are missing, run this once with Python 3 and an internet connection:

```sh
python3 scripts/download_libraries.py
```

Commit the resulting four library files alongside the site. Once present, PDF Organizer loads its dependencies locally; no external CDN is required at runtime. If the files are absent, the app attempts to load pinned CDN copies as a fallback. **PDF contents are not sent to those CDNs.**

### Deploy on GitHub Pages

1. Commit `index.html`, `src/`, `favicon.svg`, and the populated `vendor/` directory to the repository root.
2. In the repository, select **Settings → Pages → Build and deployment**.
3. Set **Source** to **Deploy from a branch**, choose **main** and **/(root)**, then save.
4. Visit `https://<username>.github.io/<repository>/` after Pages finishes publishing.

No build command or GitHub Actions deployment workflow is needed. If you previously used Vite, remove its obsolete config, package files, and deployment workflow.

## Created in collaboration with AI

PDF Organizer was developed through a human–AI collaboration. The project's requirements, usability goals, design direction, and iterations were guided by its creator, with AI assistance used to develop and refine the implementation and documentation. The result is open to inspection and modification like any other static web project.
