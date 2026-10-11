import type {Capsule} from './cloth';

/** Last positive intersection along a unit ray through a capsule. Keeps cloth on its outward side. */
export function capsuleExit(x:number,y:number,z:number,nx:number,ny:number,nz:number,c:Capsule,radius:number):number {
  const R=c.r+radius,ex=c.bx-c.ax,ey=c.by-c.ay,ez=c.bz-c.az;
  if((x<Math.min(c.ax,c.bx)-R&&nx<=0)||(x>Math.max(c.ax,c.bx)+R&&nx>=0)||
     (y<Math.min(c.ay,c.by)-R&&ny<=0)||(y>Math.max(c.ay,c.by)+R&&ny>=0)||
     (z<Math.min(c.az,c.bz)-R&&nz<=0)||(z>Math.max(c.az,c.bz)+R&&nz>=0))return 0;
  const mx=x-c.ax,my=y-c.ay,mz=z-c.az,ee=ex*ex+ey*ey+ez*ez;
  const me=mx*ex+my*ey+mz*ez,ne=nx*ex+ny*ey+nz*ez;
  let exit=0;
  if(ee>1e-12){
    const a=1-ne*ne/ee,b=mx*nx+my*ny+mz*nz-me*ne/ee;
    const q=mx*mx+my*my+mz*mz-me*me/ee-R*R,disc=b*b-a*q;
    if(a>1e-12&&disc>=0){const t=(-b+Math.sqrt(disc))/a,u=(me+t*ne)/ee;if(u>=0&&u<=1)exit=Math.max(exit,t);}
  }
  for(let end=0;end<2;end++){
    const dx=mx-ex*end,dy=my-ey*end,dz=mz-ez*end,b=dx*nx+dy*ny+dz*nz;
    const disc=b*b-dx*dx-dy*dy-dz*dz+R*R;
    if(disc>=0)exit=Math.max(exit,-b+Math.sqrt(disc));
  }
  return exit;
}

export function capsuleDepth(x:number,y:number,z:number,c:Capsule,radius:number):number {
  const R=c.r+radius;
  // Only positive penetration is consumed. Most cloth samples are far outside a capsule;
  // reject its conservative box before any segment projection or square root.
  if(x<Math.min(c.ax,c.bx)-R||x>Math.max(c.ax,c.bx)+R||
     y<Math.min(c.ay,c.by)-R||y>Math.max(c.ay,c.by)+R||
     z<Math.min(c.az,c.bz)-R||z>Math.max(c.az,c.bz)+R)return 0;
  const ex=c.bx-c.ax,ey=c.by-c.ay,ez=c.bz-c.az,ee=ex*ex+ey*ey+ez*ez;
  const u=ee>1e-12?Math.max(0,Math.min(1,((x-c.ax)*ex+(y-c.ay)*ey+(z-c.az)*ez)/ee)):0;
  const dx=x-c.ax-ex*u,dy=y-c.ay-ey*u,dz=z-c.az-ez*u;
  return R-Math.sqrt(dx*dx+dy*dy+dz*dz);
}
