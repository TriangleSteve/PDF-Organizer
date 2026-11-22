# Local third-party libraries

To include PDF.js, pdf-lib, and SortableJS as local files, run:

```sh
python3 scripts/download_libraries.py
```

This creates these files in this directory:

- `pdf.min.mjs` — Mozilla PDF.js 6.5.438
- `pdf.worker.min.mjs` — matching PDF.js worker
- `pdf-lib.min.js` — pdf-lib 1.17.1
- `Sortable.min.js` — SortableJS 1.15.7

The files are excluded from this source ZIP because outbound access to the npm/CDN
registry was unavailable in the environment that produced it. While the files are
absent, the app transparently uses the same version-pinned CDN URLs at runtime.
Once all four are committed, no CDN is required by the app.
