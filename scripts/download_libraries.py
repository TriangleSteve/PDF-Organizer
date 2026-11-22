#!/usr/bin/env python3
"""One-time vendor download. Requires Python 3 and an Internet connection.
No Node, npm, or build tooling is used.
"""
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / 'vendor'
DEST.mkdir(exist_ok=True)
LIBRARIES = {
    'pdf.min.mjs': 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.5.438/build/pdf.min.mjs',
    'pdf.worker.min.mjs': 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.5.438/build/pdf.worker.min.mjs',
    'pdf-lib.min.js': 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js',
    'Sortable.min.js': 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.7/Sortable.min.js',
}
for name, url in LIBRARIES.items():
    print(f'Downloading {name} ...', flush=True)
    req = Request(url, headers={'User-Agent': 'PDF-Organizer-Vendor/1.0'})
    with urlopen(req, timeout=50) as response:
        data = response.read()
    if len(data) < 5000:
        raise RuntimeError(f'Download looks incomplete: {name} ({len(data)} bytes)')
    (DEST / name).write_bytes(data)
    print(f'  {len(data):,} bytes')
print('Done. Commit the vendor/ files alongside index.html for fully local dependencies.')
