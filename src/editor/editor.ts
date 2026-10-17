import { Vector3 } from 'three';
import { ASSET_CATALOG } from './assets';
import {
  islandPreset, LIMITS, parseRegion, RegionHistory, SESSION_KEY,
  starterRegion, type AssetKind, type Preset, type Region, type Selection,
} from './region';
import { loadRegion, saveRegion, storePlaytest, storeSession } from './storage';
import { validateRegion, type RegionIssue } from './validation';
import { RegionPreview } from './preview';
import './editor.css';

const escape = (value: unknown): string => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const root = document.getElementById('editor-ui')!;
root.innerHTML = '<header><div class="wordmark"><strong>HAVENS OF THE DRIFT</strong><span>Region workshop</span></div>' +
  '<label class="document-name"><span class="eyebrow">Your region</span><input id="region-name" aria-label="Region name" maxlength="64"></label>' +
  '<div class="toolbar"><button id="undo" title="Ctrl/⌘ Z">Undo</button><button id="redo" title="Ctrl/⌘ Shift Z">Redo</button>' +
  '<button id="save">Save</button><button id="load">Load</button><button id="export">Export JSON</button><button id="import">Import</button>' +
  '<button id="playtest" class="primary">Playtest</button></div><a href="./">Normal game</a></header>' +
  '<aside class="panel left"><span class="eyebrow">Build the sky</span><h2>Islands & assets</h2>' +
  '<div class="row"><select id="preset" aria-label="Island preset"><option value="plateau">Terrace island</option><option value="meadow">Meadow island</option><option value="rocky">Rock island</option></select></div>' +
  '<button id="add-island" style="width:100%">+ Add island</button><h3>Place on an island</h3><div id="palette"></div>' +
  '<p class="muted" id="placement-help">Choose a prop, then click the upper surface of an island.</p><button id="select-tool">Select / orbit</button>' +
  '<div class="divider"></div><span class="eyebrow">Route</span><div class="row"><button id="add-checkpoint" class="grow">+ Checkpoint</button></div>' +
  '<button id="face-route" style="width:100%">Face checkpoints along route</button><h3>Region contents</h3><div id="hierarchy"></div></aside>' +
  '<div class="view-tag">3D authoring · drag to orbit · wheel to zoom</div><div class="view-controls"><button id="focus">Focus selection</button><button id="overview">Overview</button>' +
  '<button id="snap">Snap: 1 m</button></div><aside class="panel right"><span class="eyebrow">Selection</span><div id="inspector"></div><div class="divider"></div>' +
  '<span class="eyebrow">Before you fly</span><h3>Validation</h3><div id="validation"></div></aside>' +
  '<footer><div><div id="status" role="status" aria-live="polite">Preparing your workshop…</div><small id="draft-state"></small></div>' +
  '<div class="muted">Ctrl/⌘ Z · undo &nbsp; F · focus &nbsp; Escape · select<small>Playtest in a separate sandbox. Player saves stay separate.</small></div></footer>' +
  '<input id="file-input" type="file" accept=".json,application/json" hidden>';
const element = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
let loadNotice = '';
let initial = starterRegion();
try {
  const draft = sessionStorage.getItem(SESSION_KEY);
  initial = draft ? parseRegion(draft) : loadRegion(localStorage) ?? initial;
} catch { loadNotice = 'Saved data could not be read. A starter region is open; the stored data is unchanged.'; }
const history = new RegionHistory(initial);
const preview = new RegionPreview(document.getElementById('editor-scene')!);
let selection: Selection | null = { kind: 'island', id: history.current.islands[0]?.id ?? 10000 };
let issues: RegionIssue[] = [];
let snap = 1;
let saved = '';
let frame: HTMLIFrameElement | null = null;
function status(message: string): void { element('status').textContent = message; }
function id(prefix: string): string { return prefix + '-' + crypto.randomUUID(); }
function currentEntity(): any {
  const r = history.current;
  if (selection?.kind === 'island') return r.islands.find(d => d.id === selection!.id);
  if (selection?.kind === 'asset') return r.assets.find(a => a.id === selection!.id);
  if (selection?.kind === 'checkpoint') return r.checkpoints.find(c => c.id === selection!.id);
  if (selection?.kind === 'start') return r.start;
  return null;
}
function choose(s: Selection | null): void {
  selection = s; preview.place(null); preview.select(s); renderInspector(); renderHierarchy(); renderPlacement();
}
function transact(edit: (r: Region) => void, message = 'Edit applied.'): void {
  const previousSelection = selection;
  try { if (history.edit(edit)) { refresh(); status(message); } }
  catch (e) { selection = previousSelection; refresh(); status((e as Error).message); }
}
function refresh(): void {
  if (!currentEntity()) selection = null;
  preview.rebuild(history.current); preview.select(selection);
  issues = validateRegion(history.current);
  element<HTMLInputElement>('region-name').value = history.current.name;
  element<HTMLButtonElement>('undo').disabled = !history.canUndo;
  element<HTMLButtonElement>('redo').disabled = !history.canRedo;
  element<HTMLButtonElement>('add-island').disabled = history.current.islands.length >= LIMITS.islands;
  element<HTMLButtonElement>('add-checkpoint').disabled = history.current.checkpoints.length >= LIMITS.checkpoints;
  element<HTMLButtonElement>('playtest').disabled = !!frame || issues.some(i => i.severity === 'error');
  renderHierarchy(); renderInspector(); renderValidation(); renderPlacement();
  try { storeSession(history.current, sessionStorage); }
  catch { status('Draft is held in memory only. Export JSON before closing this tab.'); }
  element('draft-state').textContent = (JSON.stringify(history.current) === saved ? 'Saved on this browser' : 'Draft · use Save or Export JSON to keep a copy') +
    ' · ' + history.current.islands.length + ' islands · ' + history.current.assets.length + ' props · ' + history.current.checkpoints.length + ' checkpoints';
}
function renderPlacement(): void {
  element('palette').innerHTML = Object.entries(ASSET_CATALOG).map(([kind, a]) => '<button class="asset ' + (preview.placement === kind ? 'active' : '') +
    '" data-place="' + kind + '" ' + (history.current.assets.length >= LIMITS.assets || !history.current.islands.length ? 'disabled' : '') + '><strong>' + a.name +
    '</strong><span>' + a.description + '</span></button>').join('');
  element('palette').querySelectorAll<HTMLButtonElement>('[data-place]').forEach(b => b.onclick = () => {
    preview.place(b.dataset.place as AssetKind); renderPlacement(); status('Click the top of an island to place ' + ASSET_CATALOG[preview.placement!].name.toLowerCase() + '.');
  });
  element('placement-help').textContent = preview.placement ? 'Click the upper surface. Each prop snaps to the shared island shape.' : 'Choose a prop, then click the upper surface of an island.';
}
function renderHierarchy(): void {
  const r = history.current;
  const entries: { s: Selection; label: string; detail: string }[] = [
    ...r.islands.map(d => ({ s: { kind: 'island', id: d.id } as Selection, label: d.name ?? 'Island', detail: 'island' })),
    ...r.assets.map(a => ({ s: { kind: 'asset', id: a.id } as Selection, label: ASSET_CATALOG[a.kind].name, detail: 'prop' })),
    { s: { kind: 'start', id: 'start' }, label: 'Race / flight start', detail: 'start' },
    ...r.checkpoints.map((c, i) => ({ s: { kind: 'checkpoint', id: c.id } as Selection, label: 'Checkpoint ' + (i + 1), detail: 'ring' })),
  ];
  element('hierarchy').innerHTML = entries.map(e => '<button class="entity ' + (selection?.kind === e.s.kind && selection?.id === e.s.id ? 'active' : '') +
    '" data-kind="' + e.s.kind + '" data-id="' + escape(e.s.id) + '">' + escape(e.label) + '<small>' + e.detail + '</small></button>').join('');
  element('hierarchy').querySelectorAll<HTMLButtonElement>('[data-kind]').forEach(b => b.onclick = () => choose({
    kind: b.dataset.kind, id: b.dataset.kind === 'island' ? Number(b.dataset.id) : b.dataset.id,
  } as Selection));
}
function field(key: string, label: string, value: string | number, min?: number, max?: number, step = 1): string {
  return '<label ' + (typeof value === 'string' ? 'class="wide"' : '') + '>' + label + '<input data-field="' + key + '" aria-label="' + label + '" type="' +
    (typeof value === 'string' ? 'text' : 'number') + '" value="' + escape(value) + '" ' + (min !== undefined ? 'min="' + min + '" max="' + max + '" step="' + step + '"' : 'maxlength="64"') + '></label>';
}
function renderInspector(): void {
  const e = currentEntity();
  if (!e || !selection) { element('inspector').innerHTML = '<h2>Choose something</h2><p class="muted">Click an island, prop or checkpoint, or use the contents list.</p>'; return; }
  let fields = '';
  let title = '';
  if (selection.kind === 'island') {
    title = 'Island shape';
    fields = field('name', 'Island name', e.name) + field('x', 'X (m)', e.x, -1000, 1000) + field('z', 'Z (m)', e.z, -1000, 1000) +
      field('y', 'Height (m)', e.y, 220, 1000) + field('radius', 'Radius (m)', e.radius, 35, 220) +
      field('hills', 'Hill relief (m)', e.hills, 0, 40) + field('depth', 'Depth (m)', e.depth, 40, 320) +
      field('outline', 'Ragged outline', e.outline, 0, 0.35, 0.01) + field('flatCenter', 'Flat centre', e.flatCenter, 0.1, 0.8, 0.01) +
      field('lip', 'Rim thickness (m)', e.lip, 5, 20) + field('seed', 'Shape seed', e.seed, 0, 2147483647);
  } else if (selection.kind === 'asset') {
    title = ASSET_CATALOG[e.kind as AssetKind].name;
    fields = '<label class="wide">Island<select data-field="islandId" aria-label="Owning island">' +
      history.current.islands.map(d => '<option value="' + d.id + '" ' + (d.id === e.islandId ? 'selected' : '') + '>' + escape(d.name) + '</option>').join('') + '</select></label>' +
      field('x', 'Local X (m)', e.x, -250, 250, 0.5) + field('z', 'Local Z (m)', e.z, -250, 250, 0.5) +
      field('yaw', 'Facing (°)', e.yaw, -180, 180) + field('scale', 'Size', e.scale, 0.5, 2, 0.1);
  } else {
    title = selection.kind === 'start' ? 'Race / flight start' : 'Checkpoint ' + (history.current.checkpoints.findIndex(c => c.id === selection!.id) + 1);
    fields = field('px', 'X (m)', e.position[0], -1200, 1200) + field('pz', 'Z (m)', e.position[2], -1200, 1200) +
      field('py', 'Height (m)', e.position[1], 150, 1500) + field('yaw', 'Facing (°)', e.yaw, -180, 180);
    if (selection.kind === 'checkpoint') fields += field('radius', 'Opening radius (m)', e.radius, 7, 24);
  }
  element('inspector').innerHTML = '<h2>' + escape(title) + '</h2><div class="fields">' + fields + '</div>' +
    (selection.kind === 'asset' ? '<p class="muted">Height follows the island. Moving or reshaping its island keeps the prop attached.</p>' : '<p class="muted">Drag the coloured handles to move. Changes commit as one undo step.</p>') +
    (selection.kind === 'checkpoint' ? '<div class="row"><button id="earlier">← Earlier</button><button id="later">Later →</button></div>' : '') +
    '<div class="row"><button id="duplicate" class="grow">Duplicate</button>' + (selection.kind !== 'start' ? '<button id="delete" class="danger">Delete</button>' : '') + '</div>';
  element('inspector').querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-field]').forEach(input => input.onchange = () => {
    if (input instanceof HTMLInputElement && !input.reportValidity()) return;
    const selected = selection!;
    transact(r => {
      const target: any = selected.kind === 'island' ? r.islands.find(d => d.id === selected.id) :
        selected.kind === 'asset' ? r.assets.find(a => a.id === selected.id) : selected.kind === 'checkpoint' ? r.checkpoints.find(c => c.id === selected.id) : r.start;
      const f = input.dataset.field!;
      if (f === 'name') target.name = input.value;
      else if (f === 'px' || f === 'py' || f === 'pz') target.position[{ px: 0, py: 1, pz: 2 }[f]] = Number(input.value);
      else if (f === 'islandId') { target.islandId = Number(input.value); target.x = 0; target.z = 0; }
      else target[f] = Number(input.value);
    });
  });
  element<HTMLButtonElement>('duplicate').disabled = selection.kind === 'start';
  element('duplicate').onclick = duplicate;
  if (selection.kind !== 'start') element('delete').onclick = remove;
  if (selection.kind === 'checkpoint') {
    const index = history.current.checkpoints.findIndex(c => c.id === selection!.id);
    element<HTMLButtonElement>('earlier').disabled = index === 0;
    element<HTMLButtonElement>('later').disabled = index === history.current.checkpoints.length - 1;
    for (const [name, delta] of [['earlier', -1], ['later', 1]] as const) element(name).onclick = () => transact(r => {
      const other = index + delta; [r.checkpoints[index], r.checkpoints[other]] = [r.checkpoints[other], r.checkpoints[index]];
    }, 'Checkpoint order changed.');
  }
}
function remove(): void {
  if (!selection) return;
  const s = selection; choose(null);
  transact(r => {
    if (s.kind === 'island') { r.islands = r.islands.filter(d => d.id !== s.id); r.assets = r.assets.filter(a => a.islandId !== s.id); }
    if (s.kind === 'asset') r.assets = r.assets.filter(a => a.id !== s.id);
    if (s.kind === 'checkpoint') r.checkpoints = r.checkpoints.filter(c => c.id !== s.id);
  }, s.kind === 'island' ? 'Island and its attached props removed. Undo restores both.' : 'Removed. Undo is available.');
}
function duplicate(): void {
  if (!selection) return;
  const s = selection; const entity = structuredClone(currentEntity());
  transact(r => {
    if (s.kind === 'island') {
      entity.id = Math.max(9999, ...r.islands.map(d => d.id)) + 1; entity.x += 240; entity.name += ' copy';
      r.islands.push(entity); selection = { kind: 'island', id: entity.id };
    } else if (s.kind === 'asset') {
      entity.id = id('asset'); entity.x += 8; r.assets.push(entity); selection = { kind: 'asset', id: entity.id };
    } else if (s.kind === 'checkpoint') {
      entity.id = id('checkpoint'); entity.position[2] -= 80; r.checkpoints.push(entity); selection = { kind: 'checkpoint', id: entity.id };
    }
  }, 'Duplicated.'); preview.select(selection);
}
function renderValidation(): void {
  if (!issues.length) element('validation').innerHTML = '<p class="valid">Ready to playtest.</p><p class="muted">Clearance checks passed. Fly the route and inspect prop bases on foot.</p>';
  else element('validation').innerHTML = '<p class="' + (issues.some(i => i.severity === 'error') ? 'danger' : 'muted') + '">' +
    issues.filter(i => i.severity === 'error').length + ' blockers · ' + issues.filter(i => i.severity === 'warning').length + ' cautions</p>' +
    '<div class="issues">' + issues.map((issue, i) => '<button class="issue ' + issue.severity + '" data-issue="' + i + '">' + escape(issue.message) + '</button>').join('') + '</div>';
  element('validation').querySelectorAll<HTMLButtonElement>('[data-issue]').forEach(b => b.onclick = () => {
    const issue = issues[Number(b.dataset.issue)]; if (issue.selection) { choose(issue.selection); preview.focus(issue.selection); }
  });
}
preview.onSelect = choose;
preview.onMove = (s, p) => transact(r => {
  if (s.kind === 'island') { const d = r.islands.find(d => d.id === s.id)!; d.x = p.x; d.y = p.y; d.z = p.z; }
  else if (s.kind === 'asset') {
    const a = r.assets.find(a => a.id === s.id)!; const d = r.islands.find(d => d.id === a.islandId)!; a.x = p.x - d.x; a.z = p.z - d.z;
  } else { const c = s.kind === 'start' ? r.start : r.checkpoints.find(c => c.id === s.id)!; c.position = [p.x, p.y, p.z]; }
});
preview.onPlace = (kind, islandId, p) => {
  const newId = id('asset'); preview.place(null);
  transact(r => {
    const d = r.islands.find(d => d.id === islandId)!;
    r.assets.push({ id: newId, kind, islandId, x: Math.round((p.x - d.x) / snap) * snap, z: Math.round((p.z - d.z) / snap) * snap, yaw: 0, scale: 1 });
    selection = { kind: 'asset', id: newId };
  }, ASSET_CATALOG[kind].name + ' placed.'); preview.select(selection);
};
element('select-tool').onclick = () => { preview.place(null); renderPlacement(); status('Select an object or drag to orbit.'); };
element('region-name').onchange = () => transact(r => { r.name = element<HTMLInputElement>('region-name').value; });
element('add-island').onclick = () => {
  transact(r => {
    const next = Math.max(9999, ...r.islands.map(d => d.id)) + 1;
    const x = r.islands.length ? Math.min(850, Math.max(...r.islands.map(d => d.x)) + 280) : 0;
    r.islands.push(islandPreset(next, element<HTMLSelectElement>('preset').value as Preset, x, 80));
    selection = { kind: 'island', id: next };
  }, 'Island added. Choose its shape in the inspector.'); preview.focus(selection);
};
element('add-checkpoint').onclick = () => {
  transact(r => {
    const last = r.checkpoints.at(-1);
    const newId = id('checkpoint');
    const previous = last ?? r.start;
    const angle = previous.yaw * Math.PI / 180;
    r.checkpoints.push({ id: newId, position: [
      Math.max(-1100, Math.min(1100, previous.position[0] + Math.sin(angle) * 120)),
      previous.position[1], Math.max(-1100, Math.min(1100, previous.position[2] + Math.cos(angle) * 120)),
    ], yaw: previous.yaw, radius: 12 });
    selection = { kind: 'checkpoint', id: newId };
  }, 'Checkpoint added. Set its position, opening and facing.'); preview.focus(selection);
};
element('face-route').onclick = () => transact(r => {
  if (r.checkpoints.length) r.start.yaw = Math.atan2(r.checkpoints[0].position[0] - r.start.position[0], r.checkpoints[0].position[2] - r.start.position[2]) * 180 / Math.PI;
  r.checkpoints.forEach((c, i) => { const p = i ? r.checkpoints[i - 1].position : r.start.position; c.yaw = Math.atan2(c.position[0] - p[0], c.position[2] - p[2]) * 180 / Math.PI; });
}, 'Checkpoint facings now follow their approach.');
function undo(): void { history.undo(); refresh(); status('Undone.'); }
function redo(): void { history.redo(); refresh(); status('Redone.'); }
element('undo').onclick = undo; element('redo').onclick = redo;
element('focus').onclick = () => preview.focus(selection);
element('overview').onclick = () => preview.focus(null);
element('snap').onclick = () => { snap = snap === 1 ? 5 : 1; preview.transform.setTranslationSnap(snap); element('snap').textContent = 'Snap: ' + snap + ' m'; };
element('save').onclick = () => {
  try { saveRegion(history.current, localStorage); saved = JSON.stringify(history.current); refresh(); status('Region saved on this browser. Export JSON for a portable copy.'); }
  catch { status('Browser storage is unavailable or full. Export JSON to keep this region.'); }
};
element('load').onclick = () => {
  try { const r = loadRegion(localStorage); if (!r) return status('No saved region in this browser yet.'); history.commit(r); saved = JSON.stringify(r); refresh(); status('Saved region loaded. Undo returns to the previous draft.'); }
  catch (e) { status('Could not load: ' + (e as Error).message); }
};
element('export').onclick = () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(history.current, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = 'driftwing-region.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  status('Region JSON exported.');
};
element('import').onclick = () => element<HTMLInputElement>('file-input').click();
element<HTMLInputElement>('file-input').onchange = async e => {
  const input = e.target as HTMLInputElement; const file = input.files?.[0];
  if (!file) return;
  try {
    if (file.size > LIMITS.bytes) throw Error('Region file exceeds 200 KB.');
    history.commit(parseRegion(await file.text())); refresh(); status('Region imported. Undo returns to the previous draft.');
  } catch (err) { status('Import rejected: ' + (err as Error).message); }
  finally { input.value = ''; }
};
element('playtest').onclick = () => {
  if (frame) return;
  try {
    const blockers = validateRegion(history.current).filter(i => i.severity === 'error');
    if (blockers.length) return status('Resolve validation blockers before playtesting.');
    storePlaytest(history.current, sessionStorage);
    frame = document.createElement('iframe'); frame.id = 'playtest-frame'; frame.title = 'Region playtest sandbox';
    frame.src = './editor-playtest.html' + (new URLSearchParams(location.search).has('debug') ? '?debug=1' : '');
    frame.addEventListener('load', () => frame?.contentWindow?.focus());
    preview.active = false; document.body.appendChild(frame);
    element<HTMLButtonElement>('playtest').disabled = true;
    status('Sandbox open. Return to continue editing.');
  } catch {
    frame?.remove(); frame = null; preview.active = true;
    element<HTMLButtonElement>('playtest').disabled = issues.some(i => i.severity === 'error');
    status('The sandbox snapshot could not be stored. Export your region and enable session storage to playtest.');
  }
};
window.addEventListener('message', e => {
  if (e.origin === location.origin && frame && e.source === frame.contentWindow && e.data?.type === 'driftwing-editor-return') {
    frame.remove(); frame = null; preview.active = true;
    element<HTMLButtonElement>('playtest').disabled = issues.some(i => i.severity === 'error');
    status('Back in the workshop. Your draft and undo history are intact.');
  }
});
window.addEventListener('keydown', e => {
  if (frame || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
  else if (e.key.toLowerCase() === 'f') preview.focus(selection);
  else if (e.key === 'Escape') { preview.place(null); choose(null); status('Selection cleared.'); }
  else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(); }
});
refresh();
status(loadNotice || 'Workshop ready. Shape an island, place a prop or edit the route.');
if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) {
  (window as any).__regionEditor = { history, preview, get selection() { return selection; }, get issues() { return issues; }, choose, refresh };
}
