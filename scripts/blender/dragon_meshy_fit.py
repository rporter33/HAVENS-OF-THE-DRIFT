# White dragon Meshy fit (gate G12a): fit a Meshy base body to the game's dragon skeleton.
#
# Generalised from scripts/blender/harrier_meshy_fit.py (G3b, PR #11). Carried over: the clean, a
# temporary FitRig placed on landmarks read off the Meshy body, Blender bone-heat weights, the
# bone-by-bone map of each Meshy segment onto the game bone's (lengths follow the game rig), the
# linear-blend conform into the game's bind space, and the GLB layout the game's trial loader
# reads (JOINTS_0 over mesh.extras.jointNames, _AMAT/_AUV2/_AEXTRA, body and membrane primitives).
#
# What differs, because the dragon has no procedural body (Q47: the game owns the skeleton, the
# Meshy body sets the form):
#   - the skeleton is read from scripts/dragon-export-skeleton.mjs (JSON) and built here as
#     Dragon_Rig; the bones' segments and the points they run between come with it;
#   - every segment is generic: the same table maps landmarks on the Meshy body and points on the
#     game skeleton, so another flight's body needs only its own LANDMARKS;
#   - girth is the Meshy body's own, scaled (no game envelope to blend toward);
#   - the wings are kept: split from the body just outside the root, weighted to the wing bones by
#     distance (bone heat does badly on thin sheets), and split again by thickness into the bone
#     spars (opaque) and the membrane (its own primitive);
#   - the shader attributes are baked from the textured Meshy download (the sheet's region colours:
#     powder-blue back plates, slate claws, pale eyes) and the skeleton's body plan (girth angle,
#     arc length), not copied from a game mesh;
#   - the Harrier's head cut, eye seating and tack reseat don't apply.
#
# Runs inside Blender 5.2 with the pilot file open (havens-blender-pilot/white-dragon-pilot.blend):
#   Meshy_WhiteDragon_Raw       white-dragon-raw.glb       (sha256 45afc967...)
#   Meshy_WhiteDragon_Textured  white-dragon-textured.glb  (sha256 812c8f28...), colour reference only
# Both are archived on archive/g12a-white-dragon. Exec from the MCP bridge:
#   exec(open(path).read()); report = run_all(SKELETON_JSON)
# then, once the result has been looked at:
#   export_glb(path, load_skeleton(SKELETON_JSON), provenance, report_dict)
#
# Frames. Game body space: +Z forward, +Y up, +X left (metres). Blender: (x, -z, y), so the head
# faces -Y and the creature's left is +X, as on the imported Meshy body.

import json
import struct

import bmesh
import bpy
import mathutils
import numpy as np

V = mathutils.Vector

CFG = dict(
    raw='Meshy_WhiteDragon_Raw', tex='Meshy_WhiteDragon_Textured', coll='White Dragon Fit',
    rig='Dragon_Rig', fit_rig='FitRig', work='Dragon_Work', body='Dragon_Meshy_Body', wings='Dragon_Meshy_Wings',
    # Exploratory LOD0 budget (model budgets: 16,000 to 20,000 bare); parts add up to 4,000 more.
    body_tris=12000, wing_tris=6000,
    # Wing split, in Meshy units: the cut plane stands this far outside the wing root; behind the
    # membrane's trailing root only what lies beyond wing_outer (clear of the thighs) or is thin is
    # wing, and thin parts count only beyond wing_inner (clear of the midline). The wing piece keeps
    # an overlap this far inside the cut so its root stays buried in the body.
    # Nothing lower than wing_drop below the membrane's trailing root is wing (the feet and claws are
    # thin too).
    wing_cut=0.012, wing_outer=0.2, wing_inner=0.05, wing_drop=0.1, wing_overlap=0.01,
    # Thickness (ray-cast through the raw mesh, Meshy units): membrane 0.002 to 0.004, bone spars and
    # the membrane next to them 0.008 to 0.02. What of the wing next to the flank thinner than
    # split_thin leaves with the wing.
    split_thin=0.02,
    # Within these of a wing bone's line (Meshy units) the wing is the bone's flesh, drawn as hide;
    # beyond, membrane.
    spar_arm=0.016, spar_finger=0.009,
    # Girth: k = scale^(1-a) * stretch^a, so long slender parts stay slender (the Harrier's NATURAL_SCALE idea).
    girth_stretch=0.5,
)

# Landmarks on the Meshy body (object space: head -Y, up +Z, left +X), placed on orthographic
# renders of white-dragon-raw.glb by three readers and a mesh analysis, reconciled. The body is
# symmetric but for the tail (the polyline follows it) and the wings: the right wing's points are
# registered from the left's (register_mirror) and recorded; other right points mirror the left.
LANDMARKS = {
    'snout': (0.000, -0.755, 0.258),
    'head': (0.000, -0.630, 0.286),
    'eyeL': (0.019, -0.689, 0.295),
    'chest_front': (0.000, -0.636, 0.054),
    'rump': (0.000, -0.135, -0.040),
    'torso_mid_top': (0.000, -0.385, 0.060),
    'torso_mid_bottom': (0.000, -0.385, -0.119),
    'tailtip': (0.429, 0.755, -0.165),
    'scapulaL': (0.052, -0.505, 0.057),
    'shoulderL': (0.065, -0.549, -0.015),
    'elbowL': (0.060, -0.509, -0.106),
    'wristL': (0.064, -0.529, -0.240),
    'foreballL': (0.071, -0.556, -0.300),
    'foretipL': (0.074, -0.587, -0.301),
    'hipL': (0.054, -0.197, -0.034),
    'kneeL': (0.066, -0.176, -0.141),
    'ankleL': (0.071, -0.109, -0.208),
    'ballL': (0.089, -0.144, -0.303),
    'toetipL': (0.093, -0.172, -0.306),
    'wingrootL': (0.050, -0.396, 0.031),
    'wingelbowL': (0.280, -0.384, 0.116),
    'wingwristL': (0.415, -0.398, 0.244),
    'knuckleL': (0.436, -0.392, 0.242),
    'f0midL': (0.582, -0.363, 0.255),    # the leading finger's visible joint, 29% out
    'f0tipL': (0.929, -0.258, 0.188),
    'f1midL': (0.624, -0.311, 0.193),
    'f1tipL': (0.774, -0.225, 0.096),
    'f2midL': (0.520, -0.314, 0.145),
    'f2tipL': (0.575, -0.232, 0.018),
    'trailL': (0.058, -0.261, 0.011),
    # The right wing, registered from the left by register_mirror (it sits 0.02 to 0.06 forward).
    'wingrootR': (-0.050, -0.398, 0.031),
    'wingelbowR': (-0.280, -0.407, 0.114),
    'wingwristR': (-0.416, -0.413, 0.235),
    'knuckleR': (-0.437, -0.409, 0.231),
    'f0midR': (-0.586, -0.387, 0.242),
    'f0tipR': (-0.933, -0.295, 0.193),
    'f1midR': (-0.627, -0.342, 0.175),
    'f1tipR': (-0.789, -0.280, 0.088),
    'f2midR': (-0.515, -0.349, 0.129),
    'f2tipR': (-0.570, -0.291, 0.002),
    'trailR': (-0.056, -0.263, 0.008),
}
NECK_POLY = [(0.000, -0.553, 0.075), (0.000, -0.561, 0.108), (0.000, -0.562, 0.142), (0.000, -0.564, 0.176),
             (0.000, -0.569, 0.209), (0.000, -0.580, 0.241), (0.000, -0.601, 0.268), (0.000, -0.630, 0.286)]
TAIL_POLY = [(0.000, -0.130, -0.040), (0.004, -0.051, -0.047), (0.013, 0.027, -0.058), (0.026, 0.104, -0.070),
             (0.045, 0.180, -0.083), (0.067, 0.255, -0.097), (0.093, 0.327, -0.113), (0.126, 0.397, -0.129),
             (0.166, 0.465, -0.144), (0.210, 0.529, -0.156), (0.259, 0.591, -0.165), (0.312, 0.649, -0.171),
             (0.370, 0.703, -0.172), (0.429, 0.755, -0.165)]
WING_POINTS = ['wingrootL', 'wingelbowL', 'wingwristL', 'knuckleL', 'f0midL', 'f0tipL', 'f1midL', 'f1tipL', 'f2midL', 'f2tipL', 'trailL']

AXIAL = ['snout', 'head'] + [f'neck{i}' for i in range(5, -1, -1)] + ['chest', 'root'] + [f'tail{i}' for i in range(10)] + ['tailtip']
WING_PREFIX = ('wingHumerus', 'wingForearm', 'wingHand', 'finger')
LIMB_PREFIX = ('scapula', 'humerus', 'forearm', 'forepaw', 'foretoes', 'thigh', 'shin', 'meta', 'toes')
TUBE = ('spine', 'chest', 'pelvis', 'neck', 'tail')     # the body tube: the shader's scale rows run along it
HEAD = ('head', 'jaw', 'gular', 'fan')
FOOT = ('forepaw', 'foretoes', 'meta', 'toes')
TANGENT_WINDOW = 0.45   # m: BodyPlan.station smooths its section frames over this (wyvern/rig.ts)
REGION = dict(skin=0, eye=2, claw=9)
MREGION_WING = 0


# --- helpers -------------------------------------------------------------------------------------

def to_blender(p):
    return np.array([p[0], -p[2], p[1]], float)


def to_game(a):
    a = np.atleast_2d(a)
    return np.c_[a[:, 0], a[:, 2], -a[:, 1]]


def mirror(p):
    return np.array([-p[0], p[1], p[2]], float)


def _select_only(obj):
    for o in bpy.context.selected_objects:
        o.select_set(False)
    obj.hide_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def _coll():
    c = bpy.data.collections.get(CFG['coll'])
    if c is None:
        c = bpy.data.collections.new(CFG['coll'])
        bpy.context.scene.collection.children.link(c)
    return c


def _replace(name, obj):
    old = bpy.data.objects.get(name)
    if old is not None and old is not obj:
        bpy.data.objects.remove(old, do_unlink=True)
    obj.name = name
    if obj.data is not None:
        obj.data.name = name
    if obj.name not in _coll().objects:
        _coll().objects.link(obj)
    return obj


def _co(obj):
    a = np.empty(len(obj.data.vertices) * 3)
    obj.data.vertices.foreach_get('co', a)
    a = a.reshape(-1, 3)
    m = np.array(obj.matrix_world)
    return a @ m[:3, :3].T + m[:3, 3]


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


def _polyline_at(poly, fractions):
    poly = np.asarray(poly, float)
    d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(poly, axis=0), axis=1))]
    return np.array([[np.interp(f * d[-1], d, poly[:, k]) for k in range(3)] for f in fractions])


def _frame(u, ref):
    """Orthonormal columns (u, v, w): u along the bone, w the reference direction made normal to u."""
    u = u / np.linalg.norm(u)
    w = ref - ref.dot(u) * u
    if np.linalg.norm(w) < 1e-6:
        alt = np.array([0, 0, 1.0]) if abs(u[2]) < 0.9 else np.array([0, 1.0, 0])
        w = alt - alt.dot(u) * u
    w /= np.linalg.norm(w)
    return np.array([u, np.cross(w, u), w]).T


def _smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


# --- skeleton ------------------------------------------------------------------------------------

def load_skeleton(path):
    with open(path) as f:
        sk = json.load(f)
    if sk.get('version') != 1:
        raise RuntimeError(f'unexpected skeleton version {sk.get("version")}')
    return sk


def build_rig(sk):
    """Dragon_Rig: the game skeleton in Blender, every bone at its bind pivot (rest = bind)."""
    old = bpy.data.objects.get(CFG['rig'])
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    ad = bpy.data.armatures.new(CFG['rig'])
    ad.display_type = 'STICK'
    rig = bpy.data.objects.new(CFG['rig'], ad)
    _coll().objects.link(rig)
    rig.show_in_front = True
    _select_only(rig)
    bpy.ops.object.mode_set(mode='EDIT')
    for b in sk['bones']:
        e = ad.edit_bones.new(b['name'])
        e.head, e.tail, e.roll = V(to_blender(b['head'])), V(to_blender(b['tail'])), 0
        e.use_deform = b['name'] in sk['segments']
    for b in sk['bones']:
        if b['parent']:
            ad.edit_bones[b['name']].parent = ad.edit_bones[b['parent']]
    bpy.ops.object.mode_set(mode='OBJECT')
    return rig


def game_points(sk):
    return {k: to_blender(v) for k, v in sk['points'].items()}


def meshy_points(sk):
    """The Meshy body's points under the skeleton's names: joints read directly, chains resampled at
    the game's own arc-length fractions, the root and chest placed as the rig places them."""
    G = game_points(sk)
    L = {k: np.array(v, float) for k, v in LANDMARKS.items()}
    M = {}
    for k, v in L.items():
        M[k] = v
        # The right side mirrors the left unless LANDMARKS records it (register_mirror).
        if k.endswith('L') and k[:-1] + 'R' not in L:
            M[k[:-1] + 'R'] = mirror(v)
    # Torso: the body center halfway from the chest front to the rump, at the same share of the
    # torso's depth above the belly as the rig's origin.
    tor = sk['torso']
    T = abs(L['chest_front'][1] - L['rump'][1])
    depth = L['torso_mid_top'][2] - L['torso_mid_bottom'][2]
    yc = 0.5 * (L['chest_front'][1] + L['rump'][1])
    zc = L['torso_mid_bottom'][2] + depth * tor['below'] / tor['depth']
    M['root'] = np.array([0, yc, zc])
    # The chest pivot: where the rig puts it from the origin, scaled by the torso's length and depth.
    d = G['chest'] - G['root']
    M['chest'] = M['root'] + np.array([0, d[1] * T / tor['length'], d[2] * depth / tor['depth']])
    # Neck and tail: the Meshy centre lines resampled at the game joints' arc-length fractions.
    names = [f'neck{i}' for i in range(6)] + ['head']
    gp = np.array([G[n] for n in names])
    gf = np.r_[0, np.cumsum(np.linalg.norm(np.diff(gp, axis=0), axis=1))]
    for n, p in zip(names, _polyline_at(NECK_POLY, gf / gf[-1])):
        M[n] = p
    names = [f'tail{i}' for i in range(10)] + ['tailtip']
    gp = np.array([G[n] for n in names])
    gf = np.r_[0, np.cumsum(np.linalg.norm(np.diff(gp, axis=0), axis=1))]
    for n, p in zip(names, _polyline_at(TAIL_POLY, gf / gf[-1])):
        M[n] = p
    return M


def _ref(bone, P, side):
    """Reference direction for a bone's frame: the wing plane's normal for wing bones, +X otherwise."""
    if bone.startswith(WING_PREFIX):
        a = P['wingroot' + side]
        n = np.cross(P['wingwrist' + side] - a, P['f2tip' + side] - P['wingwrist' + side])
        n /= np.linalg.norm(n)
        return n if n[2] >= 0 else -n
    return np.array([1.0, 0, 0])


def register_mirror(names, radius=0.04, iters=12):
    """Right-side landmarks for a body that isn't quite mirror-symmetric (the Meshy wings differ by
    0.02 to 0.05 units): each left point's neighbourhood of the raw mesh, mirrored, is aligned onto
    the right side by rigid ICP, and the mirrored point carried with it. Record the results in
    LANDMARKS (as ...R keys) so the fit itself stays deterministic."""
    raw = bpy.data.objects[CFG['raw']]
    co = _co(raw)
    right = co[co[:, 0] < 0]
    kd = mathutils.kdtree.KDTree(len(right))
    for i, p in enumerate(right):
        kd.insert(p, i)
    kd.balance()
    out = {}
    for n in names:
        p = np.array(LANDMARKS[n], float)
        src = co[np.linalg.norm(co - p, axis=1) < radius]
        src = src * np.array([-1, 1, 1])
        q = mirror(p)
        R, t = np.eye(3), np.zeros(3)
        for _ in range(iters):
            moved = src @ R.T + t
            dst = np.array([right[kd.find(v)[1]] for v in moved])
            mc, dc = moved.mean(0), dst.mean(0)
            U, _, Vt = np.linalg.svd((moved - mc).T @ (dst - dc))
            d = np.sign(np.linalg.det(Vt.T @ U.T))
            Ri = Vt.T @ np.diag([1, 1, d]) @ U.T
            R, t = Ri @ R, Ri @ (t - mc) + dc
        out[n[:-1] + 'R'] = np.round(R @ q + t, 4).tolist()
    return out


# --- clean and split -----------------------------------------------------------------------------

def clean(M):
    """Work copy of the raw body, split into the body (holes closed, decimated) and the two wings."""
    raw = bpy.data.objects[CFG['raw']]
    me = raw.data.copy()
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    isl = _islands(bm)
    bmesh.ops.delete(bm, geom=[v for i in isl[:-1] for v in i], context='VERTS')
    bm.verts.ensure_lookup_table()
    bm.normal_update()
    co = np.array([v.co[:] for v in bm.verts])
    thick = _thickness_bm(bm)
    edges = np.array([(e.verts[0].index, e.verts[1].index) for e in bm.edges])
    wing = wing_mask(co, thick, M, 0.0, edges)
    keep_wing = wing_mask(co, thick, M, -CFG['wing_overlap'], edges)
    # Wings: everything outside the cut, plus the overlap, as their own mesh.
    wm = bm.copy()
    wm.verts.ensure_lookup_table()
    bmesh.ops.delete(wm, geom=[wm.verts[i] for i in np.nonzero(~keep_wing)[0]], context='VERTS')
    wisl = _islands(wm)
    bmesh.ops.delete(wm, geom=[v for i in wisl if len(i) < 200 for v in i], context='VERTS')
    wme = bpy.data.meshes.new(CFG['wings'])
    wm.to_mesh(wme)
    wm.free()
    # Body: drop the wings, close the cut, then decimate (the Meshy body is closed and manifold, so it
    # needs no remesh: the claws and toes keep their shape).
    bmesh.ops.delete(bm, geom=[bm.verts[i] for i in np.nonzero(wing)[0]], context='VERTS')
    isl = _islands(bm)
    bmesh.ops.delete(bm, geom=[v for i in isl[:-1] for v in i], context='VERTS')
    _close_cut(bm)
    bm.to_mesh(me)
    bm.free()
    body = _replace(CFG['work'], bpy.data.objects.new(CFG['work'], me))
    wings = _replace(CFG['wings'] + '_Work', bpy.data.objects.new(CFG['wings'] + '_Work', wme))
    _decimate(body, CFG['body_tris'], symmetric=False)
    _decimate(wings, CFG['wing_tris'], symmetric=True)
    for o in (body, wings):
        for p in o.data.polygons:
            p.use_smooth = True
    return body, wings, int(keep_wing.sum())


def _clean_nonmanifold(bm):
    """Drop what the cut leaves pinched: loose vertices and wire edges, edges on more than two faces,
    and boundary vertices where two fans meet (holes_fill can't close around them)."""
    for _ in range(10):
        bad = {v for v in bm.verts if not v.link_faces or (not v.is_manifold and not (
            v.is_boundary and sum(1 for e in v.link_edges if e.is_boundary) == 2))}
        bad |= {v for e in bm.edges if e.is_wire or (not e.is_manifold and not e.is_boundary) for v in e.verts}
        if not bad:
            return
        bmesh.ops.delete(bm, geom=list(bad), context='VERTS')
        isl = _islands(bm)
        bmesh.ops.delete(bm, geom=[v for i in isl[:-1] for v in i], context='VERTS')


def _close_cut(bm, rounds=3, smooth=30):
    """Close the holes the wings leave in the body: fill, then subdivide the patch and relax it with
    its rim held, so it follows the flank's curve instead of lying flat across it."""
    _clean_nonmanifold(bm)
    rim = {v for e in bm.edges if e.is_boundary for v in e.verts}
    r = bmesh.ops.holes_fill(bm, edges=[e for e in bm.edges if e.is_boundary], sides=0)
    patch = set(bmesh.ops.triangulate(bm, faces=r['faces'])['faces'])
    inner = set()
    for _ in range(rounds):
        # Only the patch's own edges: the rim stays as it is.
        edges = {e for f in patch for e in f.edges if all(lf in patch for lf in e.link_faces)}
        res = bmesh.ops.subdivide_edges(bm, edges=list(edges), cuts=1, use_grid_fill=True)
        inner |= {v for v in res['geom_split'] + res['geom_inner'] if isinstance(v, bmesh.types.BMVert)}
        inner = {v for v in inner if v.is_valid}
        allowed = rim | inner
        patch = {f for f in bm.faces if all(v in allowed for v in f.verts)}
    for _ in range(smooth):
        bmesh.ops.smooth_vert(bm, verts=list(inner), factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3])
    bm.normal_update()
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return len(inner)


def wing_mask(co, thick, M, margin, edges):
    """Vertices of either wing, within the stretch of body from ahead of the root to just behind the
    wing's trailing edge: everything beyond a plane just outside the root (ahead of the membrane's
    trailing root, where only the arm and the spread wing reach that far out), and everything thin
    enough to be membrane wherever it meets the flank. The thighs are thick, so they stay body. Thin
    patches count only where they connect to the outer wing (the back plates have thin edges too)."""
    cand = np.zeros(len(co), bool)
    ax = np.abs(co[:, 0])
    for s in 'LR':
        root, trail = M['wingroot' + s], M['trail' + s]
        sx = np.sign(root[0])
        side = co[:, 0] * sx > 0
        y0 = min(root[1], M['wingelbow' + s][1], M['wingwrist' + s][1]) - 0.06
        y1 = max(trail[1], M['f2tip' + s][1], M['f1tip' + s][1], M['f0tip' + s][1]) + 0.03
        z0 = min(trail[2], root[2]) - CFG['wing_drop']
        zone = side & (co[:, 1] > y0) & (co[:, 1] < y1) & (co[:, 2] > z0)
        # The root joint sits inside the back: the cut stands just outside the flank's widest point
        # below the root, along the stretch ahead of the membrane's trailing root.
        flank = zone & (co[:, 1] < trail[1]) & (co[:, 2] < root[2] - 0.03) & (thick > 0.03)
        xcut = max(abs(root[0]), np.percentile(ax[flank], 99)) + CFG['wing_cut'] + margin
        beyond = (ax > xcut) & ((co[:, 1] < trail[1]) | (ax > CFG['wing_outer']))
        thin = (thick < CFG['split_thin']) & (ax > CFG['wing_inner'])
        cand |= zone & (beyond | thin)
    # Keep what the outer wings reach through candidate vertices.
    seed = cand & (ax > CFG['wing_outer'])
    e = edges[cand[edges[:, 0]] & cand[edges[:, 1]]]
    adj = {}
    for a, b in e:
        adj.setdefault(a, []).append(b)
        adj.setdefault(b, []).append(a)
    out = np.zeros(len(co), bool)
    stack = list(np.nonzero(seed)[0])
    out[stack] = True
    while stack:
        for n in adj.get(stack.pop(), ()):
            if not out[n]:
                out[n] = True
                stack.append(n)
    return out


def _decimate(obj, tris, symmetric):
    _select_only(obj)
    for _ in range(4):
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.triangulate(bm, faces=bm.faces)
        bm.to_mesh(obj.data)
        n = len(bm.faces)
        bm.free()
        if n <= tris * 1.02:
            break
        dc = obj.modifiers.new('Decimate', 'DECIMATE')
        dc.decimate_type, dc.ratio = 'COLLAPSE', tris / n
        dc.use_symmetry, dc.symmetry_axis = symmetric, 'X'
        bpy.ops.object.modifier_apply(modifier='Decimate')


# --- weights -------------------------------------------------------------------------------------

def fit_rig(body, sk, M):
    """FitRig: the game's weighted bones placed on the Meshy landmarks; bone-heat weights on the body."""
    old = bpy.data.objects.get(CFG['fit_rig'])
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    ad = bpy.data.armatures.new(CFG['fit_rig'])
    ad.display_type = 'STICK'
    fr = bpy.data.objects.new(CFG['fit_rig'], ad)
    _coll().objects.link(fr)
    fr.show_in_front = True
    _select_only(fr)
    bpy.ops.object.mode_set(mode='EDIT')
    parents = {b['name']: b['parent'] for b in sk['bones']}
    for n, (a, b) in sk['segments'].items():
        e = ad.edit_bones.new(n)
        e.head, e.tail, e.roll = V(M[a]), V(M[b]), 0
    for n in sk['segments']:
        p = parents[n]
        while p and p not in sk['segments']:
            p = parents[p]
        if p:
            ad.edit_bones[n].parent = ad.edit_bones[p]
    bpy.ops.object.mode_set(mode='OBJECT')
    body.vertex_groups.clear()
    for m in list(body.modifiers):
        body.modifiers.remove(m)
    body.parent = None
    _select_only(body)
    fr.select_set(True)
    bpy.context.view_layer.objects.active = fr
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    if not body.vertex_groups or body.parent != fr:
        raise RuntimeError('bone-heat weighting failed (is the work mesh visible and selectable?)')
    limit_influences(body)
    unweighted = sum(1 for v in body.data.vertices if not v.groups)
    return fr, unweighted


def limit_influences(obj, n=4):
    """Keep each vertex's n strongest weights, normalized: the game skins with four, so the conform
    must use the same four."""
    gname = {g.index: g for g in obj.vertex_groups}
    for v in obj.data.vertices:
        gs = sorted(((g.weight, g.group) for g in v.groups if g.weight > 1e-4), reverse=True)
        keep = gs[:n]
        drop = [gi for _, gi in gs[n:]] + [g.group for g in v.groups if g.weight <= 1e-4]
        for gi in drop:
            gname[gi].remove([v.index])
        s = sum(w for w, _ in keep)
        for w, gi in keep:
            gname[gi].add([v.index], w / s, 'REPLACE')


def _seg_dist(p, a, b):
    ab = b - a
    t = np.clip(((p - a) @ ab) / max(ab @ ab, 1e-12), 0, 1)
    return np.linalg.norm(p - (a + t[:, None] * ab), axis=1)


def wing_weights(wings, sk, M, power=4.0, eps=0.004):
    """Inverse-distance weights to the wing bones (and, along the flank, the spine), top four."""
    co = _co(wings)
    wings.vertex_groups.clear()
    out = []
    for s in 'LR':
        side = np.sign(M['wingroot' + s][0])
        sel = np.nonzero(np.sign(co[:, 0]) == side)[0]
        bones = [n for n in sk['segments'] if n.startswith(WING_PREFIX) and n.endswith(s)]
        segs = {n: (M[sk['segments'][n][0]], M[sk['segments'][n][1]]) for n in bones}
        # The membrane's inner edge rides the flank from the wing root back to its trailing root.
        segs['spine'] = (M['wingroot' + s], M['trail' + s])
        names = list(segs)
        D = np.array([_seg_dist(co[sel], *segs[n]) for n in names]).T
        Wt = 1.0 / (D + eps) ** power
        top = np.argsort(-Wt, axis=1)[:, :4]
        for row, vi in enumerate(sel):
            w = Wt[row, top[row]]
            w = w / w.sum()
            out.append((vi, [(names[j], float(x)) for j, x in zip(top[row], w) if x > 1e-3]))
    groups = {}
    for vi, ws in out:
        for n, w in ws:
            g = groups.get(n) or wings.vertex_groups.new(name=n)
            groups[n] = g
            g.add([int(vi)], w, 'REPLACE')
    return len(out)


def weights_matrix(obj, names):
    idx = {n: i for i, n in enumerate(names)}
    gname = {g.index: g.name for g in obj.vertex_groups}
    W = np.zeros((len(obj.data.vertices), len(names)))
    for v in obj.data.vertices:
        for g in v.groups:
            n = gname[g.group]
            if n in idx and g.weight > 1e-4:
                W[v.index, idx[n]] = g.weight
    return W


# --- map and conform -----------------------------------------------------------------------------

def envelopes(sk, M):
    """Per weighted bone: the Meshy segment's frame onto the game segment's, length to the game's,
    girth by the Meshy body's own shape at the fit's scale."""
    G = game_points(sk)
    seg = sk['segments']
    # Overall scale: the axial chain, snout to tail tip, game over Meshy.
    ga = sum(np.linalg.norm(G[AXIAL[i + 1]] - G[AXIAL[i]]) for i in range(len(AXIAL) - 1))
    ma = sum(np.linalg.norm(M[AXIAL[i + 1]] - M[AXIAL[i]]) for i in range(len(AXIAL) - 1))
    scale = ga / ma
    T = {}
    for b, (ka, kb) in seg.items():
        s = b[-1] if b.startswith(WING_PREFIX) else 'L'
        a, bb, A, B = M[ka], M[kb], G[ka], G[kb]
        lm, lg = np.linalg.norm(bb - a), np.linalg.norm(B - A)
        T[b] = dict(a=a, A=A, Fm=_frame(bb - a, _ref(b, M, s)), Fg=_frame(B - A, _ref(b, G, s)), ku=lg / lm)
    # Girth: the overall scale eased toward each bone's own stretch, smoothed along its chain. Wing
    # bones keep the overall scale across the membrane's plane (their length ratios vary too much).
    a = CFG['girth_stretch']
    chains = [['spine', 'chest'] + [f'neck{i}' for i in range(6)] + ['head'], ['pelvis'] + [f'tail{i}' for i in range(10)]]
    for s in 'LR':
        chains += [[f'scapula{s}', f'humerus{s}', f'forearm{s}', f'forepaw{s}', f'foretoes{s}'],
                   [f'thigh{s}', f'shin{s}', f'meta{s}', f'toes{s}']]
    for b in T:
        T[b]['k'] = scale if b.startswith(WING_PREFIX) else scale ** (1 - a) * T[b]['ku'] ** a
    for ch in chains:
        k = np.array([T[b]['k'] for b in ch])
        sm = k.copy()
        for i in range(len(ch)):
            sm[i] = 0.25 * k[max(i - 1, 0)] + 0.5 * k[i] + 0.25 * k[min(i + 1, len(ch) - 1)]
        for b, v in zip(ch, sm):
            T[b]['k'] = float(v)
    return T, scale


def conform(obj, T, names, out_name):
    """Each vertex = the weighted blend of its bones' maps (linear blend in rest): the body in the
    game's bind space, carrying the same weights."""
    co = _co(obj)
    W = weights_matrix(obj, names)
    acc = np.zeros_like(co)
    tw = W.sum(1)
    for j, b in enumerate(names):
        w = W[:, j]
        sel = np.nonzero(w > 0)[0]
        if not len(sel):
            continue
        t = T[b]
        q = (co[sel] - t['a']) @ t['Fm']
        q = q * np.array([t['ku'], t['k'], t['k']])
        acc[sel] += w[sel, None] * (t['A'] + q @ t['Fg'].T)
    if (tw <= 0).any():
        raise RuntimeError(f'{out_name}: {(tw <= 0).sum()} vertices carry no weight on a fitted bone')
    out = acc / tw[:, None]
    me = obj.data.copy()
    me.vertices.foreach_set('co', out.ravel())
    me.update()
    nb = _replace(out_name, bpy.data.objects.new(out_name, me))
    nb.vertex_groups.clear()
    for n in names:
        nb.vertex_groups.new(name=n)
    gname = {g.index: g.name for g in obj.vertex_groups}
    for v in obj.data.vertices:
        for g in v.groups:
            if gname[g.group] in names:
                nb.vertex_groups[gname[g.group]].add([v.index], g.weight, 'REPLACE')
    rig = bpy.data.objects[CFG['rig']]
    nb.parent = rig
    nb.matrix_parent_inverse = rig.matrix_world.inverted()
    nb.modifiers.new('Armature', 'ARMATURE').object = rig
    for p in me.polygons:
        p.use_smooth = True
    return nb


# --- shader attributes ---------------------------------------------------------------------------

def _texture_sampler():
    """Base colour of the textured Meshy download at the nearest surface point (sRGB, 0..1)."""
    tex = bpy.data.objects[CFG['tex']]
    me = tex.data
    img = next(n.image for n in me.materials[0].node_tree.nodes if n.type == 'TEX_IMAGE' and n.image)
    w, h = img.size
    px = np.empty(w * h * 4, np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(h, w, 4)
    tco = _co(tex)
    polys = [list(p.vertices) for p in me.polygons]
    loops = [list(p.loop_indices) for p in me.polygons]
    uv = np.empty(len(me.loops) * 2)
    me.uv_layers.active.data.foreach_get('uv', uv)
    uv = uv.reshape(-1, 2)
    bvh = mathutils.bvhtree.BVHTree.FromPolygons([V(c) for c in tco], polys)

    def sample(p):
        hit = bvh.find_nearest(V(p))
        f = hit[2]
        a, b, c = (V(tco[i]) for i in polys[f][:3])
        la, lb, lc = loops[f][:3]
        q = mathutils.geometry.barycentric_transform(hit[0], a, b, c, V((*uv[la], 0)), V((*uv[lb], 0)), V((*uv[lc], 0)))
        x = int(np.clip(q[0], 0, 1) * (w - 1))
        y = int(np.clip(q[1], 0, 1) * (h - 1))
        return px[y, x, :3]
    return sample


def _plan_frame(sk, pg):
    """Arc length s along the body plan and girth angle theta (0 on the back, +pi/2 on the left flank)
    for each point (game space). Points are projected onto the plan's centre line between stations,
    and the section frames are smoothed over the same window BodyPlan.station uses."""
    st = sk['plan']
    C = np.array([s['center'] for s in st])
    S = np.array([s['s'] for s in st])

    def at(s):
        return np.stack([np.interp(s, S, C[:, k]) for k in range(3)], -1)
    tang = at(np.minimum(S + TANGENT_WINDOW, S[-1])) - at(np.maximum(S - TANGENT_WINDOW, 0))
    tang /= np.linalg.norm(tang, axis=1, keepdims=True)
    side = np.array([1.0, 0, 0])
    up = np.cross(side, tang)
    up /= np.linalg.norm(up, axis=1, keepdims=True)
    # Project onto the centre line between the nearest station and the better of its neighbours, so
    # s runs continuously (the shader draws scale rows along it) rather than in station steps.
    n = len(C)
    i = np.argmin(((pg[:, None, :] - C[None]) ** 2).sum(2), axis=1)
    best = None
    for a, b in ((np.maximum(i - 1, 0), i), (i, np.minimum(i + 1, n - 1))):
        ab = C[b] - C[a]
        L2 = np.maximum((ab * ab).sum(1), 1e-12)
        t = np.clip(((pg - C[a]) * ab).sum(1) / L2, 0, 1)
        q = C[a] + t[:, None] * ab
        dist = np.linalg.norm(pg - q, axis=1)
        cand = (dist, a, b, t, q)
        if best is None:
            best = cand
        else:
            pick = dist < best[0]
            best = tuple(np.where(pick[:, None] if x.ndim == 2 else pick, x, y) for x, y in zip(cand, best))
    _, a, b, t, q = best
    s = S[a] + t * (S[b] - S[a])
    u = up[a] + t[:, None] * (up[b] - up[a])
    u /= np.linalg.norm(u, axis=1, keepdims=True)
    d = pg - q
    th = np.arctan2(d @ side, (d * u).sum(1))
    return s, th


def _dominant_bones(obj):
    names = [g.name for g in obj.vertex_groups]
    return np.array(names)[weights_matrix(obj, names).argmax(1)]


def _chain_uv(pg, dom, sk, G):
    """For limb and wing vertices (game space, Blender frame): distance along the limb's chain from its
    top (u) and which side of the bone the point is (out: lateral for legs, up for wings, -1..1)."""
    seg = sk['segments']
    length = {b: float(np.linalg.norm(G[c] - G[a])) for b, (a, c) in seg.items()}
    off = {}
    for s in 'LR':
        for chain in (['scapula', 'humerus', 'forearm', 'forepaw', 'foretoes'], ['thigh', 'shin', 'meta', 'toes'],
                      ['wingHumerus', 'wingForearm', 'wingHand']):
            acc = 0.0
            for b in chain:
                off[b + s] = acc
                acc += length[b + s]
        knuckle = off['wingHand' + s] + length['wingHand' + s]
        for k in range(3):
            off[f'finger{k}a{s}'] = knuckle
            off[f'finger{k}b{s}'] = knuckle + length[f'finger{k}a{s}']
    u = np.zeros(len(pg))
    out = np.zeros(len(pg))
    for b in set(dom) & set(off):
        sel = dom == b
        a, c = G[seg[b][0]], G[seg[b][1]]
        ab = c - a
        t = np.clip(((pg[sel] - a) @ ab) / max(ab @ ab, 1e-12), 0, 1)
        d = pg[sel] - (a + t[:, None] * ab)
        r = np.maximum(np.linalg.norm(d, axis=1), 1e-9)
        u[sel] = off[b] + t * length[b]
        # Legs: outward is the creature's own side (+x left); wings: up (Blender +z).
        out[sel] = (d[:, 2] if b.startswith(WING_PREFIX) else d[:, 0] * np.sign(a[0] or 1)) / r
    return u, out


def bake_body_attrs(nb, src, sk, M):
    """The wyvern's hide conventions (builder.ts, body.ts, legs.ts, wings.ts), by the part each vertex
    rides on. aMat = (region, belly, dorsal, girth angle on the tube only); aUv2 = the tube's (arc
    length, sin theta), a leg's (4 + distance down the leg, outward), the wing stub's (20 + distance
    out the arm, up), the head's (0, 0); aExtra (1, 0, 0, 0)."""
    sample = _texture_sampler()
    mco = _co(src)                      # Meshy positions, for the colour lookup
    gb = _co(nb)                        # Blender frame, game scale
    gco = to_game(gb)                   # game frame, for the body plan
    rgb = np.array([sample(p) for p in mco])
    blue = rgb[:, 2] - rgb[:, 0]
    luma = rgb @ np.array([0.299, 0.587, 0.114])
    s, th = _plan_frame(sk, gco)
    c = np.cos(th)
    dom = _dominant_bones(nb)
    tube = np.array([d.startswith(TUBE) for d in dom])
    head = np.array([d.startswith(HEAD) for d in dom])
    limb = np.array([d.startswith(LIMB_PREFIX) for d in dom])
    wing = np.array([d.startswith(WING_PREFIX) for d in dom])
    foot = np.array([d.startswith(FOOT) for d in dom])
    region = np.full(len(gco), REGION['skin'], float)
    # Slate claws only on the feet: the texture has dark patches elsewhere too.
    region[foot & (luma < 0.42)] = REGION['claw']
    for e in ('eyeL', 'eyeR'):
        near = np.linalg.norm(mco - M[e], axis=1) < 0.012
        region[head & near & (blue > 0.08)] = REGION['eye']
    belly = np.where(tube, _smoothstep(-0.25, -0.72, c), 0.0)
    dorsal = _smoothstep(0.03, 0.14, blue)
    dorsal[region != REGION['skin']] = 0
    around = np.where(tube, 2 + th / np.pi, 0.0)
    G = game_points(sk)
    u, out = _chain_uv(gb, dom, sk, G)
    uv = np.c_[np.where(tube, s, 0.0), np.where(tube, np.sin(th), 0.0)]
    uv[limb] = np.c_[4 + u[limb], out[limb]]
    uv[wing] = np.c_[20 + u[wing], out[wing]]
    _put(nb, '_AMAT', np.c_[region, belly, dorsal, around])
    _put(nb, '_AUV2', uv)
    _put(nb, '_AEXTRA', np.tile([1.0, 0, 0, 0], (len(gco), 1)))
    return dict(claw=int((region == REGION['claw']).sum()), eye=int((region == REGION['eye']).sum()),
                dorsal=float((dorsal > 0.5).mean()), belly=float((belly > 0.5).mean()),
                tube=int(tube.sum()), limb=int(limb.sum()), head=int(head.sum()), wing_stub=int(wing.sum()))


def _panel_v(p, G, s):
    """The wyvern membrane's across-panel coordinate (wings.ts): 0 on the leading finger, 1 on the
    next, 2 on the innermost, and the inner panel 2 at the arm to 3 at the flank. Angles are taken
    about the wrist from the leading finger, all the way round, so the branch cut falls ahead of the
    arm, outside the membrane; the inner panel's angle is taken about the wing root."""
    side = np.sign(G['wingroot' + s][0])
    wr, root = G['wingwrist' + s], G['wingroot' + s]
    a0 = G['f0tip' + s] - wr

    def ang(d):
        return np.mod(np.arctan2(np.cross(a0, d)[..., 2] * side, d @ a0), 2 * np.pi)
    a1 = ang(G['f1tip' + s] - wr)
    a2 = ang(G['f2tip' + s] - wr)
    arm = ang(root - wr)
    q = ang(p - wr)
    v = np.where(q <= a1, q / a1, 1 + (q - a1) / (a2 - a1))
    # Behind the innermost finger, or inboard of the wrist: the inner panel, by the angle about the
    # root from the arm toward the membrane's trailing root on the flank.
    arm_dir, trail_dir = wr - root, G['trail' + s] - root

    def between(u, w):
        cu = (u @ w) / (np.linalg.norm(u, axis=-1) * np.linalg.norm(w) + 1e-12)
        return np.arccos(np.clip(cu, -1, 1))
    inner = (q > a2) & (q <= arm + 0.5 * (2 * np.pi - arm))
    phi = between(p - root, arm_dir) / between(trail_dir[None], arm_dir)[0]
    v = np.where(inner, 2 + np.clip(phi, 0, 1), v)
    # Ahead of the leading finger (the far side of the cut): the leading edge.
    v = np.where(q > arm + 0.5 * (2 * np.pi - arm), 0.0, v)
    return v


def bake_wing_attrs(nb, src, sk, M):
    """Two readings of every wing vertex, as the export may use it in either primitive. As hide (the
    bone spars and their flesh): the wyvern arm's (region, belly 0, dorsal from the bone colour, 0) and
    (20 + distance out the arm, up). As membrane: (MREGION wing, thin: 0 at the bones to 1 mid-panel,
    edge, flutter) and (along the span, across the panels: wings.ts's 0..3)."""
    sample = _texture_sampler()
    mco = _co(src)
    # Spars are the bones' own flesh: close to a wing bone's line on the Meshy body. Thickness won't
    # do once the wing is decimated (the membrane comes out about as thick as the finger bones).
    memb = np.ones(len(mco), bool)
    for s in 'LR':
        for b in [n for n in sk['segments'] if n.startswith(WING_PREFIX) and n.endswith(s)]:
            r = CFG['spar_finger'] if b.startswith('finger') else CFG['spar_arm']
            memb &= _seg_dist(mco, M[sk['segments'][b][0]], M[sk['segments'][b][1]]) > r
    rgb = np.array([sample(p) for p in mco])
    blue = rgb[:, 2] - rgb[:, 0]
    luma = rgb @ np.array([0.299, 0.587, 0.114])
    G = game_points(sk)
    gco = _co(nb)
    n = len(gco)
    t = np.zeros(n)
    v = np.zeros(n)
    far = np.zeros(n)
    for s in 'LR':
        sel = np.sign(gco[:, 0]) == np.sign(G['wingroot' + s][0])
        root, tip = G['wingroot' + s], G['f0tip' + s]
        span = tip - root
        t[sel] = np.clip(((gco[sel] - root) @ span) / (span @ span), 0, 1)
        v[sel] = _panel_v(gco[sel], G, s)
        bones = [k for k in sk['segments'] if k.startswith(WING_PREFIX) and k.endswith(s)]
        far[sel] = np.min([_seg_dist(gco[sel], G[sk['segments'][k][0]], G[sk['segments'][k][1]]) for k in bones], axis=0)
    thin = np.clip(far / np.percentile(far[memb], 95), 0, 1) if memb.any() else far
    dom = _dominant_bones(nb)
    u, up = _chain_uv(gco, dom, sk, G)
    tipward = np.array([d.startswith(('wingHand', 'finger0b', 'finger1b', 'finger2b')) for d in dom])
    hide_region = np.where(tipward & (luma < 0.42), REGION['claw'], REGION['skin']).astype(float)
    hide_dorsal = np.where(hide_region == REGION['skin'], _smoothstep(0.03, 0.14, blue), 0.0)
    _put(nb, '_AMAT', np.c_[hide_region, np.zeros(n), hide_dorsal, np.zeros(n)])
    _put(nb, '_AUV2', np.c_[20 + u, up])
    _put(nb, '_AMAT_M', np.c_[np.full(n, float(MREGION_WING)), thin, thin ** 2, 0.6 * thin * thin])
    _put(nb, '_AUV2_M', np.c_[t, v])
    _put(nb, '_AEXTRA', np.tile([1.0, 0, 0, 0], (n, 1)))
    nb['membrane_mask'] = json.dumps(np.nonzero(memb)[0].tolist())
    return dict(membrane_verts=int(memb.sum()), spar_verts=int((~memb).sum()),
                claw=int((hide_region == REGION['claw']).sum()),
                v_at_3=float((np.abs(v[memb] - 3) < 1e-6).mean()) if memb.any() else 0.0)


def _thickness_bm(bm):
    """Per vertex: distance to the far side along the inward normal (1.0 where the ray escapes)."""
    bm.verts.index_update()
    bvh = mathutils.bvhtree.BVHTree.FromBMesh(bm)
    th = np.full(len(bm.verts), 1.0)
    for v in bm.verts:
        n = v.normal
        if n.length < 1e-6:
            continue
        hit = bvh.ray_cast(v.co - n * 1e-5, -n, 0.2)
        if hit[0] is not None:
            th[v.index] = hit[3]
    return th


def _put(obj, name, vals):
    me = obj.data
    if name in me.attributes:
        me.attributes.remove(me.attributes[name])
    typ = 'FLOAT2' if vals.shape[1] == 2 else 'FLOAT_COLOR'
    at = me.attributes.new(name, typ, 'POINT')
    at.data.foreach_set('vector' if typ == 'FLOAT2' else 'color', np.asarray(vals, np.float32).ravel())


# --- report and export ---------------------------------------------------------------------------

def report(objs, sk):
    names = [b['name'] for b in sk['bones']]
    out = {}
    for o in objs:
        W = weights_matrix(o, names)
        nz = (W > 1e-4).sum(1)
        g = to_game(_co(o))
        out[o.name] = dict(
            verts=len(o.data.vertices), tris=sum(len(p.vertices) - 2 for p in o.data.polygons),
            unweighted=int((nz == 0).sum()), over_four=int((nz > 4).sum()),
            bbox_min=g.min(0).round(3).tolist(), bbox_max=g.max(0).round(3).tolist())
    return out


def export_glb(path, sk, provenance=None, fit=None):
    """The fitted dragon as a GLB in the game's bind space: one vertex buffer, two primitives
    (0 body and wing bones, opaque; 1 membranes). JOINTS_0/WEIGHTS_0 index mesh.extras.jointNames (all
    the skeleton's bones, in its order; no glTF skin: the game binds by name to its own rig).

    A wing vertex used by both primitives is written twice, once with its hide reading and once with
    its membrane reading (bake_wing_attrs), so each shader sees its own channels. Every hide triangle
    is a single region: a corner whose region differs from the triangle's majority is written again
    with the triangle's region, as the wyvern builder splits its triangles (aMat.x is a flat varying)."""
    body, wings = bpy.data.objects[CFG['body']], bpy.data.objects[CFG['wings']]
    joint_names = [b['name'] for b in sk['bones']]
    jidx = {n: i for i, n in enumerate(joint_names)}
    P, N, J, W, A, U, E, I0, I1 = [], [], [], [], [], [], [], [], []
    for obj in (body, wings):
        me = obj.data
        co = to_game(_co(obj))
        nr = to_game(np.array([(obj.matrix_world.to_3x3() @ v.normal)[:] for v in me.vertices]))
        nr /= np.maximum(np.linalg.norm(nr, axis=1, keepdims=True), 1e-9)
        gname = {g.index: g.name for g in obj.vertex_groups}
        jj = np.zeros((len(co), 4), np.uint16)
        ww = np.zeros((len(co), 4), np.float32)
        for v in me.vertices:
            gs = sorted(((g.weight, gname[g.group]) for g in v.groups if gname[g.group] in jidx and g.weight > 1e-4), reverse=True)[:4]
            s = sum(x for x, _ in gs) or 1.0
            for k, (wt, nm) in enumerate(gs):
                jj[v.index, k] = jidx[nm]
                ww[v.index, k] = wt / s
        read = lambda name, key: np.array([getattr(d, key)[:] for d in me.attributes[name].data], np.float32)
        hide = (read('_AMAT', 'color'), read('_AUV2', 'vector'))
        membrane = (read('_AMAT_M', 'color'), read('_AUV2_M', 'vector')) if '_AMAT_M' in me.attributes else None
        ex = read('_AEXTRA', 'color')
        memb = set(json.loads(obj.get('membrane_mask', '[]')))
        made = {}

        def emit(i, reading, region=None):
            key = (i, reading, region)
            if key not in made:
                mat, uv = (membrane if reading == 'm' else hide)
                m = mat[i].copy()
                if region is not None:
                    m[0] = region
                made[key] = len(P)
                P.append(co[i]), N.append(nr[i]), J.append(jj[i]), W.append(ww[i]), A.append(m), U.append(uv[i]), E.append(ex[i])
            return made[key]

        for p in me.polygons:
            vs = list(p.vertices)
            for t in range(1, len(vs) - 1):
                tri = (vs[0], vs[t], vs[t + 1])
                if membrane is not None and sum(i in memb for i in tri) * 2 > 3:
                    I1.append([emit(i, 'm') for i in tri])
                    continue
                regions = [float(hide[0][i][0]) for i in tri]
                major = max(set(regions), key=lambda r: (regions.count(r), r == REGION['skin']))
                I0.append([emit(i, 'h', None if regions[k] == major else major) for k, i in enumerate(tri)])
    P, N, J, W = np.array(P, np.float32), np.array(N, np.float32), np.array(J, np.uint16), np.array(W, np.float32)
    A, U, E = np.array(A, np.float32), np.array(U, np.float32), np.array(E, np.float32)
    I0, I1 = np.array(I0, np.uint32).ravel(), np.array(I1, np.uint32).ravel()
    extras = dict(jointNames=joint_names, provenance=provenance or {}, fit=fit or {})
    blobs, views, accs = [], [], []

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
    attrs = dict(POSITION=add(P, F, 'VEC3', 34962, True), NORMAL=add(N, F, 'VEC3', 34962),
                 JOINTS_0=add(J, U16, 'VEC4', 34962), WEIGHTS_0=add(W, F, 'VEC4', 34962),
                 _AMAT=add(A, F, 'VEC4', 34962), _AUV2=add(U, F, 'VEC2', 34962), _AEXTRA=add(E, F, 'VEC4', 34962))
    prims = [dict(attributes=attrs, indices=add(I0.reshape(-1, 1), U32, 'SCALAR', 34963), material=0),
             dict(attributes=attrs, indices=add(I1.reshape(-1, 1), U32, 'SCALAR', 34963), material=1)]
    binary = b''.join(blobs)
    gltf = dict(asset=dict(version='2.0', generator='havens dragon_meshy_fit.py'),
                scene=0, scenes=[dict(nodes=[0])], nodes=[dict(name='WhiteDragon', mesh=0)],
                meshes=[dict(name='WhiteDragon', primitives=prims, extras=extras)],
                materials=[dict(name='body'), dict(name='membrane', doubleSided=True)],
                buffers=[dict(byteLength=len(binary))], bufferViews=views, accessors=accs)
    js = json.dumps(gltf, separators=(',', ':')).encode()
    js += b' ' * ((-len(js)) % 4)
    out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(binary))
    out += struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(binary), 0x004E4942) + binary
    with open(path, 'wb') as f:
        f.write(out)
    return dict(path=path, bytes=len(out), verts=int(len(P)), body_tris=int(len(I0) // 3), membrane_tris=int(len(I1) // 3))


# --- the whole fit -------------------------------------------------------------------------------

def run_all(skeleton_path):
    sk = load_skeleton(skeleton_path)
    build_rig(sk)
    M = meshy_points(sk)
    bpy.data.objects[CFG['raw']]['fit_landmarks'] = json.dumps({k: np.round(v, 4).tolist() for k, v in M.items()})
    work, wings_work, overlap = clean(M)
    fr, unweighted = fit_rig(work, sk, M)
    n_wing = wing_weights(wings_work, sk, M)
    T, scale = envelopes(sk, M)
    names = list(sk['segments'])
    body = conform(work, T, names, CFG['body'])
    wings = conform(wings_work, T, names, CFG['wings'])
    battrs = bake_body_attrs(body, work, sk, M)
    wattrs = bake_wing_attrs(wings, wings_work, sk, M)
    for o in (work, wings_work, fr):
        o.hide_set(True)
    return dict(scale=round(scale, 3), heat_unweighted=unweighted, wing_weighted=n_wing,
                body=battrs, wings=wattrs, mesh=report([body, wings], sk),
                k={b: [round(T[b]['ku'], 2), round(T[b]['k'], 2)] for b in T})
