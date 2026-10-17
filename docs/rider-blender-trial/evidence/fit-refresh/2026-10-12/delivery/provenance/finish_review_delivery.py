"""Record the fixed gallery check and preserve both packaging versions."""
from pathlib import Path
import datetime, difflib, hashlib, json, zipfile
task = Path(__file__).parent
root = Path(r'C:\Users\Robert\.codex\worktrees\rider-blender-trial\Driftwing')
docs = root / 'docs/rider-blender-trial'
evidence = docs / 'evidence/fit-refresh/2026-10-12'
digest = lambda b: hashlib.sha256(b).hexdigest()
load = lambda p: json.loads(p.read_text(encoding='utf-8-sig'))
passed_dir = task / 'delivery-2026-10-12T06-50-41-640Z'
failed_dir = task / 'delivery-2026-10-12T06-48-05-268Z'
passed = load(passed_dir / 'report.json')
assert not passed['errors'] and not passed.get('failure') and not passed['failedResponses']
assert len(passed['images']) == 40 and len(passed['checks']) == 5
manifest_path = docs / 'FIT_REFRESH_FILES_2026-10-12.json'
old_manifest = load(manifest_path)
files = {root / r['path'] for r in old_manifest['files']}
def put(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    raw = data.encode('utf-8') if isinstance(data, str) else data
    with path.open('xb') as stream:
        stream.write(raw)
    assert path.read_bytes() == raw
    files.add(path)
for src in [task / 'check_review_delivery.mjs', task / 'fix_review_icon.py', task / 'finish_review_delivery.py', task / 'REVIEW_ICON_CORRECTION.patch']:
    put(evidence / 'delivery/provenance' / src.name, src.read_bytes())
for source, label in [(failed_dir, 'initial-missing-icon'), (passed_dir, 'corrected-pass')]:
    for src in sorted(source.iterdir()):
        if src.is_file():
            put(evidence / 'delivery' / label / src.name, src.read_bytes())
delivery = {'verifiedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'result': 'PASS after a documentation-gallery icon correction',
    'checks': passed['checks'], 'imageCount': len(passed['images']), 'browserErrors': [], 'failedResponses': [],
    'initialFailure': 'New HTML gallery omitted embedded favicon; browser requested /favicon.ico and reported404. All40images and entrylinks had passed. Retained initial failed report/screenshot.',
    'fix': 'New gallery reuses existing index.html embedded icon. index/runtime/assets unchanged; no errors filtered or assertions weakened.',
    'passedReport': 'evidence/fit-refresh/2026-10-12/delivery/corrected-pass/report.json',
    'failedReport': 'evidence/fit-refresh/2026-10-12/delivery/initial-missing-icon/report.json',
    'sourceChanges': False, 'services': {'5210':17620, '5211':34960, '5214':14460},
    'serviceScope': 'Existing listening PIDs verified read-only at final status check; no service restarted or stopped.'}
put(docs / 'FIT_REFRESH_DELIVERY_2026-10-12.json', json.dumps(delivery, indent=2) + '\n')
qa = docs / 'QA.md'
qa.write_bytes(qa.read_bytes() + b'\n\nFresh review delivery: five checks PASS (four local entry links + all 40 full-size images decoded), zero browser/resource errors after reusing the existing embedded icon in the new HTML gallery. Initial missing-favicon 404 and corrected run are both preserved in FIT_REFRESH_DELIVERY_2026-10-12.json. No runtime/index/assets changed, error filtering or weakened assertion.\n')
files.add(qa)
md = docs / 'FIT_REFRESH_2026-10-12.md'
md.write_text(md.read_text(encoding='utf-8') + '\nThe fresh gallery delivery check passes all five checks: four local entry links and all 40 full-size evidence images decode, with zero browser/resource errors. The first attempt caught a missing gallery favicon; the gallery now reuses the existing embedded game icon. Both attempts and the small documentation-only correction are preserved in [FIT_REFRESH_DELIVERY_2026-10-12.json](FIT_REFRESH_DELIVERY_2026-10-12.json).\n', encoding='utf-8', newline='')
files.add(md)
checkpoint = load(task / 'CHECKPOINT_VERIFICATION.json')
patch = []
with zipfile.ZipFile(checkpoint['archive']) as base:
    for relative in ['docs/rider-blender-trial/README.md', 'docs/rider-blender-trial/QA.md', 'docs/rider-blender-trial/PRESERVATION_MATRIX.md', 'docs/AI_HANDOFF.md']:
        patch.extend(difflib.unified_diff(base.read(relative).decode('utf-8-sig').splitlines(True), (root / relative).read_text(encoding='utf-8').splitlines(True), fromfile='a/' + relative, tofile='b/' + relative))
for path in [md, docs / 'fit-refresh-2026-10-12.html', evidence / 'provenance/qa-walk-run-supplement.mjs', evidence / 'delivery/provenance/check_review_delivery.mjs']:
    relative = path.relative_to(root).as_posix()
    patch.extend(difflib.unified_diff([], path.read_text(encoding='utf-8').splitlines(True), fromfile='/dev/null', tofile='b/' + relative))
(docs / 'FIT_REFRESH_REVIEW_DELTA.patch').write_text(''.join(patch), encoding='utf-8', newline='')
for row in checkpoint['files']:
    if row['path'].startswith(('src/', 'assets/', 'scripts/', 'tools/')):
        assert digest((root / row['path']).read_bytes()) == row['sha256'], row['path']
manifest = {'createdUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'scope': 'Final additive QA/docs manifest after gallery-icon correction. Earlier packaging retained separately. Runtime/native/export unchanged.',
    'files': [{'path': p.relative_to(root).as_posix(), 'bytes': p.stat().st_size, 'sha256': digest(p.read_bytes())} for p in sorted(files)]}
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8', newline='')
files.add(manifest_path)
archive = task / 'rider-fit-refresh-final-20261012.zip'
with zipfile.ZipFile(archive, 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for file in sorted(files):
        z.write(file, file.relative_to(root).as_posix())
with zipfile.ZipFile(archive) as z:
    entries = z.infolist()
    for entry in entries:
        assert digest(z.read(entry)) == digest((root / entry.filename).read_bytes())
    assert z.testzip() is None
receipt_path = docs / 'FIT_REFRESH_RECOVERY_2026-10-12.json'
recovery = load(receipt_path)
recovery['initialPackaging'] = {key: recovery[key] for key in ['additiveArchive','bytes','sha256','entriesReadbackVerified']}
recovery.update({'verifiedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'additiveArchive':str(archive),
    'bytes':archive.stat().st_size,'sha256':digest(archive.read_bytes()),'entriesReadbackVerified':len(entries),
    'delivery':'FIT_REFRESH_DELIVERY_2026-10-12.json','sourceChanges':False,
    'receiptScope':'This small receipt is external to its named archive to avoid a circular self-hash; retain it with both archives.'})
receipt_path.write_text(json.dumps(recovery, indent=2) + '\n', encoding='utf-8', newline='')
with (task / 'FINAL_DELIVERY_RECOVERY.json').open('x', encoding='utf-8') as stream:
    json.dump(recovery, stream, indent=2)
print(json.dumps(recovery, indent=2))
