import { describe, expect, it } from 'vitest';
import { edgeSlot, overlaps } from './hudPlacement';

describe('secondary HUD placement', () => {
  it('reserves mounted instruments and absolute notes', () => {
    const occupied = [{ left: 1063, top: 619, right: 1249, bottom: 692 }, { left: 1030, top: 586, right: 1249, bottom: 609 }];
    const slot = edgeSlot(1280, 720, 290, 95, occupied)!;
    expect(slot).not.toBeNull();
    for (const r of occupied) expect(overlaps(slot, r)).toBe(false);
  });
  it('finds a clear edge between notices, tips and instruments on a short display', () => {
    const occupied = [{ left: 30, top: 25, right: 587, bottom: 60 }, { left: 418, top: 275, right: 586, bottom: 352 }, { left: 20, top: 170, right: 280, bottom: 360 }];
    const slot = edgeSlot(617, 380, 197, 44, occupied)!;
    expect(slot).not.toBeNull();
    for (const r of occupied) expect(overlaps(slot, r)).toBe(false);
  });
  it('requests compact guidance when a full card cannot fit around a portrait centre', () => {
    expect(edgeSlot(360, 640, 160, 330, [])).toBeNull();
    expect(edgeSlot(360, 640, 160, 70, [])).not.toBeNull();
  });
  it('returns no placement when reserved content fills the viewport',()=>{
    expect(edgeSlot(617,380,160,40,[{left:0,top:0,right:617,bottom:380}])).toBeNull();
  });
});
