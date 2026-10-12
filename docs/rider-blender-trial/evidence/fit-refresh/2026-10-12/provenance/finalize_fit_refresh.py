"""Add fresh local QA evidence/documentation; preserve runtime, sources and old evidence."""
from pathlib import Path
import datetime, difflib, hashlib, html, json, zipfile

task = Path(__file__).parent
trial = Path(r'C:\Users\Robert\.codex\worktrees\rider-blender-trial\Driftwing')
docs = trial / 'docs/rider-blender-trial'
full_dir = trial / 'shots/rider-blender/windkeel-resting-fit/2026-10-12T06-27-36-293Z'
supp_dir = task / 'walk-run-supplement/2026-10-12T06-35-35-372Z-94884439'
target = docs / 'evidence/fit-refresh/2026-10-12'
digest = lambda b: hashlib.sha256(b).hexdigest()
read_json = lambda p: json.loads(p.read_text(encoding='utf-8-sig'))
checkpoint = read_json(task / 'CHECKPOINT_VERIFICATION.json')
preserve = read_json(task / 'PRESERVATION_AFTER_QA.json')
visual = read_json(task / 'VISUAL_REVIEW.json')
full, supp = read_json(full_dir / 'report.json'), read_json(supp_dir / 'report.json')
if target.exists() or (docs / 'FIT_REFRESH_2026-10-12.md').exists():
    raise RuntimeError('Refresh already exists; inspect instead of overwriting evidence')
assert len(full['captures']) == 32 and len(supp['captures']) == 8
assert not full['errors'] and not supp['errors'] and not full.get('failure') and not supp.get('failure')
assert supp['sourcesUnchanged'] and preserve['originalStatusUnchanged']
assert not preserve['originalDifferences'] and not preserve['trialDifferences']
assert visual['acceptedStableMounted'] == 24 and visual['acceptedSupplement'] == 8
for row in checkpoint['files']:
    assert digest((trial / row['path']).read_bytes()) == row['sha256'], 'Checkpoint changed: ' + row['path']
for source, report in [(full_dir, full), (supp_dir, supp)]:
    for capture in report['captures']:
        src = source / (capture['name'] + '.png')
        assert digest(src.read_bytes()) == capture['sha256'], 'Capture changed: ' + capture['name']

changed_docs = [docs / 'README.md', docs / 'QA.md', docs / 'PRESERVATION_MATRIX.md', trial / 'docs/AI_HANDOFF.md']
before = {p: p.read_bytes() for p in changed_docs}
target.mkdir(parents=True)
written = []
def put(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    data = content.encode('utf-8') if isinstance(content, str) else content
    with path.open('xb') as f:
        f.write(data)
    assert path.read_bytes() == data
    written.append(path)
def copy(src, dst):
    data = src.read_bytes()
    put(dst, data)
    return {'source': str(src), 'path': dst.relative_to(trial).as_posix(), 'bytes': len(data), 'sha256': digest(data)}

copied = []
for source, label, report in [(full_dir, 'full-fit', full), (supp_dir, 'walk-run', supp)]:
    copied.append(copy(source / 'report.json', target / label / 'report.json'))
    for cap in report['captures']:
        copied.append(copy(source / (cap['name'] + '.png'), target / label / (cap['name'] + '.png')))
for filename in ['CHECKPOINT_VERIFICATION.json', 'PRESERVATION_AFTER_QA.json', 'VISUAL_REVIEW.json',
                 'qa-walk-run-supplement.mjs', 'verify_checkpoint.py', 'verify_preservation.py', 'finalize_fit_refresh.py']:
    copied.append(copy(task / filename, target / 'provenance' / filename))
copied.append(copy(trial / 'scripts/rider-blender-fit-qa.mjs', target / 'provenance/rider-blender-fit-qa.mjs'))
inspection = task / 'inspection'
if inspection.is_dir():
    for src in sorted(inspection.rglob('*')):
        if src.is_file():
            copied.append(copy(src, target / 'inspection' / src.relative_to(inspection)))

summary = read_json(task / 'FIT_REFRESH_2026-10-12.json')
summary['status'] = 'Bounded local visual refresh completed; open CPU gate and artistic/hardware acceptance remain'
summary['finalizedUtc'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
summary['visualReview'] = visual
summary['fullFit']['visibleReview'] = '24 Stable/mounted views independently inspected and accepted for bounded visible-fit evidence. Eight original on-foot frames excluded from visible-fit proof.'
summary['supplement']['visibleReview'] = 'All eight captures inspected by root and independent reviewer; accepted for bounded visible-fit evidence at the actual follow-camera distance.'
summary['supplement']['visualReview'] = {'status': 'All eight inspected and accepted for bounded visible-fit evidence', 'accepted': True,
    'reviewedByRoot': [c['name'] for c in supp['captures']], 'independentReview': visual,
    'qualification': 'Actual follow-camera distance supports broad fit; no millimetre, hidden-surface, physical-controller or final-concept certification.'}
summary['next'] = 'Local review only. No commit/push/merge/deploy. CPU profiling, physical-controller/IGP testing and final artistic acceptance remain separate decisions.'
summary['copiedEvidence'] = copied
put(docs / 'FIT_REFRESH_2026-10-12.json', json.dumps(summary, indent=2) + '\n')

md = '''# Rider fit refresh — October 12, 2026

The current Windkeel rests close to the rider in the inspected Stable and gameplay views. The Travel shoulder cloth remains a thin connected wrap across both shoulders, with a narrow leather keeper on the right. This continuation verified the already-completed fit; it made no additional geometry, runtime, editable-source or export changes.

Branch `codex/rider-blender-trial`, HEAD `8e055069703c83308d5508ee72e5ad1d15ef348e`, with the existing uncommitted trial overlay. No commit, push, merge or deployment. The guide was reread and the continuation acknowledged. Blender 4.5.14 LTS remains the existing portable installation; no software or dependency was added.

## Fresh evidence

| Evidence | Result and limits |
| --- | --- |
| Full fit, 06:27–06:30 UTC | 32 captures / four cases / zero errors: Medium Travel; Slight and Broad mixed Travel pieces; Medium Flight. Each completes actual takeoff, landing and dismount. Active Windkeel, one shared skeleton, four sockets and finite surfaces retained throughout. |
| Stable and mounted visual review | 16 Stable front/left/right/back plus eight gameplay mounted-side views inspected. Both shoulders and both mounted sides covered. No gross detached cloth or suspended main straps in these views. Mounted distance cannot certify millimetre clearance or hidden surfaces. |
| Original on-foot frames | Eight retained for technical/state provenance, excluded from visible-fit acceptance because the companion obstructs framing. |
| Clear on-foot supplement, 06:35–06:36 UTC | Eight Medium Travel/Flight walk/run front/back views inspected and accepted for bounded visible-fit evidence. Actual foot follow rig, normal collisions, no camera override, explicit scripted input and fresh nonpersistent Edge contexts. Zero errors; source hashes unchanged. |

The supplement uses an existing terrain staging point and normal Player teleport, then real grounded locomotion/animation/live cloth. Walk moves 1.6381 m and run 2.4493 m over 0.45 s. It supplements the full-fit takeoff/landing/dismount proof. The Travel shoulder stays one connected component in all sampled poses; maximum duplicated-seam numerical separation is below 0.00014 mm. This measures seam connectivity, not fabric thickness or total body clearance. The intended authored linen thickness remains 2 mm. Four live Travel skirt panels remain active. Flight does not contain the Travel shoulder wrap.

These captures use Edge/ANGLE SwiftShader. They establish bounded appearance and scripted gameplay-state evidence, not physical-controller acceptance or hardware performance. Final concept likeness, arbitrary-world/self collision, exhaustive layer intersections, integrated-GPU Low, GPU time and total VRAM remain unverified.

## Preservation and checks

The original rider worktree's 1,851 preserved file hashes and Git status remain unchanged. All 1,112 archived trial checkpoint files matched before and after fresh QA, before these deliberate documentation/evidence additions. Owner worktree/services/saves were preserved. Selected GLB: 19,110,536 bytes, SHA-256 `d6f2ffa790d43e8217ab6d64bdfdf994b424d1d5cb1d1b8685403b2001d40dc8`. Editable `.blend` SHA-256 `0b69bcbb74153a0f0bc993ee756f59048db22e5fc0d5e7a7990c39465b9fa9c4`.

Historical checks for this unchanged implementation remain typecheck, 1,310 tests/124 files, existing/authored garment audits and build PASS. They were not rerun without source changes. The original full-browser workflow remains 14/15; the software CPU gate remains baseline-reproduced and unresolved. This refresh does not turn it into an all-green release candidate. See [QA.md](QA.md) for exact failures and measured costs.

All 40 capture bytes were readback verified. [The JSON record](FIT_REFRESH_2026-10-12.json) contains original paths, source/output hashes, copied-evidence paths and qualified visual review. Original reports and rejected frames remain retained. [Recovery receipt](FIT_REFRESH_RECOVERY_2026-10-12.json) identifies the verified full overlay plus this additive QA/documentation backup and review delta; no original archive was replaced.

## Review

Open the [fresh gallery](fit-refresh-2026-10-12.html), [earlier matched old/new comparison](review.html), or [normal-menu trial](http://127.0.0.1:5210/?riderTrial=blender&quality=low). In Edge InPrivate, open Stable → Outfit → Travel Drape and mix normally. [Preserved current presentation](http://127.0.0.1:5211/?quality=low) remains separate. [README.md](README.md#windows-launch) has Windows restart commands. Keep the rider/harness unmerged and local.
'''
put(docs / 'FIT_REFRESH_2026-10-12.md', md)

def cards(captures, label):
    output = []
    for cap in captures:
        relative = f'evidence/fit-refresh/2026-10-12/{label}/{cap["name"]}.png'
        name = html.escape(cap['name'].replace('-', ' '))
        output.append(f'<figure><a href="{relative}"><img loading="lazy" src="{relative}" alt="{name}"></a><figcaption>{name}</figcaption></figure>')
    return '<div class="grid">' + ''.join(output) + '</div>'
stable = [c for c in full['captures'] if '-stable-' in c['name']]
mounted = [c for c in full['captures'] if '-gameplay-mounted-' in c['name']]
excluded = [c for c in full['captures'] if c not in stable and c not in mounted]
assert len(stable) == 16 and len(mounted) == 8 and len(excluded) == 8
gallery = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Driftwing rider fit — local October 12 review</title>
<style>body{margin:0;background:#17252d;color:#f0eadc;font:17px/1.5 system-ui,sans-serif}main{max-width:1250px;margin:auto;padding:24px}a{color:#a9d8ee}nav{display:flex;gap:20px;flex-wrap:wrap}h1{font-size:2rem}h2{margin-top:2rem}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}figure{margin:0;background:#243740;padding:8px;border-radius:6px}img{width:100%;height:auto;display:block}figcaption{font-size:14px;padding:8px 0;overflow-wrap:anywhere}.note{border-left:3px solid #c1a06b;padding:10px 16px;background:#243740}summary{cursor:pointer}</style>
<main><h1>Rider fit — local October 12 review</h1>
<nav><a href="/?riderTrial=blender&amp;quality=low">Play trial → Stable → Outfit → Travel Drape</a><a href="http://127.0.0.1:5211/?quality=low">Preserved current</a><a href="review.html">Earlier matched comparisons</a><a href="FIT_REFRESH_2026-10-12.md">QA / hashes / restart steps</a></nav>
<p>Windkeel follows the torso; the Travel cloth covers both shoulders with a thin connected wrap and a narrow right keeper. These are fresh views of the existing corrected fit. No geometry or runtime change was needed in this continuation.</p>
<p class="note">Local and unmerged. 40 fresh captures, 32 accepted for bounded visible-fit evidence, zero browser errors. The software CPU gate remains unresolved. Scripted SwiftShader captures do not certify physical-controller play, integrated graphics, hidden contacts or final concept likeness.</p>
<h2>Stable — three Travel builds and Flight</h2>''' + cards(stable, 'full-fit') + '<h2>Gameplay — both mounted sides</h2><p>Each case completed actual takeoff, landing and dismount. Gameplay camera distance limits fine clearance inspection.</p>' + cards(mounted, 'full-fit') + '<h2>Gameplay — clear walking and running</h2><p>Medium Travel and Flight; actual follow rig and grounded movement. The companion is outside the rider silhouette.</p>' + cards(supp['captures'], 'walk-run') + '<details><summary>Eight retained on-foot frames excluded from visible-fit proof</summary><p>Companion obstruction makes these framing attempts unsuitable for visible fit acceptance. Their state measurements and original bytes remain preserved.</p>' + cards(excluded, 'full-fit') + '</details></main></html>\n'
put(docs / 'fit-refresh-2026-10-12.html', gallery)

appends = {
    docs / 'README.md': '\n\n## October 12 fit refresh\n\n[Fresh Stable/gameplay gallery](fit-refresh-2026-10-12.html) and [qualified QA record](FIT_REFRESH_2026-10-12.md): 40 new captures, 32 accepted for bounded visible fit, zero errors. Eight companion-obstructed frames remain retained and excluded. Existing close Windkeel/thin connected shoulder fit is unchanged; no runtime or source re-authoring was needed. The original CPU gate remains unresolved. Local/uncommitted only; no merge or deployment.\n',
    docs / 'QA.md': '\n\n## October 12 continuation — fit verification\n\nSee [FIT_REFRESH_2026-10-12.md](FIT_REFRESH_2026-10-12.md), its hashed JSON and the [fresh gallery](fit-refresh-2026-10-12.html). Full fit: 32 captures/four cases, actual takeoff/landing/dismount, all three Travel builds plus Medium Flight, zero errors. Accepted visible subset: 16 Stable + eight mounted-side frames. Eight original on-foot frames are retained but excluded for companion obstruction. A separate fresh-context supplement adds eight clear Medium Travel/Flight walk/run front/back views with the actual follow rig and no override; zero errors, source hashes unchanged. All 40 capture hashes verified. Both shoulders remain thin/connected and main Windkeel straps rest close in inspected coverage. No hidden-surface/millimetre/controller or final likeness certification. No runtime, geometry, native-source or export changes in this continuation. Historical full tests/build were not rerun unchanged; the CPU failure remains open. Original 1,851 files/status and trial 1,112 checkpoint files matched before these additive docs/evidence changes.\n',
    docs / 'PRESERVATION_MATRIX.md': '\n\n## October 12 continuation — additive fit evidence\n\n| Capability / preserved work | Integration / status | Fresh regression evidence | Unresolved limits |\n| --- | --- | --- | --- |\n| Existing corrected Windkeel and continuous shoulder wrap | Runtime/native/export unchanged; guide reread, local opt-in retained | 32 full-fit captures across three Travel builds + Flight; actual takeoff/landing/dismount in all four cases; shared skeleton, four sockets, finite surfaces; 24 Stable/mounted views visually inspected | Mounted distance and hidden surfaces limit fine-fit claims |\n| Clear walking/running evidence | QA framing supplement only, actual follow rig/ground contacts, fresh contexts | Eight Medium Travel/Flight front/back captures inspected; zero errors and unchanged sources; eight obstructed originals retained/excluded | Scripted software-rendered evidence, not physical controller or hardware performance |\n| Original/working checkpoint and backups | Original ownership, ignored sources, planning documents and services retained | 1,851 original hashes/status unchanged; 1,112 trial checkpoint files unchanged after QA; full original recovery ZIP retained plus additive refresh archive | CPU gate and final artistic/IGP acceptance remain open; no commit/push/merge/deploy |\n\nDetails, hashes and review entry: [FIT_REFRESH_2026-10-12.md](FIT_REFRESH_2026-10-12.md). The existing complete-trial technical results above remain historical for identical source bytes; no unchanged full-suite rerun or overall green claim.\n',
    trial / 'docs/AI_HANDOFF.md': '\n\n## 2026-10-12 — rider fit continuation, local and unmerged\n\n- Objective: close-resting selected Windkeel and thin connected shoulder cloth in gameplay/Stable. Active isolated `codex/rider-blender-trial`, HEAD `8e055069703c83308d5508ee72e5ad1d15ef348e`; overlay remains uncommitted. Guide reread/continuation acknowledged. No commit, push, merge or deployment.\n- Existing fit corrections already matched the completed checkpoint; no runtime, geometry, native-source or export changes were made. Portable Blender 4.5.14 LTS verified; no added tools/dependencies.\n- Fresh full-fit QA: 32 captures/four cases (three Travel builds + Medium Flight), actual takeoff/landing/dismount, active Windkeel/shared rig/four sockets/finite surfaces, zero errors. Visual review accepts 16 Stable + eight mounted views. Eight companion-obstructed on-foot frames remain retained/excluded. New eight-capture Medium Travel/Flight actual-follow walk/run supplement passes and was visually inspected; no camera override, no source changes.\n- Preservation after QA: original rider 1,851 hashes/status unchanged; trial 1,112 archived checkpoint files unchanged before additive QA/docs. All 40 capture hashes readback verified. Original complete overlay archive remains intact; additive QA/doc backup and review delta recorded in `docs/rider-blender-trial/FIT_REFRESH_RECOVERY_2026-10-12.json`. Owner services/saves unchanged.\n- Review: http://127.0.0.1:5210/docs/rider-blender-trial/fit-refresh-2026-10-12.html. Normal menu5210/?riderTrial=blender&quality=low → Stable → Outfit → Travel Drape; preserved comparison5211/?quality=low. README has Windows restart steps.\n- Limits: SwiftShader/scripted visual-state evidence only; physical controller/IGP/GPU time/total VRAM and final concept likeness remain unverified. Historical 1,310 tests/typecheck/audits/build were not rerun for unchanged implementation. Existing baseline-reproduced software CPU gate remains unresolved; no all-green release claim. Next authorized action remains local review/fit work within the rider trial; do not merge, deploy, replace owner build or expand scope.\n'
}
for path, addition in appends.items():
    path.write_bytes(before[path] + addition.encode('utf-8'))
    written.append(path)

# Runtime/export/native bytes must still match the original verified checkpoint.
for row in checkpoint['files']:
    if row['path'].startswith(('src/', 'assets/', 'scripts/', 'tools/')):
        assert digest((trial / row['path']).read_bytes()) == row['sha256'], 'Protected source changed: ' + row['path']

patch = []
for path in changed_docs:
    rel = path.relative_to(trial).as_posix()
    patch.extend(difflib.unified_diff(before[path].decode('utf-8-sig').splitlines(True), path.read_text(encoding='utf-8').splitlines(True), fromfile='a/' + rel, tofile='b/' + rel))
for path in [docs / 'FIT_REFRESH_2026-10-12.md', docs / 'fit-refresh-2026-10-12.html', target / 'provenance/qa-walk-run-supplement.mjs']:
    rel = path.relative_to(trial).as_posix()
    patch.extend(difflib.unified_diff([], path.read_text(encoding='utf-8').splitlines(True), fromfile='/dev/null', tofile='b/' + rel))
put(docs / 'FIT_REFRESH_REVIEW_DELTA.patch', ''.join(patch))
manifest = {'createdUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'scope': 'Additive QA/docs only. Existing REVIEW_DIFF.patch retains implementation diff; this delta and hashes identify this refresh.',
            'files': [{'path': p.relative_to(trial).as_posix(), 'bytes': p.stat().st_size, 'sha256': digest(p.read_bytes())} for p in written]}
put(docs / 'FIT_REFRESH_FILES_2026-10-12.json', json.dumps(manifest, indent=2) + '\n')
archive = task / 'rider-fit-refresh-recovery-20261012.zip'
with zipfile.ZipFile(archive, 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for path in written:
        z.write(path, path.relative_to(trial).as_posix())
with zipfile.ZipFile(archive) as z:
    entries = z.infolist()
    for entry in entries:
        assert digest(z.read(entry)) == digest((trial / entry.filename).read_bytes())
    assert z.testzip() is None
recovery = {'verifiedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'baseArchive': checkpoint['archive'], 'baseSha256': checkpoint['sha256'], 'baseEntriesVerified': checkpoint['archiveEntriesVerified'],
            'additiveArchive': str(archive), 'bytes': archive.stat().st_size, 'sha256': digest(archive.read_bytes()), 'entriesReadbackVerified': len(entries),
            'restore': 'Recover original implementation from the preserved full overlay into a separate empty checkout at the recorded baseline; apply this additive archive afterward. Never reset/overwrite a live or other-agent worktree.',
            'implementationDiff': 'REVIEW_DIFF.patch', 'refreshDiff': 'FIT_REFRESH_REVIEW_DELTA.patch', 'refreshManifest': 'FIT_REFRESH_FILES_2026-10-12.json',
            'sourceChanges': False, 'commitPushMergeDeploy': 'none', 'openGate': 'Software CPU baseline-reproduced/unresolved; artistic/controller/IGP acceptance remains open'}
put(docs / 'FIT_REFRESH_RECOVERY_2026-10-12.json', json.dumps(recovery, indent=2) + '\n')
put(task / 'FINALIZATION_RECEIPT.json', json.dumps(recovery, indent=2) + '\n')
print(json.dumps(recovery, indent=2))
