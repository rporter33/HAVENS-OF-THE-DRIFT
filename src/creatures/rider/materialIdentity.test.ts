import {describe,expect,it} from 'vitest';
import {DEFAULT_RIDER} from '../../cosmetics/catalog';
import {withGarment} from '../../cosmetics/wardrobe';
import {buildRiderModel,recolorRiderModel} from './model';
import {outfitMaterialPalette,riderPalette,surfaceOf,tone,mixSrgb} from './palette';
import {C02_LOOK} from './proof';

describe('rider garment material identity',()=>{
 it.each(['flight','scout','courier','racer','cartographer','skyknight','travel-drape'])('%s retains skin and distinguishes real metal from cloth and leather',outfit=>{
  const m=buildRiderModel({...DEFAULT_RIDER,outfit,headgear:'none',scarf:'none'});
  try{
   const surface=m.geometry.getAttribute('c02Surface'),counts=Array(5).fill(0);
   for(let i=0;i<surface.count;i++)counts[surface.getX(i)]++;
   expect(counts[0]).toBeGreaterThan(300);
   if(outfit==='racer')expect(counts[4]).toBe(0); // The painted buckle/number patch is not metal.
   else expect(counts[4]).toBeGreaterThan(20);
   if(outfit!=='skyknight')expect(counts[3]).toBeGreaterThan(50);
   if(outfit==='skyknight'){expect(counts[4]).toBeGreaterThan(500);expect(counts[2]).toBeGreaterThan(100);}
   for(let i=0;i<m.recipes.length;i++){
    const r=m.recipes[i];if(r?.k==='slot'&&(r.s==='skin'||r.s==='hairColor'))expect(surface.getX(i)).toBe(0);
   }
   const before=Array.from(surface.array),geo=m.geometry;
   recolorRiderModel(m,{...DEFAULT_RIDER,outfit,outfitPrimary:'#50375e',outfitSecondary:'#7fa8c4',armorColor:'#845a33',leatherColor:'#654631'});
   expect(m.geometry).toBe(geo);expect(Array.from(surface.array)).toEqual(before);
  }finally{m.geometry.dispose();m.rig.skeleton.dispose();}
 });
 it('source garment palettes stay independent while derived dyes keep their surface identity',()=>{
  const pal=riderPalette(DEFAULT_RIDER),cloth=outfitMaterialPalette(pal,'scout'),leather=outfitMaterialPalette(pal,'flight');
  expect(surfaceOf(cloth.primary)).toBe('linen');expect(surfaceOf(leather.primary)).toBe('leather');
  expect(surfaceOf(tone(pal.brass,.7))).toBe('bronze');expect(surfaceOf(mixSrgb(pal.leather,pal.primary,.1))).toBe('leather');
  expect(cloth.primary).not.toBe(leather.primary);expect(cloth.primary.equals(leather.primary)).toBe(true);
 });
 it('a linen top on a leather base and the explicit C02 proof keep linen surfaces',()=>{
  for(const [look,proof] of [[withGarment(DEFAULT_RIDER,'top','travel-drape-top'),undefined],[C02_LOOK,'aerie']] as const){
   const m=buildRiderModel(look,{proof});
   try{expect(Array.from(m.geometry.getAttribute('c02Surface').array).filter(x=>x===1).length).toBeGreaterThan(300);}
   finally{m.geometry.dispose();m.rig.skeleton.dispose();}
  }
 });
});
