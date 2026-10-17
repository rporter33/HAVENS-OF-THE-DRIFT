"""Verify original worktree and trial source identity; write only a unique receipt."""
from pathlib import Path
import hashlib, json, subprocess, datetime

task = Path(__file__).parent
trial = Path(r'C:\Users\Robert\.codex\worktrees\rider-blender-trial\Driftwing')
original = Path(r'C:\Users\Robert\.codex\worktrees\rider-c02-proof\Driftwing')
owner = Path(r'C:\Users\Robert\Projects\Driftwing')
baseline = json.loads((trial.parent / 'baseline-8e05506/verification.json').read_text(encoding='utf-8-sig'))
checkpoint = json.loads((task / 'CHECKPOINT_VERIFICATION.json').read_text(encoding='utf-8-sig'))
digest = lambda p: hashlib.sha256(p.read_bytes()).hexdigest() if p.is_file() else None
def git(root, *args):
    return subprocess.run(['git', '-C', str(root), *args], check=True, capture_output=True, text=True).stdout.strip()
def identity(root):
    return {'path': str(root), 'root': git(root, 'rev-parse', '--show-toplevel'),
            'branch': git(root, 'branch', '--show-current'), 'head': git(root, 'rev-parse', 'HEAD'),
            'status': git(root, 'status', '--porcelain=v2', '--untracked-files=all')}
original_differences = []
for row in baseline['files']:
    actual = digest(original / row['path'])
    if actual != row['sha256']:
        original_differences.append({'path': row['path'], 'expected': row['sha256'], 'actual': actual})
trial_differences = []
for row in checkpoint['files']:
    actual = digest(trial / row['path'])
    if actual != row['sha256']:
        trial_differences.append({'path': row['path'], 'expected': row['sha256'], 'actual': actual})
original_state, trial_state, owner_state = identity(original), identity(trial), identity(owner)
report = {'verifiedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
          'scope': 'Read-only verification after fresh QA, before documentation/evidence additions. No files or services changed by this verifier.',
          'original': original_state, 'trial': trial_state, 'owner': owner_state,
          'originalFilesChecked': len(baseline['files']), 'originalDifferences': original_differences,
          'originalStatusUnchanged': original_state['status'].strip() == baseline['originalStatus'].strip(),
          'trialCheckpointFilesChecked': len(checkpoint['files']), 'trialDifferences': trial_differences}
with (task / 'PRESERVATION_AFTER_QA.json').open('x', encoding='utf-8') as stream:
    json.dump(report, stream, indent=2)
print(json.dumps({k: v for k, v in report.items() if k not in ('original', 'trial', 'owner')}, indent=2))
if original_differences or trial_differences or not report['originalStatusUnchanged']:
    raise RuntimeError('Preservation mismatch: inspect receipt; do not overwrite originals')
if original_state['head'] != baseline['head'] or trial_state['head'] != baseline['head']:
    raise RuntimeError('HEAD changed; inspect before affected work')
