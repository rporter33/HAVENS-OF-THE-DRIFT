// The head: a lofted reptile skull and a separate lower jaw (so the mouth can open on the jaw
// bone). The skull carries the planes a lizard or crocodilian head reads by: the eye set in a
// socket under a brow ledge and framed by lid rims, the bulging jaw muscle behind it, an ear
// opening, nostrils on raised bosses, and a row of recurved teeth of uneven size. A forked
// tongue lies on the jaw floor. Zones for the hide shader go in aExtra.z (lip row, eye ring,
// nostril, ear); detail too small to read beyond close range is gated by the LOD profile.
//
// Head space: origin at the head bone pivot (end of the neck), +Z along the snout.

import { Vector3 } from 'three';
import { smoothstep } from '../../../core/math';
import { GeoBuilder, REGION, Skin, ZONE, ellipsoid, tube, zoneExtra } from '../builder';
import { TONGUE, type RigDef } from '../rig';
import { bezier3, keyed, spike, spow } from './shape';
import { RES, type Res } from './res';

export interface HeadInfo {
  /** Left eye center (body space, bind) and outward axis; the right eye mirrors x. */
  eyeCenter: Vector3;
  eyeAxis: Vector3;
  eyeRadius: number;
  /** Points on the skull (body space, left side) for horns and frills. */
  skullBack: Vector3;
  browTop: Vector3;
  cheek: Vector3;
}

/** Eye position on the skull: station t and girth angle (0 = top, + = left). */
const EYE_T = 0.4;
const EYE_TH = 1.05;
/** How deep the eyeball sits: its centre this many eye radii inside the skull surface. */
const EYE_SINK = 0.5;

/** Teeth per side, by position along the jaw: size factors (3rd and 4th enlarged). */
const UPPER_SIZE = [0.9, 1.05, 1.6, 1.6, 1.0, 0.95, 1.1, 0.85, 0.8];
const LOWER_SIZE = [0.95, 1.0, 1.1, 1.6, 0.9, 1.05, 0.85, 0.8];
/** Which teeth the mid LOD keeps (5 upper, 4 lower: the enlarged ones and an even spread). */
const UPPER_FEW = [0, 2, 3, 5, 7];
const LOWER_FEW = [1, 3, 5, 6];

const zone = zoneExtra;
/** Segments along each lid rim arc. */
const LID_SEGS = 12;

export function buildHead(b: GeoBuilder, rig: RigDef, res: Res = RES[0]): HeadInfo {
  const AROUND = res.headAround;
  const STATIONS = res.headStations;
  const S = rig.props.shape;
  const H = rig.bones[rig.idx.head].pos;
  const L = S.headLength;
  const Wd = S.headHalfWidth;
  const Hh = S.headHalfHeight;
  const headSkin = Skin.of(rig.idx.head);
  const jawSkin = Skin.of(rig.idx.jaw);
  // The head style's sculpting (proportions.ts HEAD_STYLES); stocky heads get a blunter, deeper snout.
  const HP = S.head ?? { blunt: S.plates ? 1.12 : 1, brow: 1, cheek: 1, crown: 1, pegTeeth: !!S.plates };
  const blunt = HP.blunt;
  const crown = HP.crown;

  const zBack = -0.2 * L;
  const zTip = 1.0 * L;
  const width = (t: number) =>
    Wd *
    keyed(
      [
        [0, 0.55],
        [0.12, 1.0],
        [0.26, 1.1],
        [0.4, 1.0],
        [0.52, 0.74 * blunt],
        [0.7, 0.6 * blunt],
        [0.88, 0.55 * blunt],
        [0.97, 0.45 * blunt],
        [1.0, 0.18],
      ],
      t,
    );
  const top = (t: number) =>
    Hh *
    keyed(
      [
        [0, 0.75],
        [0.12, 1.3 * crown],
        [0.27, 1.42 * crown],
        [0.38, 1.3 * (0.5 + 0.5 * crown)],
        [0.5, 0.92],
        [0.68, 0.72 * blunt],
        [0.86, 0.66 * blunt],
        [0.96, 0.56],
        [1.0, 0.22],
      ],
      t,
    );
  const bottom = (t: number) =>
    Hh *
    keyed(
      [
        [0, 0.8],
        [0.14, 0.95],
        [0.28, 0.55],
        [0.38, 0.14],
        [0.55, 0.08],
        [1.0, 0.06],
      ],
      t,
    );
  const mouthY = (t: number) => Hh * keyed([[0, -0.1], [0.3, -0.38], [1, -0.48]], t);
  const zAt = (t: number) => zBack + (zTip - zBack) * t;
  const tAtZ = (z: number) => (z - zBack) / (zTip - zBack);

  /** The plain skull surface (no bumps). */
  const ringBase = (t: number, th: number, out: Vector3) => {
    const c = Math.cos(th);
    const s = Math.sin(th);
    const sq = 2 / 2.35;
    const y = mouthY(t) + spow(c, sq) * (c >= 0 ? top(t) : bottom(t));
    const x = spow(s, sq) * width(t);
    return out.set(H.x + x, H.y + y, H.z + zAt(t));
  };

  // --- Eye placement (on the plain skull, so the brow can overhang it) -------------------------
  const rEye = rig.eyeRadius;
  const eyeSurf = ringBase(EYE_T, EYE_TH, new Vector3());
  const eyeIn = ringBase(EYE_T, EYE_TH - 0.3, new Vector3());
  // Outward axis: mostly sideways, a little forward and up.
  const eyeAxis = new Vector3(1, 0.22, 0.42).normalize();
  const eyeCenter = eyeSurf.clone().addScaledVector(eyeAxis, -EYE_SINK * rEye);
  eyeCenter.y = Math.min(eyeCenter.y, eyeIn.y - 0.15 * rEye);

  // --- Surface anatomy: outward offsets around the ring -----------------------------------------
  const angDist = (a: number, b: number) => {
    let d = Math.abs(a - b) % (Math.PI * 2);
    if (d > Math.PI) d = Math.PI * 2 - d;
    return d;
  };
  /** Gaussian in girth angle about ±center (both sides). */
  const both = (th: number, center: number, w: number) =>
    Math.max(Math.exp(-((angDist(th, center) / w) ** 2)), Math.exp(-((angDist(th, -center) / w) ** 2)));
  // The brow ledge's crest runs just above the eye's top edge (its angular radius on the skull)
  // and juts out past the eyeball, so the eye sits under it in a socket.
  const browTh = EYE_TH - 1.3 * (rEye / Math.max(0.05, width(EYE_T)));
  const eyeOuterX = eyeCenter.x - H.x + eyeAxis.x * rEye;
  const _e = new Vector3();
  const _a = new Vector3();
  /** 0 inside the eye opening (close to the eye's axis), 1 clear of it. */
  const socket = (p: Vector3) => {
    _e.set(Math.abs(p.x - H.x) + H.x, p.y, p.z).sub(eyeCenter);
    const along = _e.dot(eyeAxis);
    const perp = _a.copy(_e).addScaledVector(eyeAxis, -along).length();
    return along < -0.2 * rEye ? 1 : smoothstep(0.68 * rEye, 0.92 * rEye, perp);
  };
  interface Bumps {
    /** Lateral (x, outward) and vertical offsets. */
    out: number;
    up: number;
    nostril: number;
    ear: number;
  }
  const bumps = (t: number, th: number, base: Vector3, o: Bumps): Bumps => {
    const c = Math.cos(th);
    const s = Math.sin(th);
    const open = socket(base);
    // Brow ledge over the eye: at least 0.34 half-heights, and always out past the eyeball.
    // (A flat-topped profile, so the crest reaches its height between ring vertices too.)
    const gb = Math.min(1, 1.6 * Math.exp(-(((t - EYE_T) / 0.085) ** 2)) * both(th, browTh, 0.2)) * open;
    const brow = gb * HP.brow * Math.max(0.34 * Hh, (eyeOuterX + 0.1 * rEye - Math.abs(base.x - H.x)) / Math.max(0.3, Math.abs(s)));
    // Jaw muscle bulging behind and below the eye.
    const cheek = 0.22 * HP.cheek * Wd * Math.exp(-(((t - 0.18) / 0.1) ** 2)) * both(th, 2.05, 0.45) * open;
    // Ear opening: a shallow oval pit behind the jaw muscle (super-Gaussian: a defined rim).
    // (Never smaller than the ring spacing, so the mesh always samples it.)
    const eu = (t - 0.06) / Math.max(0.05 / 1.2, 0.8 / STATIONS);
    const ev = angDist(Math.abs(th), 1.55) / Math.max((0.035 * L) / Math.max(0.05, width(0.06)), (0.8 * Math.PI * 2) / AROUND);
    const ear = Math.exp(-((eu * eu + ev * ev) ** 2));
    // Nostril bosses on the snout.
    const nostril = Math.exp(-(((t - 0.9) / 0.045) ** 2)) * both(th, 0.45, 0.22);
    const boss = 0.08 * Hh * nostril;
    o.out = s * (brow + cheek + boss * 0.7) - Math.sign(s) * 0.03 * L * ear;
    o.up = c * 0.2 * brow + (c >= 0 ? c : c * 0.3) * cheek * 0.3 + c * boss * 0.7;
    o.nostril = nostril;
    o.ear = ear;
    return o;
  };
  const _bump: Bumps = { out: 0, up: 0, nostril: 0, ear: 0 };
  const ringPoint = (t: number, th: number, out: Vector3) => {
    ringBase(t, th, out);
    const o = bumps(t, th, out, _bump);
    out.x += o.out;
    out.y += o.up;
    return out;
  };

  // --- Skull ------------------------------------------------------------------------------------
  const p = new Vector3();
  b.begin(0);
  const rings: number[][] = [];
  for (let i = 0; i <= STATIONS; i++) {
    const t = i / STATIONS;
    const ring: number[] = [];
    for (let a = 0; a < AROUND; a++) {
      const th = (a / AROUND) * Math.PI * 2;
      const c = Math.cos(th);
      ringPoint(t, th, p);
      const o = _bump;
      const palate = c < -0.5 && t > 0.3;
      _e.set(Math.abs(p.x - H.x) + H.x, p.y, p.z);
      const z =
        o.nostril > 0.35
          ? ZONE.nostril
          : o.ear > 0.3
            ? ZONE.ear
            : _e.distanceTo(eyeCenter) < 1.75 * rEye
              ? ZONE.eyeRing
              : !palate && t > 0.28 && c < -0.2
                ? ZONE.lip
                : 0;
      ring.push(
        b.vertex(
          p,
          headSkin,
          {
            region: palate ? REGION.mouth : REGION.skin,
            belly: t < 0.34 ? smoothstep(-0.2, -0.75, c) * (1 - smoothstep(0.24, 0.34, t)) : 0,
            dorsal: smoothstep(0.3, 0.95, c),
            extra: z ? zone(z) : undefined,
          },
          -0.6 + t * L,
          Math.sin(th),
        ),
      );
    }
    rings.push(ring);
  }
  for (let r = 0; r < STATIONS; r++) {
    const A = rings[r];
    const B = rings[r + 1];
    for (let i = 0; i < AROUND; i++) {
      const j = (i + 1) % AROUND;
      // Stations run back → front here, so the winding is the mirror of the body's.
      b.quad(A[i], B[i], B[j], A[j]);
    }
  }
  const cBack = b.vertex(p.set(H.x, H.y + mouthY(0) + 0.1 * Hh, H.z + zBack - 0.02 * L), headSkin, { region: REGION.skin, dorsal: 0.5 });
  const cTip = b.vertex(p.set(H.x, H.y + mouthY(1) + 0.04 * Hh, H.z + zTip + 0.01 * L), headSkin, { region: REGION.skin });
  for (let i = 0; i < AROUND; i++) {
    const j = (i + 1) % AROUND;
    b.tri(cBack, rings[0][i], rings[0][j]);
    b.tri(cTip, rings[STATIONS][j], rings[STATIONS][i]);
  }
  b.end();

  // --- Lower jaw ----------------------------------------------------------------------------------
  // The throat floor behind the jaw's rami is partly carried by the gular bone (throat pumping).
  b.begin(0);
  const J = rig.bones[rig.idx.jaw].pos;
  const JST = res.jawStations;
  const JAR = res.jawAround;
  const jz0 = J.z - H.z - 0.06 * L;
  const jz1 = 0.965 * L;
  const jrings: number[][] = [];
  const gular = rig.idx.gular;
  for (let i = 0; i <= JST; i++) {
    const tj = i / JST;
    const z = jz0 + (jz1 - jz0) * tj;
    const tu = tAtZ(z);
    const wj = width(tu) * 0.9 * (1 - 0.15 * smoothstep(0.85, 1, tj));
    const yTop = mouthY(tu) + 0.05 * Hh;
    const depth = Hh * keyed([[0, 0.7], [0.3, 0.55], [0.8, 0.4], [0.95, 0.28], [1, 0.1]], tj);
    const ring: number[] = [];
    for (let a = 0; a < JAR; a++) {
      const th = (a / JAR) * Math.PI * 2;
      const c = Math.cos(th);
      const s = Math.sin(th);
      const y = yTop + (c >= 0 ? spow(c, 0.8) * 0.05 * Hh : spow(c, 0.85) * depth);
      p.set(H.x + spow(s, 0.85) * wj, H.y + y, H.z + z);
      const wg = 0.5 * (1 - smoothstep(0.05, 0.4, tj)) * smoothstep(-0.2, -0.8, c);
      const lip = c > 0.0 && c <= 0.45 && tj > 0.12;
      ring.push(
        b.vertex(
          p,
          wg > 1e-3 ? new Skin().add(rig.idx.jaw, 1 - wg).add(gular, wg) : jawSkin,
          { region: c > 0.45 ? REGION.mouth : REGION.skin, belly: smoothstep(0.35, -0.35, c), dorsal: 0, extra: lip ? zone(ZONE.lip) : undefined },
          z,
          s,
        ),
      );
    }
    jrings.push(ring);
  }
  for (let r = 0; r < JST; r++) {
    const A = jrings[r];
    const B = jrings[r + 1];
    for (let i = 0; i < JAR; i++) {
      const j = (i + 1) % JAR;
      b.quad(A[i], B[i], B[j], A[j]);
    }
  }
  const jb = b.vertex(p.set(H.x, H.y + mouthY(0.1) - 0.25 * Hh, H.z + jz0 - 0.03 * L), new Skin().add(rig.idx.jaw, 0.5).add(gular, 0.5), { region: REGION.skin, belly: 1 });
  const jt = b.vertex(p.set(H.x, H.y + mouthY(1) - 0.08 * Hh, H.z + jz1 + 0.02 * L), jawSkin, { region: REGION.skin, belly: 1 });
  for (let i = 0; i < JAR; i++) {
    const j = (i + 1) % JAR;
    b.tri(jb, jrings[0][i], jrings[0][j]);
    b.tri(jt, jrings[JST][j], jrings[JST][i]);
  }
  b.end();

  // --- Eyes, lid rims and nostrils ------------------------------------------------------------
  for (const side of [1, -1]) {
    const c = new Vector3(eyeCenter.x * side, eyeCenter.y, eyeCenter.z);
    const ax = new Vector3(eyeAxis.x * side, eyeAxis.y, eyeAxis.z);
    const ay = new Vector3(0, 1, 0).addScaledVector(ax, -ax.y).normalize();
    const az = new Vector3().crossVectors(ax, ay).normalize();
    b.begin(0);
    ellipsoid(b, c, ax, ay, az, [rEye, rEye * 0.92, rEye * 1.08], () => headSkin, () => ({ region: REGION.eye }), res.eye[0], res.eye[1]);
    b.end();
    if (res.lids) {
      // Scaly upper and lower lids where the eyeball leaves the socket: two thick arcs hugging
      // the ball, drawn in over its top and bottom so the opening reads as a reptile's almond
      // rather than a disc, meeting at the corners (the lower lid is the mobile one in lizards).
      for (const [a0, a1, r, cover] of [
        [-0.2, Math.PI + 0.2, 0.2, 0.24],
        [Math.PI - 0.2, 2 * Math.PI + 0.2, 0.16, 0.16],
      ] as const) {
        const pts: Vector3[] = [];
        for (let k = 0; k <= LID_SEGS; k++) {
          const f = a0 + ((a1 - a0) * k) / LID_SEGS;
          const sf = Math.sin(f);
          // Radius from the eye's axis: pulled in over the ball toward the arc's middle.
          const rho = 0.98 * rEye * (1 - cover * sf * sf);
          // On the ball's surface (a hair proud of it), never inside the skull's opening.
          const along = Math.sqrt(Math.max(0, (1.05 * rEye) ** 2 - rho * rho));
          pts.push(c.clone().addScaledVector(ax, along).addScaledVector(az, Math.cos(f) * rho * side).addScaledVector(ay, sf * rho * 0.92));
        }
        b.begin(0);
        tube(b, {
          points: pts,
          radii: pts.map((_, k) => r * rEye * (0.5 + 0.5 * Math.sin((Math.PI * k) / LID_SEGS))),
          segments: 4,
          hint: ax,
          skin: () => headSkin,
          mat: () => ({ region: REGION.skin, dorsal: 0.4, extra: zone(ZONE.eyeRing) }),
        });
        b.end();
      }
    }
    if (res.lod === 2) continue;
    // Nostril: a monitor-like slit on top of the boss, running along the snout and angled up
    // and out: narrow and sunk, so it reads as a dark opening, not a pink bead.
    const nose = ringPoint(0.905, 0.45 * side, new Vector3());
    const nAx = new Vector3(0.62 * side, 0.62, 0.2).normalize();
    const nAz = new Vector3(0.12 * side, 0.3, 1).normalize();
    nAz.addScaledVector(nAx, -nAz.dot(nAx)).normalize();
    const nAy = new Vector3().crossVectors(nAz, nAx).normalize();
    const big = res.nostrils;
    b.begin(0);
    ellipsoid(
      b,
      nose.addScaledVector(nAx, -0.013 * L),
      nAx,
      nAy,
      nAz,
      big ? [0.02 * L, 0.0075 * L, 0.05 * L] : [0.016 * L, 0.008 * L, 0.035 * L],
      () => headSkin,
      () => ({ region: REGION.mouth, extra: zone(ZONE.nostril) }),
      big ? 4 : 3,
      big ? 8 : 5,
    );
    b.end();
  }

  // --- Teeth --------------------------------------------------------------------------------------
  // Recurved and of uneven size, the upper and lower rows interlocking (offset by half a
  // spacing). The ironback has blunt crocodilian pegs, its enlarged 4th lower tooth standing
  // outside the upper lip.
  const peg = HP.pegTeeth;
  const toothLen = (peg ? 0.042 : 0.052) * L;
  const nUp = res.teeth[0];
  const nLo = res.teeth[1];
  const upperIds = nUp >= UPPER_SIZE.length ? UPPER_SIZE.map((_, i) => i) : UPPER_FEW.slice(0, nUp);
  const lowerIds = nLo >= LOWER_SIZE.length ? LOWER_SIZE.map((_, i) => i) : LOWER_FEW.slice(0, nLo);
  const spacing = 0.65 / 8;
  const toothPath = (base: Vector3, dir: number, len: number, side: number, out: number) => {
    // dir: -1 = upper (points down), +1 = lower (points up). Recurve: the tip hooks back.
    const hook = (peg ? 0.08 : 0.22) * len;
    const tip = base.clone().add(new Vector3(out * len * side, dir * len, -hook));
    if (res.toothSegs < 2) return [base, tip];
    const mid = base.clone().add(new Vector3(out * 0.5 * len * side, dir * 0.6 * len, 0.06 * len));
    return bezier3(base, mid, tip, res.toothSegs);
  };
  if (nUp > 0) {
    for (const side of [1, -1]) {
      b.begin(0);
      for (const i of upperIds) {
        const t = 0.3 + i * spacing;
        const size = UPPER_SIZE[i];
        const base = new Vector3(H.x + width(t) * 0.87 * side, H.y + mouthY(t) - 0.01 * Hh, H.z + zAt(t));
        const len = toothLen * size;
        spike(b, toothPath(base, -1, len, side, 0.1), (peg ? 0.019 : 0.015) * L * Math.sqrt(size), headSkin, { region: REGION.tooth }, res.toothSides, new Vector3(0, 0, 1), 1, peg ? 0.6 : 1);
      }
      b.end();
      b.begin(0);
      for (const i of lowerIds) {
        const z = zAt(0.3 + (i + 0.5) * spacing);
        const tu = tAtZ(z);
        const croc = peg && i === 3;
        const size = LOWER_SIZE[i] * (croc ? 1.4 : 1);
        // The ironback's 4th lower tooth sits in a notch outside the upper jaw.
        const base = new Vector3(H.x + width(tu) * (croc ? 0.93 : 0.78) * side, H.y + mouthY(tu) + 0.03 * Hh, H.z + z);
        const len = toothLen * 0.85 * size * (croc ? 1.25 : 1);
        spike(b, toothPath(base, 1, len, side, croc ? 0.18 : 0.04), (peg ? 0.018 : 0.014) * L * Math.sqrt(size), jawSkin, { region: REGION.tooth }, res.toothSides, new Vector3(0, 0, 1), 1, peg ? 0.6 : 1);
      }
      b.end();
    }
  }

  if (!res.tongue) return headInfo();
  // --- Tongue ------------------------------------------------------------------------------------
  // A long forked tongue lying on the jaw floor, wholly inside the closed mouth at rest; flicks
  // slide it out through the front to taste the air. Flat and broad at the root, then two prongs.
  const [tb0, tb1] = rig.idx.tongue;
  const T0 = rig.bones[tb0].pos;
  const T1 = rig.bones[tb1].pos;
  const tipZ = H.z + TONGUE.tip * L;
  const body: Vector3[] = [];
  for (let i = 0; i <= 6; i++) body.push(T0.clone().lerp(T1, i / 6));
  body.push(T1.clone().add(new Vector3(0, 0, 0.05 * L)));
  b.begin(0);
  spike(
    b,
    body,
    0.06 * L,
    (i) => (i < 4 ? Skin.of(tb0) : new Skin().add(tb0, 1 - (i - 3) / 4).add(tb1, (i - 3) / 4)),
    { region: REGION.tongue },
    8,
    new Vector3(0, 1, 0),
    0.42,
    0.35,
  );
  for (const side of [1, -1]) {
    const prong: Vector3[] = [];
    for (let i = 0; i <= 4; i++) {
      const f = i / 4;
      prong.push(new Vector3(H.x + side * (0.012 + 0.045 * f * f) * L, T1.y - 0.01 * Hh * f, T1.z + (tipZ - T1.z) * f));
    }
    spike(b, prong, 0.028 * L, Skin.of(tb1), { region: REGION.tongue }, 6, new Vector3(0, 1, 0), 0.55, 1);
  }
  b.end();

  return headInfo();

  function headInfo(): HeadInfo {
    return {
      eyeCenter,
      eyeAxis,
      eyeRadius: rEye,
      skullBack: ringPoint(0.1, 0.55, new Vector3()),
      browTop: ringPoint(0.38, 0.6, new Vector3()),
      cheek: ringPoint(0.16, 1.9, new Vector3()),
    };
  }
}
