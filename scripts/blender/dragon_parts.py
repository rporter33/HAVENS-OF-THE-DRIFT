# White dragon parts (gate G12a): the white elder's parts, built on the fitted body.
#
# The kit leaves the body bare (Meshy handles thin strands and tines badly) and asks for the
# ornaments as separate parts, so they can be swapped across every flight's dragon (Q48a). This
# script builds the white elder's set from white-dragon-parts.png (archived on
# archive/g12a-white-dragon): branching horns, two long whiskers, swept cheek fins, a short row of
# dorsal spines behind the skull and a low tail fin. Each part is procedural, placed on the fitted
# body's own surface (Dragon_Meshy_Body, in the game's bind space) and skinned to named bones of the
# game skeleton; no part adds a bone:
#   horns, whiskers   the head (rigid). The whiskers also carry strand coordinates so G12b can hang
#                     them as verlet strands, like the tail, with no bones of their own;
#   cheek fins        the cheek-fin bones fanL / fanR (rigid);
#   spines, tail fin  the body's own weights where each spine or fin column meets the hide, so they
#                     follow the neck and tail as the hide does.
# The variant sheets (horns, whiskers, frill, tail) are later options: each builder is a function of
# the skeleton and the body, so a variant is another builder on the same anchors.
#
# Shader attributes are the wyvern hide shader's (wyvern/builder.ts): horns, spines, fin rays and the
# tail fin are horn (region 1, aUv2.x = 0 at the base .. 1 at the tip); the whiskers are hide (region
# 0, belly 1: the belly's cloud white); the cheek fins' webbing is a membrane (group 1, MREGION.fin 2).
#
# Runs inside Blender 5.2 with havens-blender-pilot/white-dragon-pilot.blend open, after the fit
# (dragon_meshy_fit.py). Exec from the MCP bridge:
#   exec(open(path).read()); report, out = run_all(SKELETON_JSON, GLB_PATH, provenance)
# which builds every LOD's pieces (RES), shows them as Blender objects in 'White Dragon Parts' and
# writes the game's GLB (src/assets/dragon/white-dragon-parts.glb).
#
# Frames as the fit's: game body space +Z forward, +Y up, +X left (metres); Blender (x, -z, y), so
# the head faces -Y and the creature's left is +X.

import json
import math
import struct

import bmesh
import bpy
import mathutils
import numpy as np
from mathutils.bvhtree import BVHTree

V = mathutils.Vector

CFG = dict(body='Dragon_Meshy_Body', coll='White Dragon Parts', prefix='Part_')

REGION = dict(skin=0, horn=1)
MREGION = dict(fin=2)

# Geometric resolution per LOD: ring sides and path steps (as wyvern/parts/res.ts thins its parts).
# LOD2 keeps only the horns, the part that still reads in silhouette far off; the thin parts would
# alias away there (WHITE_DRAGON.md, risks).
ALL_PIECES = ('horns', 'whiskers', 'cheekFins', 'spines', 'tailFin')
RES = {
    0: dict(horn_sides=8, tine_sides=6, horn_steps=12, tine_steps=5, whisker_sides=5, whisker_steps=18,
            ray_sides=4, ray_steps=4, web_rows=4, spine_sides=6, spine_steps=4, fin_cols=5, tines=4, pieces=ALL_PIECES),
    1: dict(horn_sides=5, tine_sides=4, horn_steps=6, tine_steps=2, whisker_sides=3, whisker_steps=8,
            ray_sides=3, ray_steps=2, web_rows=2, spine_sides=4, spine_steps=2, fin_cols=3, tines=3, pieces=ALL_PIECES),
    2: dict(horn_sides=4, tine_sides=3, horn_steps=4, tine_steps=1, tines=2, pieces=('horns',)),
}

# The white elder's parts, in head lengths (L) or metres as noted. Read off white-dragon-parts.png's
# left profile and front view and set on the fitted head.
HORNS = dict(
    base=(0.16, 0.16),          # (out, forward of the skull joint along the head; in L): behind the eyes
    radius=(0.10, 0.02),        # m, base and tip of the beam
    # The beam from its base: (out, back, up) in L, swept back and out in a wide V, the tip turning up.
    beam=[(0.0, 0.0, 0.0), (0.05, 0.10, 0.14), (0.14, 0.28, 0.28), (0.24, 0.50, 0.38),
          (0.33, 0.72, 0.46), (0.40, 0.94, 0.56), (0.45, 1.10, 0.70)],
    # Tines: (fraction along the beam, direction (out, back, up), length in L, base radius m): a
    # brow tine forward and out, then three rising off the top of the beam, leaning in.
    tines=[(0.14, (0.55, -0.55, 0.62), 0.24, 0.045),
           (0.40, (-0.25, 0.05, 1.00), 0.34, 0.050),
           (0.62, (-0.15, 0.25, 1.00), 0.30, 0.045),
           (0.82, (0.05, 0.50, 0.90), 0.22, 0.036)],
)
WHISKERS = dict(
    root=(0.25, 0.08),          # m behind the snout tip along the head; m above the mouth point: the upper lip
    length=3.6,                 # m: long enough to reach the platform with the dragon lying down (catalog)
    radius=(0.024, 0.006),
    # The rest curve from the root (out, back, down), scaled to the length: out to the side and back
    # along the jaw, then drooping (the parts sheet's profile and front view).
    curve=[(0.0, 0.0, 0.0), (0.25, 0.15, 0.02), (0.60, 0.40, 0.10), (0.95, 0.75, 0.30),
           (1.20, 1.15, 0.70), (1.30, 1.50, 1.30), (1.30, 1.75, 2.00)],
    nodes=12,                   # verlet nodes per strand (G12b)
)
CHEEK_FINS = dict(
    root=(0.22, -0.05),         # m from the cheek-fin bone's pivot: forward along the head, up
    # Rays from the root on the cheek: (back, up, out) direction, length m, base radius m.
    rays=[((0.50, 0.85, 0.55), 0.80, 0.032), ((0.80, 0.45, 0.65), 0.95, 0.032),
          ((0.92, 0.00, 0.60), 0.85, 0.030), ((0.85, -0.40, 0.45), 0.60, 0.026)],
    scallop=0.18,               # the web's edge between ray tips, pulled toward the root
)
SPINES = dict(
    # Along the nape from just behind the skull: arc length from the skull joint (m) and height (m).
    at=[(0.10, 0.42), (0.34, 0.40), (0.58, 0.36), (0.82, 0.31), (1.06, 0.26), (1.30, 0.20), (1.54, 0.14)],
    lean=50.0,                  # degrees from the dorsal line back toward the tail, at the tip
    half_width=0.05,            # m at the base, side to side
    chord=0.32,                 # half the base length front to back, as a fraction of the height
)
TAIL_FIN = dict(
    span=(0.66, 0.975),         # fraction of the tail's length (tail0 to the tip): its last third
    teeth=9,
    height=(0.30, 0.06),        # m, first and last tooth
    web=0.28,                   # the web between teeth, as a fraction of the tooth
    peak=0.72,                  # each tooth's tip, as a fraction across it (swept back)
    half_width=(0.035, 0.012),  # m at the base, first and last
)


# --- frames and anchors --------------------------------------------------------------------------

def to_blender(p):
    return V((p[0], -p[2], p[1]))


def to_game(a):
    a = np.asarray(a, np.float64)
    return np.stack([a[..., 0], a[..., 2], -a[..., 1]], -1)


def load_skeleton(path):
    with open(path) as f:
        return json.load(f)


class Anchors:
    """The skeleton's points and the fitted body's surface and weights, in Blender space."""

    def __init__(self, sk):
        self.sk = sk
        self.P = {k: to_blender(v) for k, v in sk['points'].items()}
        self.bones = {b['name']: (to_blender(b['head']), to_blender(b['tail'])) for b in sk['bones']}
        body = bpy.data.objects[CFG['body']]
        me = body.data
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.triangulate(bm, faces=bm.faces)
        self.tris = np.array([[v.index for v in f.verts] for f in bm.faces])
        self.co = np.array([v.co[:] for v in bm.verts])
        self.bvh = BVHTree.FromBMesh(bm)
        bm.free()
        names = [b['name'] for b in sk['bones']]
        gname = {g.index: g.name for g in body.vertex_groups}
        self.W = np.zeros((len(me.vertices), len(names)))
        col = {n: i for i, n in enumerate(names)}
        for v in me.vertices:
            for g in v.groups:
                n = gname[g.group]
                if n in col:
                    self.W[v.index, col[n]] = g.weight
        self.names = names
        L = sk['points']
        self.L = (V(L['snout']) - V(L['head'])).length       # head length (m)

    # The head's frame: fwd along the pitched head, up across it, x to the creature's left.
    def head_frame(self):
        h, s = self.P['head'], self.P['snout']
        fwd = (s - h).normalized()
        up = V((0, fwd.z, -fwd.y))
        if up.z < 0:
            up = -up
        return h, fwd, up

    def surface(self, origin, direction):
        """Where a ray from outside meets the hide (first hit from origin along direction)."""
        hit = self.bvh.ray_cast(origin, direction.normalized())
        if hit[0] is None:
            raise RuntimeError(f'no hide along {tuple(origin)} {tuple(direction)}')
        return hit[0], hit[1]

    def skin_at(self, p):
        """The body's weights at its surface point nearest p (barycentric), top four."""
        loc, _n, fi, _d = self.bvh.find_nearest(p)
        a, b, c = (V(self.co[i]) for i in self.tris[fi])
        w = mathutils.geometry.barycentric_transform(loc, a, b, c, V((1, 0, 0)), V((0, 1, 0)), V((0, 0, 1)))
        w = np.clip(np.array(w[:]), 0, None)
        w = w / max(w.sum(), 1e-9)
        row = sum(w[k] * self.W[self.tris[fi][k]] for k in range(3))
        top = np.argsort(row)[::-1][:4]
        top = [i for i in top if row[i] > 1e-3]
        s = sum(row[i] for i in top)
        return {self.names[i]: float(row[i] / s) for i in top}

    def chain(self, names, end):
        """Polyline of bone pivots, ending at the point `end`, with cumulative arc length."""
        pts = [self.bones[n][0] for n in names] + [self.P[end]]
        s = [0.0]
        for i in range(1, len(pts)):
            s.append(s[-1] + (pts[i] - pts[i - 1]).length)
        return pts, s


def _at(pts, s, x):
    """Point and unit direction at arc length x along a polyline."""
    x = min(max(x, 0.0), s[-1] - 1e-6)
    for i in range(1, len(s)):
        if x <= s[i]:
            t = (x - s[i - 1]) / max(s[i] - s[i - 1], 1e-9)
            d = (pts[i] - pts[i - 1]).normalized()
            return pts[i - 1].lerp(pts[i], t), d
    return pts[-1], (pts[-1] - pts[-2]).normalized()


def _smooth_path(ctrl, n):
    """n+1 points along a Catmull-Rom curve through the control points, evenly in arc length."""
    pts = [V(c) for c in ctrl]
    ext = [pts[0] * 2 - pts[1]] + pts + [pts[-1] * 2 - pts[-2]]
    dense = []
    for i in range(1, len(ext) - 2):
        p0, p1, p2, p3 = ext[i - 1:i + 3]
        for k in range(16):
            t = k / 16
            dense.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    dense.append(pts[-1])
    s = [0.0]
    for i in range(1, len(dense)):
        s.append(s[-1] + (dense[i] - dense[i - 1]).length)
    return [_at(dense, s, s[-1] * k / n)[0] if k < n else dense[-1].copy() for k in range(n + 1)]


# --- geometry ------------------------------------------------------------------------------------

class Piece:
    """One part piece: vertices with skin and shader attributes, triangles in two groups
    (0 opaque, 1 membrane)."""

    def __init__(self, name, slot, option, bones_expected):
        self.name, self.slot, self.option, self.expected = name, slot, option, bones_expected
        self.P, self.skin, self.mat, self.uv, self.strand = [], [], [], [], []
        self.tris = ([], [])
        self.strands = []

    def v(self, p, skin, mat, uv, strand=(0.0, 0.0)):
        self.P.append(V(p))
        self.skin.append(skin)
        self.mat.append(tuple(mat))
        self.uv.append(tuple(uv))
        self.strand.append(tuple(strand))
        return len(self.P) - 1

    def tri(self, a, b, c, group=0, outward=None):
        """A triangle; with `outward` (a point inside the solid) it is wound to face away from it."""
        if outward is not None:
            n = (self.P[b] - self.P[a]).cross(self.P[c] - self.P[a])
            if n.dot((self.P[a] + self.P[b] + self.P[c]) / 3 - outward) < 0:
                b, c = c, b
        self.tris[group].append((a, b, c))

    @property
    def triangles(self):
        return len(self.tris[0]) + len(self.tris[1])


def _frames(path, ref):
    """Parallel-transported frames (t, n1, n2) along a path, n1 starting nearest `ref`."""
    out = []
    n1 = None
    for i in range(len(path)):
        a = path[max(i - 1, 0)]
        b = path[min(i + 1, len(path) - 1)]
        t = (b - a).normalized()
        if n1 is None:
            n1 = (ref - t * ref.dot(t))
            if n1.length < 1e-6:
                n1 = t.orthogonal()
            n1.normalize()
        else:
            n1 = (n1 - t * n1.dot(t)).normalized()
        out.append((t, n1.copy(), t.cross(n1).normalized()))
    return out


def tube(pc, path, radius, sides, skin, mat, ref=V((1, 0, 0)), aspect=1.0, uv_y=0.0, strand=None):
    """A tapered tube along `path`, closed in a point at the tip. radius(f) for f in 0..1; the
    section is an ellipse radius*aspect along n1 and radius along n2. skin(i, f) and mat(f) per ring;
    strand(f) the whiskers' strand coordinate. The base ring is left open (buried in the hide)."""
    n = len(path) - 1
    fr = _frames(path, ref)
    rings = []
    for i in range(n):
        f = i / n
        t, n1, n2 = fr[i]
        r = radius(f)
        ring = []
        for k in range(sides):
            a = 2 * math.pi * k / sides
            p = path[i] + n1 * (math.cos(a) * r * aspect) + n2 * (math.sin(a) * r)
            ring.append(pc.v(p, skin(i, f), mat(f), (f, uv_y), strand(f) if strand else (0.0, 0.0)))
        rings.append(ring)
    tip = pc.v(path[-1], skin(n, 1.0), mat(1.0), (1.0, uv_y), strand(1.0) if strand else (0.0, 0.0))
    for i in range(n - 1):
        c = (path[i] + path[i + 1]) / 2
        for k in range(sides):
            a, b = rings[i][k], rings[i][(k + 1) % sides]
            d, e = rings[i + 1][k], rings[i + 1][(k + 1) % sides]
            pc.tri(a, b, e, outward=c)
            pc.tri(a, e, d, outward=c)
    for k in range(sides):
        pc.tri(rings[-1][k], rings[-1][(k + 1) % sides], tip, outward=path[-2])


def horn_mat(f):
    return (REGION['horn'], 0.0, f, 0.0)


# --- the parts -----------------------------------------------------------------------------------

def build_horns(A, res):
    pc = Piece('horns', 'horns', 'branching', ['head'])
    H = HORNS
    h, fwd, up = A.head_frame()
    L = A.L
    skin = {'head': 1.0}
    for side in (1, -1):
        out = V((side, 0, 0))
        # The base: on the skull's top, behind the eyes.
        guess = h + out * (H['base'][0] * L) + fwd * (H['base'][1] * L)
        base, _ = A.surface(guess + up * 2.0, -up)
        frame = lambda o, b, u: base + out * (o * L) + V((0, 1, 0)) * (b * L) + V((0, 0, 1)) * (u * L)
        ctrl = [frame(*c) for c in H['beam']]
        ctrl[0] = ctrl[0] - V((0, 0, 1)) * 0.08            # buried in the skull
        beam = _smooth_path(ctrl, res['horn_steps'])
        r0, r1 = H['radius']
        beam_r = lambda f: r0 + (r1 - r0) * f ** 0.8
        tube(pc, beam, beam_r, res['horn_sides'], lambda i, f: skin, horn_mat, ref=out)
        bs = [0.0]
        for i in range(1, len(beam)):
            bs.append(bs[-1] + (beam[i] - beam[i - 1]).length)
        for k, (u, d, length, rad) in enumerate(H['tines'][:res['tines']]):
            p0, _ = _at(beam, bs, u * bs[-1])
            dv = (out * d[0] + V((0, 1, 0)) * d[1] + V((0, 0, 1)) * d[2]).normalized()
            ln = length * L
            # Rooted on the beam's axis and never wider than the beam there, so its open base stays
            # inside; each tine curves slightly back as it rises.
            rad = min(rad, 0.6 * beam_r(u))
            ctrl = [p0 - dv * 0.01, p0 + dv * (0.5 * ln) + V((0, 1, 0)) * (0.06 * ln), p0 + dv * ln + V((0, 1, 0)) * (0.18 * ln)]
            path = _smooth_path(ctrl, res['tine_steps'])
            tube(pc, path, lambda f, rad=rad: rad * (1 - 0.8 * f), res['tine_sides'], lambda i, f: skin, horn_mat, ref=out, uv_y=k + 1)
    return pc


def build_whiskers(A, res):
    pc = Piece('whiskers', 'whiskers', 'long', ['head'])
    W = WHISKERS
    _h, fwd, _up = A.head_frame()
    snout = A.P['snout']
    mouth = A.P['mouth']
    skin = {'head': 1.0}
    for side, idx in ((1, 0), (-1, 1)):
        out = V((side, 0, 0))
        at = snout - fwd * W['root'][0]
        at.z = mouth.z + W['root'][1]
        root, _ = A.surface(at + out * 2.0, -out)
        root = root - out * 0.02                             # set into the lip
        raw = [root + out * (c[0]) + V((0, 1, 0)) * c[1] + V((0, 0, -1)) * c[2] for c in W['curve']]
        # Scale the curve's arc to the whisker's length.
        dense = _smooth_path(raw, 64)
        arc = sum((dense[i] - dense[i - 1]).length for i in range(1, len(dense)))
        k = W['length'] / arc
        ctrl = [root + (p - root) * k for p in raw]
        path = _smooth_path(ctrl, res['whisker_steps'])
        nodes = _smooth_path(ctrl, W['nodes'] - 1)
        r0, r1 = W['radius']
        mat = lambda f: (REGION['skin'], 1.0, 0.0, 0.0)
        tube(pc, path, lambda f: r0 + (r1 - r0) * f, res['whisker_sides'], lambda i, f: skin, mat, ref=V((0, 0, 1)),
             uv_y=idx, strand=lambda f, idx=idx: (float(idx), f))
        pc.strands.append(dict(name=f"whisker{'L' if side > 0 else 'R'}", bone='head', length=W['length'],
                               nodes=to_game([p[:] for p in nodes]).round(4).tolist()))
    return pc


def build_cheek_fins(A, res):
    pc = Piece('cheekFins', 'frill', 'finCrest', ['fanL', 'fanR'])
    C = CHEEK_FINS
    _h, fwd, _up = A.head_frame()
    for side, bone in ((1, 'fanL'), (-1, 'fanR')):
        out = V((side, 0, 0))
        pivot = A.bones[bone][0] + fwd * C['root'][0] + V((0, 0, 1)) * C['root'][1]
        root, _ = A.surface(pivot + out * 2.0, -out)
        root = root - out * 0.03
        skin = {bone: 1.0}
        ray_paths = []
        for k, (d, length, rad) in enumerate(C['rays']):
            dv = (V((0, 1, 0)) * d[0] + V((0, 0, 1)) * d[1] + out * d[2]).normalized()
            ctrl = [root - dv * 0.03, root + dv * (0.5 * length) + out * 0.03, root + dv * length + V((0, 1, 0)) * (0.06 * length)]
            path = _smooth_path(ctrl, res['ray_steps'])
            tube(pc, path, lambda f, rad=rad: rad * (1 - 0.75 * f), res['ray_sides'], lambda i, f: skin, horn_mat, ref=out, uv_y=k)
            ray_paths.append(path)
        # The web between neighbouring rays: rows from the root out to a scalloped edge.
        rows = res['web_rows']
        for k in range(len(ray_paths) - 1):
            a, b = ray_paths[k], ray_paths[k + 1]
            edge_mid = a[-1].lerp(b[-1], 0.5).lerp(root, C['scallop'])
            grid = []
            for i in range(rows + 1):
                f = i / rows
                pa = root.lerp(a[-1], f)
                pb = root.lerp(b[-1], f)
                pm = root.lerp(edge_mid, f)
                row = []
                for j, (p, g) in enumerate(((pa, 0.0), (pm, 0.5), (pb, 1.0))):
                    m = (MREGION['fin'], 0.3 + 0.7 * f, f, 0.5 * f * f)
                    row.append(pc.v(p, skin, m, (f, k + g)))
                grid.append(row)
            for i in range(rows):
                for j in range(2):
                    pc.tri(grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], group=1)
                    pc.tri(grid[i][j], grid[i + 1][j + 1], grid[i][j + 1], group=1)
    return pc


def build_spines(A, res):
    pc = Piece('spines', 'frill', 'finCrest', ['head'] + [f'neck{i}' for i in range(6)] + ['chest'])
    S = SPINES
    # The nape runs from the skull joint down the neck: the chain reversed (headward to tailward).
    names = ['head', 'neck5', 'neck4', 'neck3', 'neck2', 'neck1', 'neck0']
    pts = [A.bones[n][0] for n in names] + [A.bones['chest'][0]]
    s = [0.0]
    for i in range(1, len(pts)):
        s.append(s[-1] + (pts[i] - pts[i - 1]).length)
    for k, (x, height) in enumerate(S['at']):
        c, d = _at(pts, s, x)                               # d runs down the neck, toward the tail
        dorsal = V((0, -d.z, d.y))                           # the back of the neck
        if dorsal.z + dorsal.y < 0:
            dorsal = -dorsal
        base, _ = A.surface(c + dorsal * 2.0, -dorsal)
        skin = A.skin_at(base)
        b0 = base - dorsal * 0.06
        lean = lambda deg: dorsal * math.cos(math.radians(deg)) + d * math.sin(math.radians(deg))
        # Nearly straight, the leading edge bowing a little: the tip leans furthest back.
        ctrl = [b0, base + lean(S['lean'] - 12) * (0.5 * height), base + lean(S['lean']) * height]
        path = _smooth_path(ctrl, res['spine_steps'])
        chord = S['chord'] * height
        tube(pc, path, lambda f: chord * (1 - f) ** 0.9 + 0.004, res['spine_sides'], lambda i, f: skin, horn_mat,
             ref=V((1, 0, 0)), aspect=S['half_width'] / chord, uv_y=k)
    return pc


def build_tail_fin(A, res):
    pc = Piece('tailFin', 'tail', 'fin', [f'tail{i}' for i in range(10)])
    T = TAIL_FIN
    pts, s = A.chain([f'tail{i}' for i in range(10)], 'tailtip')
    s0, s1 = T['span'][0] * s[-1], T['span'][1] * s[-1]
    n = T['teeth']
    cols = []                                               # (arc, height fraction of the tooth, tooth)
    for t in range(n):
        a = s0 + (s1 - s0) * t / n
        b = s0 + (s1 - s0) * (t + 1) / n
        # The first tooth rises out of the tail; the others from the web.
        prof = [(0.0, T['web'] if t else 0.05), (T['peak'], 1.0), (min(T['peak'] + 0.12, 0.95), T['web'] * 0.7)]
        if res['fin_cols'] >= 5:
            prof.insert(1, (0.4 * T['peak'], 0.55))
            prof.insert(3, (T['peak'] + 0.06, 0.6))
        for u, hgt in prof:
            cols.append((a + (b - a) * u, hgt, t))
    cols.append((s1, 0.05, n - 1))
    grid = []                                                # per column: (left, right) per row, top shared
    rows = 3 if res['fin_cols'] >= 5 else 2
    for ci, (x, hf, t) in enumerate(cols):
        c, d = _at(pts, s, x)
        dorsal = V((0, -d.z, d.y))
        if dorsal.z < 0:
            dorsal = -dorsal
        base, _ = A.surface(c + dorsal * 2.0, -dorsal)
        skin = A.skin_at(base)
        g = t / max(n - 1, 1)
        H = (T['height'][0] + (T['height'][1] - T['height'][0]) * g) * hf
        w0 = T['half_width'][0] + (T['half_width'][1] - T['half_width'][0]) * g
        # Buried in the tail, but never through it where the tail is thin.
        depth = min(0.04, 0.5 * (base - c).length)
        b0 = base - dorsal * depth
        side = V((1, 0, 0))
        col = []
        for r in range(rows):
            f = r / rows
            p = b0 + dorsal * ((H + depth) * f)
            w = w0 * (1 - f) ** 0.7
            m = (REGION['horn'], 0.0, f, 0.0)
            col.append((pc.v(p + side * w, skin, m, (f, t)), pc.v(p - side * w, skin, m, (f, t))))
        top = pc.v(b0 + dorsal * (H + depth), skin, (REGION['horn'], 0.0, 1.0, 0.0), (1.0, t))
        grid.append((col, top, c))
    for ci in range(len(grid) - 1):
        (ca, ta, axa), (cb, tb, axb) = grid[ci], grid[ci + 1]
        inside = (axa + axb) / 2
        for side in (0, 1):
            for r in range(rows - 1):
                pc.tri(ca[r][side], cb[r][side], cb[r + 1][side], outward=inside + V((1 - 2 * side, 0, 0)) * -1.0)
                pc.tri(ca[r][side], cb[r + 1][side], ca[r + 1][side], outward=inside + V((1 - 2 * side, 0, 0)) * -1.0)
            pc.tri(ca[rows - 1][side], cb[rows - 1][side], tb, outward=inside + V((1 - 2 * side, 0, 0)) * -1.0)
            pc.tri(ca[rows - 1][side], tb, ta, outward=inside + V((1 - 2 * side, 0, 0)) * -1.0)
    # Close the two ends, facing away from the next column in.
    for (col, top, _ax), inner in ((grid[0], grid[1][2]), (grid[-1], grid[-2][2])):
        for r in range(rows - 1):
            pc.tri(col[r][0], col[r][1], col[r + 1][1], outward=inner)
            pc.tri(col[r][0], col[r + 1][1], col[r + 1][0], outward=inner)
        pc.tri(col[rows - 1][0], col[rows - 1][1], top, outward=inner)
    return pc


BUILDERS = dict(horns=build_horns, whiskers=build_whiskers, cheekFins=build_cheek_fins, spines=build_spines,
                tailFin=build_tail_fin)


def build_all(skeleton_path, lod=0):
    """The white elder's pieces at one LOD, and the skeleton."""
    sk = load_skeleton(skeleton_path)
    A = Anchors(sk)
    parts = [BUILDERS[n](A, RES[lod]) for n in RES[lod]['pieces']]
    for pc in parts:
        stray = {b for s in pc.skin for b in s} - set(pc.expected)
        if stray:
            raise RuntimeError(f'{pc.name} rides bones it is not built for: {sorted(stray)}')
    return parts, sk


# --- normals, view and export --------------------------------------------------------------------

def normals(pc):
    """Smooth vertex normals from each piece's own triangles (area weighted)."""
    P = np.array([p[:] for p in pc.P])
    N = np.zeros_like(P)
    for group in pc.tris:
        if not group:
            continue
        t = np.array(group)
        fn = np.cross(P[t[:, 1]] - P[t[:, 0]], P[t[:, 2]] - P[t[:, 0]])
        for k in range(3):
            np.add.at(N, t[:, k], fn)
    N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-12)
    return N


def show(parts, lod=0):
    """The parts as Blender objects (bind space) in their own collection, skinned to Dragon_Rig."""
    coll = bpy.data.collections.get(CFG['coll'])
    if coll is None:
        coll = bpy.data.collections.new(CFG['coll'])
        bpy.context.scene.collection.children.link(coll)
    mats = {}
    for key, rgb in (('horn', (0.93, 0.89, 0.80, 1)), ('skin', (0.97, 0.94, 0.88, 1)), ('fin', (0.95, 0.90, 0.82, 1))):
        m = bpy.data.materials.get(f'Part_{key}') or bpy.data.materials.new(f'Part_{key}')
        m.diffuse_color = rgb
        mats[key] = m
    out = []
    for pc in parts:
        name = f"{CFG['prefix']}{pc.name}" + (f'_LOD{lod}' if lod else '')
        old = bpy.data.objects.get(name)
        if old:
            bpy.data.objects.remove(old, do_unlink=True)
        me = bpy.data.meshes.new(name)
        faces = [list(t) for t in pc.tris[0]] + [list(t) for t in pc.tris[1]]
        me.from_pydata([p[:] for p in pc.P], [], faces)
        me.materials.append(mats['skin' if pc.name == 'whiskers' else 'horn'])
        me.materials.append(mats['fin'])
        for i, poly in enumerate(me.polygons):
            poly.material_index = 0 if i < len(pc.tris[0]) else 1
            poly.use_smooth = True
        me.update()
        ob = bpy.data.objects.new(name, me)
        coll.objects.link(ob)
        for vi, sk in enumerate(pc.skin):
            for bn, w in sk.items():
                g = ob.vertex_groups.get(bn) or ob.vertex_groups.new(name=bn)
                g.add([vi], w, 'REPLACE')
        rig = bpy.data.objects.get('Dragon_Rig')
        if rig:
            ob.parent = rig
            mod = ob.modifiers.new('Armature', 'ARMATURE')
            mod.object = rig
        ob['part'] = json.dumps(dict(slot=pc.slot, option=pc.option, piece=pc.name, lod=lod))
        out.append(ob)
    return out


def report(parts):
    return {pc.name: dict(verts=len(pc.P), tris=pc.triangles, membrane_tris=len(pc.tris[1]),
                          bones=sorted({b for s in pc.skin for b in s})) for pc in parts}


def export_parts_glb(path, sets, sk, provenance=None):
    """The parts as one GLB in the game's bind space, one mesh per piece and LOD (`sets` maps each
    LOD to its pieces). Each mesh has the body GLB's attributes (POSITION, NORMAL, JOINTS_0 over
    extras.jointNames, WEIGHTS_0, _AMAT, _AUV2, _AEXTRA) plus _ASTRAND (strand index, 0 at the root ..
    1 at the tip) on the whiskers, and one primitive per group used (material 0 opaque, 1 membrane).
    extras.part names the catalog slot and option it belongs to and its LOD; extras.strands gives the
    whiskers' rest nodes for the verlet."""
    joint_names = [b['name'] for b in sk['bones']]
    jidx = {n: i for i, n in enumerate(joint_names)}
    blobs, views, accs, meshes, nodes = [], [], [], [], []

    def add(arr, ctype, typ, target=None, minmax=False):
        data = np.ascontiguousarray(arr).tobytes()
        off = sum(len(b) for b in blobs)
        blobs.append(data + b'\0' * ((-len(data)) % 4))
        v = dict(buffer=0, byteOffset=off, byteLength=len(data))
        if target:
            v['target'] = target
        views.append(v)
        a = dict(bufferView=len(views) - 1, componentType=ctype, count=int(arr.shape[0]), type=typ)
        if minmax:
            a['min'], a['max'] = arr.min(0).tolist(), arr.max(0).tolist()
        accs.append(a)
        return len(accs) - 1

    F, U16, U32 = 5126, 5123, 5125
    totals = {}
    for lod, pc in [(lod, pc) for lod in sorted(sets) for pc in sets[lod]]:
        P = to_game([p[:] for p in pc.P]).astype(np.float32)
        N = to_game(normals(pc)).astype(np.float32)
        J = np.zeros((len(P), 4), np.uint16)
        W = np.zeros((len(P), 4), np.float32)
        for i, sk_ in enumerate(pc.skin):
            items = sorted(sk_.items(), key=lambda kv: -kv[1])[:4]
            s = sum(w for _, w in items) or 1.0
            for k, (bn, w) in enumerate(items):
                J[i, k] = jidx[bn]
                W[i, k] = w / s
        A = np.array(pc.mat, np.float32)
        U = np.array(pc.uv, np.float32)
        E = np.tile(np.array([1, 0, 0, 0], np.float32), (len(P), 1))
        attrs = dict(POSITION=add(P, F, 'VEC3', 34962, True), NORMAL=add(N, F, 'VEC3', 34962),
                     JOINTS_0=add(J, U16, 'VEC4', 34962), WEIGHTS_0=add(W, F, 'VEC4', 34962),
                     _AMAT=add(A, F, 'VEC4', 34962), _AUV2=add(U, F, 'VEC2', 34962), _AEXTRA=add(E, F, 'VEC4', 34962))
        if pc.strands:
            attrs['_ASTRAND'] = add(np.array(pc.strand, np.float32), F, 'VEC2', 34962)
        prims = []
        for g, tris in enumerate(pc.tris):
            if tris:
                prims.append(dict(attributes=attrs, indices=add(np.array(tris, np.uint32).reshape(-1, 1), U32, 'SCALAR', 34963), material=g))
        extras = dict(part=dict(slot=pc.slot, option=pc.option, piece=pc.name, lod=lod), jointNames=joint_names)
        if pc.strands:
            extras['strands'] = pc.strands
        name = f'{pc.name}_lod{lod}'
        meshes.append(dict(name=name, primitives=prims, extras=extras))
        nodes.append(dict(name=name, mesh=len(meshes) - 1))
        t = totals.setdefault(f'lod{lod}', dict(tris=0, verts=0))
        t['tris'] += pc.triangles
        t['verts'] += len(P)
    binary = b''.join(blobs)
    gltf = dict(asset=dict(version='2.0', generator='havens dragon_parts.py', extras=dict(provenance=provenance or {})),
                scene=0, scenes=[dict(nodes=list(range(len(nodes))))], nodes=nodes, meshes=meshes,
                materials=[dict(name='body'), dict(name='membrane', doubleSided=True)],
                buffers=[dict(byteLength=len(binary))], bufferViews=views, accessors=accs)
    js = json.dumps(gltf, separators=(',', ':')).encode()
    js += b' ' * ((-len(js)) % 4)
    out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(binary))
    out += struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(binary), 0x004E4942) + binary
    with open(path, 'wb') as f:
        f.write(out)
    return dict(path=path, bytes=len(out), **totals)


def run_all(skeleton_path, path=None, provenance=None):
    """Every LOD's pieces, shown in Blender; written to `path` when given."""
    sets, rep = {}, {}
    for lod in sorted(RES):
        parts, sk = build_all(skeleton_path, lod)
        show(parts, lod)
        sets[lod] = parts
        rep[lod] = report(parts)
    out = export_parts_glb(path, sets, sk, provenance) if path else None
    return rep, out
