"""Reuse Driftwing's existing embedded icon in the new documentation gallery."""
from pathlib import Path
import re, difflib
root = Path(r'C:\Users\Robert\.codex\worktrees\rider-blender-trial\Driftwing')
page = root / 'docs/rider-blender-trial/fit-refresh-2026-10-12.html'
before = page.read_text(encoding='utf-8')
if 'rel="icon"' in before:
    raise RuntimeError('Gallery already has icon; inspect instead of repeating edit')
icon = re.search(r'<link rel="icon"[^>]+>', (root / 'index.html').read_text(encoding='utf-8')).group()
after = before.replace('<title>', icon + '<title>', 1)
assert after != before
page.write_text(after, encoding='utf-8', newline='')
patch = ''.join(difflib.unified_diff(before.splitlines(True), after.splitlines(True), fromfile='a/docs/rider-blender-trial/fit-refresh-2026-10-12.html', tofile='b/docs/rider-blender-trial/fit-refresh-2026-10-12.html'))
with (Path(__file__).parent / 'REVIEW_ICON_CORRECTION.patch').open('x', encoding='utf-8') as stream:
    stream.write(patch)
print('Reused existing embedded icon; gallery only. Runtime/index untouched.')
