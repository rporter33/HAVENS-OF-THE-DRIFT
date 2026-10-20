// Test helpers for the dragon suites: the committed GLBs read from disk, as the game's loader would
// have them (load.ts reads the same files from the dev server).

import { loadWhiteDragonAssets, type WhiteDragonAssets } from './load';

const DIR = new URL('../../assets/dragon/', import.meta.url);

// Node built-ins without @types/node in the project: imported by a computed name.
type Bytes = { buffer: ArrayBuffer; byteOffset: number; byteLength: number };

export async function diskBytes(file: string): Promise<ArrayBuffer> {
  const mod = 'node:fs';
  const fs = (await import(/* @vite-ignore */ mod)) as { readFileSync(p: URL): Bytes };
  const b = fs.readFileSync(new URL(file, DIR));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
}

let cached: Promise<WhiteDragonAssets> | null = null;

/** The white dragon's body (three LODs) and parts, parsed once per test file. */
export function diskAssets(): Promise<WhiteDragonAssets> {
  return (cached ??= loadWhiteDragonAssets(diskBytes));
}
