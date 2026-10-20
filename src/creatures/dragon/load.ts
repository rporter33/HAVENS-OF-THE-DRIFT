// Loading the white dragon's files (gate G12b; dev-only until G12c). The files are fetched from the
// dev server's own copy of src/assets/dragon/, by a plain path rather than an import or
// `new URL(..., import.meta.url)`, so no production build bundles them: nothing in the normal build
// changes until Robert accepts the showcase (Q47). A production build refuses.

import { parseDragonBody, type DragonBodyAsset } from './asset';
import { parseDragonParts, type DragonPartsAsset } from './parts';

export interface WhiteDragonAssets {
  /** LOD0, LOD1, LOD2. */
  bodies: DragonBodyAsset[];
  parts: DragonPartsAsset;
}

export const WHITE_DRAGON_BODY_FILES = ['white-dragon.glb', 'white-dragon-lod1.glb', 'white-dragon-lod2.glb'] as const;
export const WHITE_DRAGON_PARTS_FILE = 'white-dragon-parts.glb';

export type FetchBytes = (file: string) => Promise<ArrayBuffer>;

/** The dev server's copy of a dragon file. */
export const devFetch: FetchBytes = async (file) => {
  if (!import.meta.env.DEV) throw Error('The white dragon is dev-only until gate G12c: run the dev server (npm run dev).');
  const res = await fetch(`${import.meta.env.BASE_URL}src/assets/dragon/${file}`);
  if (!res.ok) throw Error(`White dragon: ${res.status} for ${file}`);
  return res.arrayBuffer();
};

export async function loadWhiteDragonAssets(fetchBytes: FetchBytes = devFetch): Promise<WhiteDragonAssets> {
  const [b0, b1, b2, parts] = await Promise.all([...WHITE_DRAGON_BODY_FILES, WHITE_DRAGON_PARTS_FILE].map((f) => fetchBytes(f)));
  return { bodies: [b0, b1, b2].map(parseDragonBody), parts: parseDragonParts(parts) };
}
