#!/usr/bin/env python3
"""Repository-owned size gate for a local directory or offline ZIP."""
import sys
import zipfile
from pathlib import Path, PurePosixPath

path = Path(sys.argv[1])
MiB = 1024 * 1024
warnings = []
errors = []
if path.is_dir():
    entries = [(p.relative_to(path).as_posix(), p.stat().st_size) for p in path.rglob('*') if p.is_file()]
else:
    with zipfile.ZipFile(path) as archive:
        entries = [(i.filename, i.file_size) for i in archive.infolist() if not i.is_dir()]
    if path.stat().st_size > 10 * MiB:
        errors.append('ZIP exceeds the 10 MiB limit')
    elif path.stat().st_size > 2 * MiB:
        warnings.append('ZIP exceeds the recommended 2 MiB')
if not any(name == 'index.html' for name, _ in entries):
    errors.append('Missing root index.html')
text_total = 0
for name, size in entries:
    parts = PurePosixPath(name)
    if parts.is_absolute() or '..' in parts.parts:
        errors.append('Unsafe package path: ' + name)
    if parts.suffix.lower() in {'.html', '.css', '.js', '.json'}:
        text_total += size
        if size > 2 * MiB:
            warnings.append('Large text resource: ' + name)
if text_total > 5 * MiB:
    warnings.append('Text resources exceed 5 MiB uncompressed')
for message in warnings:
    print('WARN: ' + message)
for message in errors:
    print('ERROR: ' + message)
print(f'{"FAIL" if errors else "PASS"}: {len(entries)} file(s), {len(warnings)} warning(s)')
sys.exit(1 if errors else 0)
