# Harrier Meshy fit (gate G3b): conform a Meshy base body to the game's Harrier skeleton.
#
# Runs inside Blender (5.2) with the pilot file open (havens-blender-pilot/harrier-pilot.blend), which
# holds the game Harrier imported from scripts/wyvern-export-glb.mjs (objects Harrier_Rig, Harrier_Body)
# and the raw Meshy download (Meshy_Harrier_Raw). Robert's direction (2026-10-18): keep the game
# Harrier's proportions and rig; alter the new model to fit them.
#
# Steps
#   1. clean   copy the raw mesh, drop stray islands, cut the wing-arms and membranes off at the body,
#              close it (octree remesh), relax, decimate to ~15,500 triangles
#   2. fit rig a temporary armature (FitRig) with the game's bone names, placed on landmarks read off
#              the Meshy body; Blender bone-heat weights
#   3. envelope per bone, the Meshy body's cross-section (depth and width at mid-segment) is mapped
#              onto the game body's, and its length onto the game bone's; parameters are smoothed
#              along each chain so neighbouring bones agree
#   4. conform each vertex = weighted blend of its bones' transforms (linear blend skinning in rest),
#              giving a body in the game's bind space, bound to Harrier_Rig with the same weights
#   5. attrs   region / belly / dorsal / pattern coordinates copied from the nearest game skin vertex,
#              so the game's wyvern shader paints the new body
#   6. keep    a copy of the game mesh keeping what the new body does not replace: wings (arm tubes and
#              membranes), tack, horns and spines, eyes, hand claws
#
# Exec from the MCP bridge: exec(open(path).read()); run_all()

import json

import bmesh
import bpy
import mathutils
import numpy as np

V = mathutils.Vector

RAW, WORK, OUT, KEEP = 'Meshy_Harrier_Raw', 'Meshy_Harrier_Work', 'Harrier_Meshy_Body', 'Harrier_Keep'
RIG, GBODY, COLL = 'Harrier_Rig', 'Harrier_Body', 'Harrier Pilot'
TRIS = 10500   # body only; with the kept wings, tack and horns the whole Harrier stays under the 24,000 LOD0 ceiling

# Landmarks on the Meshy body, in its object space (head toward -Y, up +Z, the creature's left +X),
# read off orthographic side and front views of harrier-raw.glb (sha256 7243fe80...).
LANDMARKS = {
    'snout': (0, -0.390, 0.150), 'head': (0, -0.283, 0.172),
    'neck5': (0, -0.282, 0.150), 'neck4': (0, -0.280, 0.124), 'neck3': (0, -0.278, 0.101),
    'neck2': (0, -0.275, 0.079), 'neck1': (0, -0.270, 0.057), 'neck0': (0, -0.262, 0.035),
    'chest': (0, -0.228, -0.003), 'root': (0, -0.193, -0.024),
    'hipL': (0.050, -0.140, -0.035), 'kneeL': (0.055, -0.190, -0.095), 'ankleL': (0.060, -0.073, -0.125),
    'ballL': (0.070, -0.130, -0.190), 'toetipL': (0.080, -0.205, -0.198),
    'tail0': (0, -0.066, -0.028), 'tailtip': (0, 0.392, -0.027),
}
TAIL_POLY = [(-0.066, -0.028), (-0.05, -0.030), (0.0, -0.034), (0.1, -0.040), (0.2, -0.033), (0.3, -0.018),
             (0.36, -0.020), (0.392, -0.027)]

MESHY_SHARE = 0.75
# The head stays the game's own (Robert, 2026-10-18: the procedural head, glowing eyes, swappable
# through the wyvernHead cosmetic). The Meshy head is cut off at the head joint, and the neck eases
# from MESHY_SHARE to the game's own girth toward the skull, so the game head seats on it.
HEAD_FAMILY = ('head', 'jaw', 'gular', 'tongue0', 'tongue1', 'fanL', 'fanR')
NECK_EASE = {'neck3': 0.6, 'neck4': 0.35, 'neck5': 0.15}
NATURAL_SCALE = 15.0
HEAD_GIRTH = 1.05

WING_PREFIX = ('humerus', 'forearm', 'hand', 'finger', 'fold', 'claw')
SKIN_REGIONS = (0, 8)
GAME_TOE_REGIONS = (0, 8, 9)


def _islands(bm):
    seen, out = set(), []
    for v in bm.verts:
        if v.index in seen:
            continue
        st, ids = [v], []
        while st:
            x = st.pop()
            if x.index in seen:
                continue
            seen.add(x.index)
            ids.append(x)
            st.extend(e.other_vert(x) for e in x.link_edges)
        out.append(ids)
    out.sort(key=len)
    return out


def _select_only(obj):
    for o in bpy.context.selected_objects:
        o.select_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def clean():
    raw = bpy.data.objects[RAW]
    old = bpy.data.objects.get(WORK)
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    w = raw.copy()
    w.data = raw.data.copy()
    w.name = WORK
    raw.users_collection[0].objects.link(w)
    bm = bmesh.new()
    bm.from_mesh(w.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    isl = _islands(bm)
    bmesh.ops.delete(bm, geom=[v for i in isl[:-1] for v in i], context='VERTS')
    bm.normal_update()
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.normal_update()
    bvh = mathutils.bvhtree.BVHTree.FromBMesh(bm)
    bm.verts.ensure_lookup_table()
    co = np.array([v.co[:] for v in bm.verts])
    thick = np.ones(len(co))
    for v in bm.verts:
        n = v.normal
        if n.length < 1e-6:
            continue
        hit = bvh.ray_cast(v.co - n * 1e-4, -n, 0.05)
        if hit[0] is not None:
            thick[v.index] = hit[3]
    ax, y, z = np.abs(co[:, 0]), co[:, 1], co[:, 2]
    wing = (ax > 0.085) & (z > -0.06)
    shoulder = (ax > 0.058) & (y > -0.265) & (y < -0.17) & (z > 0.015)
    membrane = (thick < 0.006) & (ax > 0.035) & (y > -0.27) & (y < 0.02) & (z > -0.06)
    dele = wing | shoulder | membrane
    bmesh.ops.delete(bm, geom=[bm.verts[i] for i in np.nonzero(dele)[0]], context='VERTS')
    isl = _islands(bm)
    bmesh.ops.delete(bm, geom=[v for i in isl[:-1] for v in i], context='VERTS')
    r = bmesh.ops.holes_fill(bm, edges=[e for e in bm.edges if e.is_boundary], sides=400)
    bmesh.ops.triangulate(bm, faces=r['faces'])
    bm.normal_update()
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(w.data)
    bm.free()
    _select_only(w)
    rm = w.modifiers.new('Octree', 'REMESH')
    rm.mode, rm.octree_depth, rm.scale, rm.use_remove_disconnected = 'SMOOTH', 9, 0.9, True
    bpy.ops.object.modifier_apply(modifier='Octree')
    sm = w.modifiers.new('Relax', 'LAPLACIANSMOOTH')
    sm.lambda_factor, sm.iterations, sm.use_volume_preserve = 0.4, 3, True
    bpy.ops.object.modifier_apply(modifier='Relax')
    for _ in range(3):
        bm = bmesh.new()
        bm.from_mesh(w.data)
        bmesh.ops.triangulate(bm, faces=bm.faces)
        bm.to_mesh(w.data)
        n = len(bm.faces)
        bm.free()
        if n <= TRIS * 1.02:
            break
        dc = w.modifiers.new('Decimate', 'DECIMATE')
        dc.decimate_type, dc.ratio, dc.use_symmetry, dc.symmetry_axis = 'COLLAPSE', TRIS / n, True, 'X'
        bpy.ops.object.modifier_apply(modifier='Decimate')
    for p in w.data.polygons:
        p.use_smooth = True
    w.hide_set(False)
    return w


def _landmarks(grig):
    L = {k: tuple(v) for k, v in LANDMARKS.items()}
    for k in list(L):
        if k.endswith('L'):
            x, y, z = L[k]
            L[k[:-1] + 'R'] = (-x, y, z)
    # Meshy tail joints at the game's arc-length fractions from tail0 to the tip.
    gy = [(grig.matrix_world @ grig.data.bones[f'tail{i}'].head_local) for i in range(10)]
    gb = bpy.data.objects[GBODY]
    tip_y = max((gb.matrix_world @ v.co).y for v in gb.data.vertices)
    pts = gy + [V((0, tip_y, gy[-1].z))]
    gl = np.r_[0, np.cumsum([(pts[i + 1] - pts[i]).length for i in range(10)])]
    fr = gl / gl[-1]
    poly = np.array(TAIL_POLY)
    ml = np.r_[0, np.cumsum(np.linalg.norm(np.diff(poly, axis=0), axis=1))]
    for i in range(10):
        d = fr[i] * ml[-1]
        L[f'tail{i}'] = (0.0, float(np.interp(d, ml, poly[:, 0])), float(np.interp(d, ml, poly[:, 1])))
    return L


def _segments():
    seg = {'spine': ('root', 'chest'), 'chest': ('chest', 'neck0'), 'head': ('head', 'snout'), 'pelvis': ('root', 'tail0')}
    for i in range(5):
        seg[f'neck{i}'] = (f'neck{i}', f'neck{i + 1}')
    seg['neck5'] = ('neck5', 'head')
    for i in range(9):
        seg[f'tail{i}'] = (f'tail{i}', f'tail{i + 1}')
    seg['tail9'] = ('tail9', 'tailtip')
    for s in 'LR':
        seg[f'thigh{s}'] = (f'hip{s}', f'knee{s}')
        seg[f'shin{s}'] = (f'knee{s}', f'ankle{s}')
        seg[f'meta{s}'] = (f'ankle{s}', f'ball{s}')
        seg[f'toes{s}'] = (f'ball{s}', f'toetip{s}')
    return seg


# Game joint key for each Meshy landmark key.
def _gkey(k):
    return {'hipL': 'thighL', 'hipR': 'thighR', 'kneeL': 'shinL', 'kneeR': 'shinR', 'ankleL': 'metaL',
            'ankleR': 'metaR', 'ballL': 'toesL', 'ballR': 'toesR'}.get(k, k)


PARENT = {'chest': 'spine', 'neck0': 'chest', 'head': 'neck5', 'tail0': 'pelvis'}
PARENT.update({f'neck{i}': f'neck{i - 1}' for i in range(1, 6)})
PARENT.update({f'tail{i}': f'tail{i - 1}' for i in range(1, 10)})
for _s in 'LR':
    PARENT.update({f'thigh{_s}': 'pelvis', f'shin{_s}': f'thigh{_s}', f'meta{_s}': f'shin{_s}', f'toes{_s}': f'meta{_s}'})

CHAINS = [['spine', 'chest', 'neck0', 'neck1', 'neck2', 'neck3', 'neck4', 'neck5', 'head'],
          ['pelvis'] + [f'tail{i}' for i in range(10)]] + [[f'thigh{s}', f'shin{s}', f'meta{s}', f'toes{s}'] for s in 'LR']

# Which bones' vertices count as the same body part when measuring a bone's cross-section.
def _family(b):
    if b in ('spine', 'chest', 'pelvis'):
        return {'spine', 'chest', 'pelvis', 'root', 'breath', 'neck0', 'tail0'}
    if b.startswith('neck'):
        return {f'neck{i}' for i in range(6)} | {'chest'}
    if b == 'head':
        return {'head', 'jaw', 'gular', 'neck5'}
    if b.startswith('tail'):
        return {f'tail{i}' for i in range(10)} | {'pelvis'}
    s = b[-1]
    return {f'thigh{s}', f'shin{s}', f'meta{s}', f'toes{s}'}


def fit_rig(w, L):
    old = bpy.data.objects.get('FitRig')
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    ad = bpy.data.armatures.new('FitRig')
    ad.display_type = 'STICK'
    fr = bpy.data.objects.new('FitRig', ad)
    w.users_collection[0].objects.link(fr)
    fr.matrix_world = w.matrix_world.copy()
    fr.show_in_front = True
    _select_only(fr)
    bpy.ops.object.mode_set(mode='EDIT')
    for n, (a, b) in _segments().items():
        e = ad.edit_bones.new(n)
        e.head, e.tail, e.roll = V(L[a]), V(L[b]), 0
    for c, p in PARENT.items():
        ad.edit_bones[c].parent = ad.edit_bones[p]
    bpy.ops.object.mode_set(mode='OBJECT')
    w.vertex_groups.clear()
    for m in list(w.modifiers):
        w.modifiers.remove(m)
    w.parent = None
    _select_only(w)
    fr.select_set(True)
    bpy.context.view_layer.objects.active = fr
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    if not w.vertex_groups or w.parent != fr:
        raise RuntimeError('bone-heat weighting failed (is the work mesh visible and selectable?)')
    return fr


def _frame(u):
    u = u / np.linalg.norm(u)
    X = np.array([1.0, 0, 0])
    wv = X - X.dot(u) * u
    if np.linalg.norm(wv) < 1e-6:
        wv = np.array([0, 0, 1.0]) - u[2] * u
    wv /= np.linalg.norm(wv)
    return np.array([u, np.cross(wv, u), wv]).T


def _dominant(obj):
    names = {g.index: g.name for g in obj.vertex_groups}
    return np.array([names[max(v.groups, key=lambda g: g.weight).group] if v.groups else '' for v in obj.data.vertices])


def _game_skin():
    gb = bpy.data.objects[GBODY]
    me = gb.data
    co = np.array([(gb.matrix_world @ v.co)[:] for v in me.vertices])
    reg = np.array([d.color[0] for d in me.attributes['_AMAT'].data]).round().astype(int)
    mem = np.zeros(len(co), bool)
    for p in me.polygons:
        if p.material_index == 1:
            mem[list(p.vertices)] = True
    dom = _dominant(gb)
    wing = np.array([any(d.startswith(p) for p in WING_PREFIX) for d in dom])
    return gb, co, reg, mem, dom, wing


def envelopes(w, L):
    grig = bpy.data.objects[RIG]
    G = {b.name: np.array((grig.matrix_world @ b.head_local)[:]) for b in grig.data.bones}
    gb, gco, greg, gmem, gdom, gwing = _game_skin()
    gskin = np.isin(greg, GAME_TOE_REGIONS) & ~gmem & ~gwing
    for s in 'LR':
        t = gco[(gdom == 'toes' + s) & gskin]
        G['toetip' + s] = t[np.argmin(t[:, 1])]
    h = gco[gskin & (gdom == 'head')]
    G['snout'] = h[np.argmin(h[:, 1])]
    t = gco[gskin & (gdom == 'tail9')]
    G['tailtip'] = t[np.argmax(t[:, 1])]
    mco = np.array([(w.matrix_world @ v.co)[:] for v in w.data.vertices])
    mdom = _dominant(w)
    mw = np.array(w.matrix_world)
    Lw = {k: (mw @ np.r_[v, 1.0])[:3] for k, v in L.items()}
    T = {}
    for b, (ka, kb) in _segments().items():
        a, bb = Lw[ka], Lw[kb]
        A, B = G[_gkey(ka)], G[_gkey(kb)]
        Fm, Fg = _frame(bb - a), _frame(B - A)
        lm, lg = np.linalg.norm(bb - a), np.linalg.norm(B - A)
        fam = list(_family(b))
        qm = (mco[np.isin(mdom, fam)] - a) @ Fm
        qg = (gco[gskin & np.isin(gdom, fam)] - A) @ Fg
        lo, hi = (0.1, 0.9) if b in ('head', 'toesL', 'toesR', 'tail9') else (0.2, 0.8)
        qm = qm[(qm[:, 0] > lo * lm) & (qm[:, 0] < hi * lm)]
        qg = qg[(qg[:, 0] > lo * lg) & (qg[:, 0] < hi * lg)]
        t = dict(a=a, A=A, Fm=Fm, Fg=Fg, ku=lg / lm)
        if len(qm) >= 6 and len(qg) >= 6:
            for i, key in ((1, 'v'), (2, 'w')):
                m0, m1 = np.percentile(qm[:, i], [2, 98])
                g0, g1 = np.percentile(qg[:, i], [2, 98])
                k = (g1 - g0) / max(m1 - m0, 1e-6)
                t['k' + key], t['o' + key] = k, g0 - k * m0
        T[b] = t
    # Fill gaps from neighbours, clamp, then smooth along each chain.
    for ch in CHAINS:
        for key in ('kv', 'ov', 'kw', 'ow'):
            vals = [T[b].get(key) for b in ch]
            idx = [i for i, v in enumerate(vals) if v is not None]
            vals = np.interp(range(len(ch)), idx, [vals[i] for i in idx])
            sm = vals.copy()
            for i in range(len(ch)):
                sm[i] = 0.25 * vals[max(i - 1, 0)] + 0.5 * vals[i] + 0.25 * vals[min(i + 1, len(ch) - 1)]
            for b, v in zip(ch, sm):
                T[b][key] = float(v)
    for b in T:
        base = T[b]['ku']
        for key in ('kv', 'kw'):
            T[b][key] = float(np.clip(T[b][key], 0.55 * base, 1.8 * base))
    # Blend: MESHY_SHARE of the Meshy body's own girth (scaled by NATURAL_SCALE, eased toward the
    # bone's length stretch so long slender parts stay slender), the rest the game body's envelope.
    # Robert, 2026-10-18: "75% the newer model". Bone lengths always follow the game rig.
    for ch in CHAINS:
        nat = np.array([np.sqrt(T[b]['ku'] * NATURAL_SCALE) for b in ch])
        sm = nat.copy()
        for i in range(len(ch)):
            sm[i] = 0.25 * nat[max(i - 1, 0)] + 0.5 * nat[i] + 0.25 * nat[min(i + 1, len(ch) - 1)]
        for b, k in zip(ch, sm):
            share = NECK_EASE.get(b, MESHY_SHARE)
            for key in ('v', 'w'):
                T[b]['k' + key] = share * float(k) + (1 - share) * T[b]['k' + key]
                T[b]['o' + key] = (1 - share) * T[b]['o' + key]
    # The head keeps the Meshy skull's own shape: one uniform scale, set by the game head's length.
    for key in ('v', 'w'):
        T['head']['k' + key] = T['head']['ku'] * HEAD_GIRTH
        T['head']['o' + key] = 0.0
    return T


def conform(w, T):
    grig = bpy.data.objects[RIG]
    names = {g.index: g.name for g in w.vertex_groups}
    co = np.array([(w.matrix_world @ v.co)[:] for v in w.data.vertices])
    out = np.zeros_like(co)
    for v in w.data.vertices:
        acc, tw = np.zeros(3), 0.0
        for g in v.groups:
            t = T.get(names[g.group])
            if t is None or g.weight < 1e-4:
                continue
            q = t['Fm'].T @ (co[v.index] - t['a'])
            q = np.array([t['ku'] * q[0], t['kv'] * q[1] + t['ov'], t['kw'] * q[2] + t['ow']])
            acc += g.weight * (t['A'] + t['Fg'] @ q)
            tw += g.weight
        out[v.index] = acc / tw
    old = bpy.data.objects.get(OUT)
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    me = w.data.copy()
    me.name = OUT
    for at in [a for a in me.attributes if a.name.startswith('_A')]:
        me.attributes.remove(at)
    me.vertices.foreach_set('co', out.ravel())
    me.update()
    nb = bpy.data.objects.new(OUT, me)
    bpy.data.collections[COLL].objects.link(nb)
    nb.vertex_groups.clear()
    for g in w.vertex_groups:
        nb.vertex_groups.new(name=g.name)
    for v in w.data.vertices:
        for g in v.groups:
            nb.vertex_groups[names[g.group]].add([v.index], g.weight, 'REPLACE')
    nb.parent = grig
    nb.matrix_parent_inverse = grig.matrix_world.inverted()
    nb.modifiers.new('Armature', 'ARMATURE').object = grig
    for p in me.polygons:
        p.use_smooth = True
    return nb


def transfer_attrs(nb):
    gb, gco, greg, gmem, gdom, gwing = _game_skin()
    src = np.nonzero(np.isin(greg, (0, 8, 9)) & ~gmem & ~gwing)[0]
    kd = mathutils.kdtree.KDTree(len(src))
    for j, i in enumerate(src):
        kd.insert(gco[i], j)
    kd.balance()
    nco = [(nb.matrix_world @ v.co) for v in nb.data.vertices]
    near = np.array([src[kd.find(p)[1]] for p in nco])
    gme = gb.data
    for name in ('_AMAT', '_AUV2', '_AEXTRA'):
        a = gme.attributes[name]
        if a.data_type == 'FLOAT2':
            vals = np.array([d.vector[:] for d in a.data])
        else:
            vals = np.array([d.color[:] for d in a.data])
        at = nb.data.attributes.new(name, a.data_type, 'POINT')
        at.data.foreach_set('vector' if a.data_type == 'FLOAT2' else 'color', vals[near].ravel())
    nb.data.update()


def cut_head(nb):
    """Remove the Meshy skull: every vertex riding mostly on the head bone (the game's head replaces it)."""
    dom = _dominant(nb)
    bm = bmesh.new()
    bm.from_mesh(nb.data)
    bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[bm.verts[i] for i in np.nonzero(np.isin(dom, HEAD_FAMILY))[0]], context='VERTS')
    bm.to_mesh(nb.data)
    bm.free()
    nb.data.update()


def keep_parts():
    gb = bpy.data.objects[GBODY]
    old = bpy.data.objects.get(KEEP)
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    k = gb.copy()
    k.data = gb.data.copy()
    k.name = k.data.name = KEEP
    bpy.data.collections[COLL].objects.link(k)
    me = k.data
    reg = np.array([d.color[0] for d in me.attributes['_AMAT'].data]).round().astype(int)
    dom = _dominant(k)
    wing = np.array([any(d.startswith(p) for p in WING_PREFIX) for d in dom])
    head = np.isin(dom, HEAD_FAMILY)
    bm = bmesh.new()
    bm.from_mesh(me)
    kill = []
    for f in bm.faces:
        if f.material_index == 1:
            continue
        vs = [v.index for v in f.verts]
        if head[vs].mean() > 0.5:
            kill.append(f)
            continue
        if wing[vs].mean() > 0.5:
            continue
        if int(np.bincount(reg[vs]).argmax()) in (0, 8, 3, 9, 12, 13):
            kill.append(f)
    bmesh.ops.delete(bm, geom=kill, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(me)
    bm.free()
    return k


RIGID_REGIONS = (1, 2)            # horns and spines, eyes: move whole, never bend
TACK_REGIONS = (4, 5, 6, 7, 11)   # leather, metal, cloth, wood, wool: follow the surface, smoothly
TACK_RADIUS = 0.35                # m, spatial smoothing of the tack's displacement
WING_FALLOFF = 0.4                # m from the old body surface, wing roots follow the body this far


def _bvh(obj, face_ok=None):
    co = [(obj.matrix_world @ v.co) for v in obj.data.vertices]
    polys = [list(p.vertices) for p in obj.data.polygons if face_ok is None or face_ok(p)]
    return mathutils.bvhtree.BVHTree.FromPolygons(co, polys)


def reseat(nb, k):
    """Move the kept game parts from the old body surface to the new one (rest space)."""
    grig = bpy.data.objects[RIG]
    gb, gco, greg, gmem, gdom, gwing = _game_skin()
    skin = np.isin(greg, SKIN_REGIONS) & ~gmem & ~gwing
    old = _bvh(gb, lambda p: skin[list(p.vertices)].all())
    new = _bvh(nb)
    segs = []
    for b in grig.data.bones:
        if b.parent and not any(b.name.startswith(p) for p in WING_PREFIX):
            segs.append((np.array((grig.matrix_world @ b.parent.head_local)[:]), np.array((grig.matrix_world @ b.head_local)[:])))

    def axis_point(q):
        best, bd = None, 1e9
        for a, b in segs:
            ab = b - a
            t = np.clip(np.dot(q - a, ab) / max(np.dot(ab, ab), 1e-9), 0, 1)
            c = a + t * ab
            d = np.linalg.norm(q - c)
            if d < bd:
                best, bd = c, d
        return best

    def disp(p):
        hit = old.find_nearest(V(p))
        if hit[0] is None:
            return np.zeros(3), 1e9
        q = np.array(hit[0][:])
        c = axis_point(q)
        dirv = q - c
        n = np.linalg.norm(dirv)
        pn = None
        if n > 1e-6:
            r = new.ray_cast(V(c), V(dirv / n), 10.0)
            if r[0] is not None:
                pn = np.array(r[0][:])
        if pn is None:
            pn = np.array(new.find_nearest(V(q))[0][:])
        return pn - q, hit[3]

    me = k.data
    kco = np.array([(k.matrix_world @ v.co)[:] for v in me.vertices])
    kreg = np.array([d.color[0] for d in me.attributes['_AMAT'].data]).round().astype(int)
    kmem = np.zeros(len(kco), bool)
    for p in me.polygons:
        if p.material_index == 1:
            kmem[list(p.vertices)] = True
    kdom = _dominant(k)
    kwing = np.array([any(d.startswith(p) for p in WING_PREFIX) for d in kdom]) | kmem
    D = np.zeros_like(kco)
    dist = np.full(len(kco), 1e9)
    # Rigid parts: one displacement per connected piece, taken where it touches the body.
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    done = np.zeros(len(kco), bool)
    for v in bm.verts:
        i = v.index
        if done[i] or kwing[i] or kreg[i] not in RIGID_REGIONS:
            continue
        st, comp = [v], []
        while st:
            x = st.pop()
            if done[x.index]:
                continue
            done[x.index] = True
            comp.append(x.index)
            st.extend(e.other_vert(x) for e in x.link_edges if not done[e.other_vert(x).index])
        comp = np.array(comp)
        ds = [old.find_nearest(V(kco[j]))[3] for j in comp]
        root = comp[int(np.argmin(ds))]
        d, _ = disp(kco[root])
        D[comp] = d
    bm.free()
    # Tack: per-vertex displacement, smoothed in space so the saddle moves as one and straps hug.
    tack = np.nonzero(~kwing & np.isin(kreg, TACK_REGIONS))[0]
    raw = np.array([disp(kco[i])[0] for i in tack]) if len(tack) else np.zeros((0, 3))
    if len(tack):
        kd = mathutils.kdtree.KDTree(len(tack))
        for j, i in enumerate(tack):
            kd.insert(kco[i], j)
        kd.balance()
        for j, i in enumerate(tack):
            nbrs = kd.find_range(kco[i], TACK_RADIUS)
            wts = np.array([np.exp(-(r / (0.5 * TACK_RADIUS)) ** 2) for _, _, r in nbrs])
            D[i] = (raw[[n[1] for n in nbrs]] * wts[:, None]).sum(0) / wts.sum()
    # Wing roots: follow the body near it, fading out along the arm and membrane.
    for i in np.nonzero(kwing)[0]:
        d, dd = disp(kco[i])
        f = max(0.0, 1.0 - dd / WING_FALLOFF)
        D[i] = d * f * f
    inv = np.array(k.matrix_world.inverted())
    newco = kco + D
    loc = (inv @ np.c_[newco, np.ones(len(newco))].T).T[:, :3]
    me.vertices.foreach_set('co', loc.ravel())
    if '_DISP' in me.attributes:
        me.attributes.remove(me.attributes['_DISP'])
    me.attributes.new('_DISP', 'FLOAT_VECTOR', 'POINT').data.foreach_set('vector', D.ravel())
    me.update()
    return dict(rigid=int(done.sum()), tack=int(len(tack)), wing=int(kwing.sum()),
                max_shift=float(np.linalg.norm(D, axis=1).max()))


# The Meshy skull's eye: a ray toward the midline at this height finds the socket's surface.
EYE_PROBE = (0.08, -0.356, 0.177)
EYE_SCALE = 0.72      # the game eyeball is too big for the slimmer skull
EYE_INSET = 0.032     # m, eyeball centre inside the socket surface


def fit_eyes(w, nb, k):
    """Seat the game's eyeballs (region 2) in the Meshy skull's sockets, symmetric."""
    bm = bmesh.new()
    bm.from_mesh(w.data)
    bvh = mathutils.bvhtree.BVHTree.FromBMesh(bm)
    bm.free()
    wco = np.array([v.co[:] for v in w.data.vertices])
    nco = np.array([(nb.matrix_world @ v.co)[:] for v in nb.data.vertices])
    hits = []
    for sx in (1, -1):
        h = bvh.ray_cast(V((sx * EYE_PROBE[0], EYE_PROBE[1], EYE_PROBE[2])), V((-sx, 0, 0)), 0.2)
        idx = np.argsort(np.linalg.norm(wco - np.array(h[0][:]), axis=1))[:6]
        hits.append(nco[idx].mean(0))
    tx = (abs(hits[0][0]) + abs(hits[1][0])) / 2
    ty, tz = (hits[0][1] + hits[1][1]) / 2, (hits[0][2] + hits[1][2]) / 2
    gb = bpy.data.objects[GBODY]
    greg = np.array([d.color[0] for d in gb.data.attributes['_AMAT'].data]).round().astype(int)
    gco = np.array([(gb.matrix_world @ v.co)[:] for v in gb.data.vertices])
    me = k.data
    reg = np.array([d.color[0] for d in me.attributes['_AMAT'].data]).round().astype(int)
    kco = np.array([(k.matrix_world @ v.co)[:] for v in me.vertices])
    eyev = np.nonzero(reg == 2)[0]
    rec = {}
    for sx in (1, -1):
        ids = eyev[np.sign(kco[eyev, 0]) == sx]
        orig = gco[(greg == 2) & (np.sign(gco[:, 0]) == sx)]
        c_old = orig.mean(0)
        target = np.array([sx * (tx - EYE_INSET), ty, tz])
        # Rebuild from the original eyeball: scale about its own centre, then place it.
        k_orig = (kco[ids] - kco[ids].mean(0)) + c_old
        kco[ids] = target + (k_orig - c_old) * EYE_SCALE
        if sx == 1:
            rec = dict(c_old=c_old.tolist(), c_new=target.tolist(), scale=EYE_SCALE)
    inv = np.array(k.matrix_world.inverted())
    me.vertices.foreach_set('co', (inv @ np.c_[kco, np.ones(len(kco))].T).T[:, :3].ravel())
    me.update()
    k['eye_fit'] = json.dumps(rec)
    return rec


def _to_rig(points_world, gb, vectors=False):
    """Blender world (rest) -> the game's rig space (+Z forward, +Y up): via Harrier_Body's local."""
    inv = np.array(gb.matrix_world.inverted())
    if vectors:
        loc = points_world @ inv[:3, :3].T
    else:
        loc = (inv @ np.c_[points_world, np.ones(len(points_world))].T).T[:, :3]
    return np.c_[loc[:, 0], loc[:, 2], -loc[:, 1]]


def export_glb(path, provenance=None):
    """Write the trial body (new body + kept parts) as a GLB in the game's bind space.

    Two primitives over one vertex set: 0 = body (opaque), 1 = membranes. Skin data travel as
    JOINTS_0 / WEIGHTS_0 indexing mesh.extras.jointNames (no glTF skin: the game binds them to its
    own skeleton by name). Custom attributes _AMAT, _AUV2, _AEXTRA are the shader's aMat, aUv2, aExtra.
    """
    gb = bpy.data.objects[GBODY]
    grig = bpy.data.objects[RIG]
    parts = [bpy.data.objects[OUT], bpy.data.objects[KEEP]]
    joint_names = [b.name for b in grig.data.bones]
    jidx = {n: i for i, n in enumerate(joint_names)}
    P, N, J, W, A, U, E, I0, I1 = [], [], [], [], [], [], [], [], []
    base = 0
    for obj in parts:
        me = obj.data
        co = np.array([(obj.matrix_world @ v.co)[:] for v in me.vertices])
        # Smooth normals in rest (the meshes are smooth-shaded; split normals are not needed).
        nr = np.array([(obj.matrix_world.to_3x3() @ v.normal)[:] for v in me.vertices])
        P.append(_to_rig(co, gb))
        n = _to_rig(nr, gb, vectors=True)
        N.append(n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9))
        names = {g.index: g.name for g in obj.vertex_groups}
        jj = np.zeros((len(co), 4), np.uint16)
        ww = np.zeros((len(co), 4), np.float32)
        for v in me.vertices:
            gs = sorted(((g.weight, names[g.group]) for g in v.groups if names[g.group] in jidx and g.weight > 1e-4), reverse=True)[:4]
            s = sum(x for x, _ in gs) or 1.0
            for t, (wt, nm) in enumerate(gs):
                jj[v.index, t] = jidx[nm]
                ww[v.index, t] = wt / s
        J.append(jj)
        W.append(ww)
        A.append(np.array([d.color[:] for d in me.attributes['_AMAT'].data], np.float32))
        U.append(np.array([d.vector[:] for d in me.attributes['_AUV2'].data], np.float32))
        E.append(np.array([d.color[:] for d in me.attributes['_AEXTRA'].data], np.float32))
        for p in me.polygons:
            tri = [base + i for i in p.vertices]
            for t in range(1, len(tri) - 1):
                (I1 if p.material_index == 1 and obj.name == KEEP else I0).append((tri[0], tri[t], tri[t + 1]))
        base += len(co)
    P, N, J, W = np.concatenate(P).astype(np.float32), np.concatenate(N).astype(np.float32), np.concatenate(J), np.concatenate(W)
    A, U, E = np.concatenate(A), np.concatenate(U), np.concatenate(E)
    I0, I1 = np.array(I0, np.uint32).ravel(), np.array(I1, np.uint32).ravel()
    # The seat: how far the tack moved at the saddle anchor (rest), for the rider and the holds.
    k = bpy.data.objects[KEEP]
    pose = grig.data.pose_position
    grig.data.pose_position = 'REST'
    bpy.context.view_layer.update()
    seat = np.array(bpy.data.objects['saddle'].matrix_world.translation[:])
    grig.data.pose_position = pose
    bpy.context.view_layer.update()
    kco = np.array([(k.matrix_world @ v.co)[:] for v in k.data.vertices])
    D = np.array([d.vector[:] for d in k.data.attributes['_DISP'].data])
    kreg = np.array([d.color[0] for d in k.data.attributes['_AMAT'].data]).round().astype(int)
    tack = np.isin(kreg, TACK_REGIONS)
    d2 = np.linalg.norm(kco[tack] - seat, axis=1)
    wts = np.exp(-(d2 / 0.6) ** 2)
    seat_shift = (D[tack] * wts[:, None]).sum(0) / max(wts.sum(), 1e-9)
    eye = json.loads(k.get('eye_fit', '{}'))
    extras = dict(
        jointNames=joint_names,
        seatShift=_to_rig(seat_shift[None], gb, vectors=True)[0].tolist(),
        eye=dict(scale=eye.get('scale', 1.0),
                 cOld=_to_rig(np.array([eye['c_old']]), gb)[0].tolist() if eye else None,
                 cNew=_to_rig(np.array([eye['c_new']]), gb)[0].tolist() if eye else None),
        provenance=provenance or {},
    )
    blobs, views, accs = [], [], []

    def add(arr, ctype, typ, target=None, minmax=False):
        data = np.ascontiguousarray(arr).tobytes()
        off = sum(len(b) for b in blobs)
        pad = (-len(data)) % 4
        blobs.append(data + b'\0' * pad)
        v = dict(buffer=0, byteOffset=off, byteLength=len(data))
        if target:
            v['target'] = target
        views.append(v)
        a = dict(bufferView=len(views) - 1, componentType=ctype, count=int(arr.shape[0]), type=typ)
        if minmax:
            a['min'] = arr.min(0).tolist()
            a['max'] = arr.max(0).tolist()
        accs.append(a)
        return len(accs) - 1

    F, U16, U32 = 5126, 5123, 5125
    attrs = dict(POSITION=add(P, F, 'VEC3', 34962, True), NORMAL=add(N, F, 'VEC3', 34962),
                 JOINTS_0=add(J, U16, 'VEC4', 34962), WEIGHTS_0=add(W, F, 'VEC4', 34962),
                 _AMAT=add(A, F, 'VEC4', 34962), _AUV2=add(U, F, 'VEC2', 34962), _AEXTRA=add(E, F, 'VEC4', 34962))
    prims = [dict(attributes=attrs, indices=add(I0.reshape(-1, 1), U32, 'SCALAR', 34963), material=0),
             dict(attributes=attrs, indices=add(I1.reshape(-1, 1), U32, 'SCALAR', 34963), material=1)]
    binary = b''.join(blobs)
    gltf = dict(asset=dict(version='2.0', generator='havens harrier_meshy_fit.py'),
                scene=0, scenes=[dict(nodes=[0])], nodes=[dict(name='HarrierTrial', mesh=0)],
                meshes=[dict(name='HarrierTrial', primitives=prims, extras=extras)],
                materials=[dict(name='body'), dict(name='membrane', doubleSided=True)],
                buffers=[dict(byteLength=len(binary))], bufferViews=views, accessors=accs)
    js = json.dumps(gltf, separators=(',', ':')).encode()
    js += b' ' * ((-len(js)) % 4)
    import struct
    out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(binary))
    out += struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(binary), 0x004E4942) + binary
    with open(path, 'wb') as f:
        f.write(out)
    return dict(path=path, bytes=len(out), verts=int(len(P)), body_tris=int(len(I0) // 3), membrane_tris=int(len(I1) // 3),
                seatShift=extras['seatShift'], eye=extras['eye'])


def _show(obj):
    for c in obj.users_collection:
        c.hide_viewport = False
        lc = bpy.context.view_layer.layer_collection.children.get(c.name)
        if lc:
            lc.exclude = False
            lc.hide_viewport = False
    obj.hide_set(False)


def run_all(do_clean=True):
    grig = bpy.data.objects[RIG]
    _show(bpy.data.objects[RAW])
    _show(grig)
    w = clean() if do_clean else bpy.data.objects[WORK]
    _show(w)
    L = _landmarks(grig)
    w['fit_landmarks'] = json.dumps(L)
    fit_rig(w, L)
    T = envelopes(w, L)
    nb = conform(w, T)
    cut_head(nb)
    transfer_attrs(nb)
    k = keep_parts()
    moved = reseat(nb, k)
    k['eye_fit'] = '{}'
    hide = bpy.data.materials.get('Harrier_Hide')
    if hide:
        nb.data.materials.clear()
        nb.data.materials.append(hide)
    report = {b: [round(T[b][k], 2) for k in ('ku', 'kv', 'ov', 'kw', 'ow')] for b in T}
    return dict(tris=len(nb.data.polygons), verts=len(nb.data.vertices), keep_faces=len(k.data.polygons),
                reseat=moved, T=report)
