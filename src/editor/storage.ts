import { LocalSaveStore, MemoryGhostStore } from '../progression/save';
import { parseRegion, REGION_KEY, SESSION_KEY, PLAYTEST_KEY, type Region } from './region';

/** Player progress and ghosts never touch persistent storage inside an authoring playtest. */
export function sandboxSave(): LocalSaveStore {
  const save = new LocalSaveStore({ storage: null, ghosts: new MemoryGhostStore() });
  save.data.playTime = 1; // Skip ordinary first-launch detection, including its player-save read.
  save.data.tutorialDone = true;
  save.data.firstLeadGuide = 'skipped';
  save.data.settings.quality = 'low';
  save.data.settings.musicVolume = 0;
  return save;
}
export function saveRegion(region: Region, storage: Pick<Storage, 'setItem'>): void {
  storage.setItem(REGION_KEY, JSON.stringify(parseRegion(region)));
}
export function loadRegion(storage: Pick<Storage, 'getItem'>): Region | null {
  const raw = storage.getItem(REGION_KEY);
  return raw ? parseRegion(raw) : null;
}
export function storeSession(region: Region, storage: Pick<Storage, 'setItem'>): void {
  storage.setItem(SESSION_KEY, JSON.stringify(parseRegion(region)));
}
export function storePlaytest(region: Region, storage: Pick<Storage, 'setItem'>): void {
  storage.setItem(PLAYTEST_KEY, JSON.stringify(parseRegion(region)));
}
