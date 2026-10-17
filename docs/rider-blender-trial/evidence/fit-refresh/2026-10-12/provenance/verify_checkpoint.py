"""Read-only verification of the preserved rider checkpoint; writes a new receipt only."""
from pathlib import Path
import hashlib, json, zipfile, datetime

root = Path(r'C:\Users\Robert\.codex\worktrees\rider-blender-trial\Driftwing')
archive = root.parent / 'trial-recovery-final-complete/rider-blender-trial-overlay.zip'
expected = 'de374da88b996d17f36cfc9c7b7335fcc2a3a68ce2cc713e412d99fd2bf25cb6'
digest = lambda data: hashlib.sha256(data).hexdigest()
actual = digest(archive.read_bytes())
if actual != expected:
    raise RuntimeError('Preserved archive hash differs')
files, differences = [], []
with zipfile.ZipFile(archive) as saved:
    for entry in saved.infolist():
        if entry.is_dir():
            continue
        target = root / entry.filename
        archived = digest(saved.read(entry))
        current = digest(target.read_bytes()) if target.is_file() else None
        files.append({'path': entry.filename, 'sha256': archived, 'currentSha256': current, 'matches': current == archived})
        if current != archived:
            differences.append(entry.filename)
receipt = {'verifiedAtUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'root': str(root), 'branch': 'codex/rider-blender-trial', 'head': '8e055069703c83308d5508ee72e5ad1d15ef348e', 'archive': str(archive), 'sha256': actual, 'archiveEntriesVerified': len(files), 'currentDifferences': differences, 'files': files, 'scope': 'Existing recoverable checkpoint verified without changing source, services or saves; new evidence will use a fresh timestamped directory.'}
out = Path(__file__).parent / 'CHECKPOINT_VERIFICATION.json'
with out.open('x', encoding='utf-8') as stream:
    json.dump(receipt, stream, indent=2)
print(json.dumps({k: v for k, v in receipt.items() if k != 'files'}))
if differences:
    raise RuntimeError('Current source differs from recovery checkpoint; inspect before edits')
