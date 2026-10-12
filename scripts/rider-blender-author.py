"""Run with portable Blender --background --factory-startup --python this-file.

Editable cages and authored surfaces are separate collections. Exports are uncompressed,
metre-scale glTF 2 with named canonical joints and the existing painterly/dye contract.
No Blender shader graph or animation is imported into the game.
"""
import bpy, bmesh, json, pathlib, math, struct, hashlib, copy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=pathlib.Path(__file__).resolve().parents[1]
SRC=ROOT/'assets/rider-blender/source'
data=json.loads((SRC/'FITTING_CAGES.json').read_text())
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.context.scene.unit_settings.system='METRIC'
bpy.context.scene.unit_settings.scale_length=1
bpy.context.scene.render.engine='BLENDER_EEVEE_NEXT'
bpy.context.scene.world.color=(.22,.27,.33)
originals=bpy.data.collections.new('Measured fitting sources - preserved');bpy.context.scene.collection.children.link(originals)
authored=bpy.data.collections.new('Authored trial - edit these meshes');bpy.context.scene.collection.children.link(authored)
originals.hide_render=True;originals.hide_viewport=True
to_blender=lambda p:(p[0],-p[2],p[1])
to_engine=lambda p:Vector((p[0],p[2],-p[1]))
rigs={r['build']:r for r in data['rigs']}
materials=[]
for name,color in [('neutral',(.72,.48,.31,1)),('linen',(.88,.84,.73,1)),('scale',(.09,.18,.25,1)),('leather',(.24,.12,.055,1)),('bronze',(.39,.25,.11,1))]:
 m=bpy.data.materials.new('Runtime surface: '+name);m.diffuse_color=color;m.use_nodes=True
 node=m.node_tree.nodes.new('ShaderNodeVertexColor');node.layer_name='Dye preview';m.node_tree.links.new(node.outputs['Color'],m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
 m.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.82
 materials.append(m)

def mesh_object(name,positions,indices,collection):
 mesh=bpy.data.meshes.new(name);mesh.from_pydata([to_blender(p) for p in positions],[],[indices[i:i+3] for i in range(0,len(indices),3)]);mesh.update()
 obj=bpy.data.objects.new(name,mesh);collection.objects.link(obj)
 for p in mesh.polygons:p.use_smooth=True
 for m in materials:mesh.materials.append(m)
 return obj

def components(mesh):
 adj=[set() for _ in mesh.vertices]
 for e in mesh.edges:a,b=e.vertices;adj[a].add(b);adj[b].add(a)
 seen=set();parts=[]
 for i in range(len(adj)):
  if i in seen:continue
  todo=[i];seen.add(i);group=[]
  while todo:
   v=todo.pop();group.append(v)
   for q in adj[v]:
    if q not in seen:seen.add(q);todo.append(q)
  parts.append(group)
 return parts,adj

def apply_modifier(obj,kind,**settings):
 bpy.context.view_layer.objects.active=obj;obj.select_set(True)
 mod=obj.modifiers.new(kind,kind)
 for k,v in settings.items():setattr(mod,k,v)
 bpy.ops.object.modifier_apply(modifier=mod.name);obj.select_set(False)

def sphere(name,center,radii):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=10,location=to_blender(center))
 obj=bpy.context.object;obj.name=name;obj.scale=(radii[0],radii[2],radii[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 return obj

def connected_hand(side,rig):
 bones={b['name']:Vector(b['bind']) for b in rig['bones']};suffix='L' if side==1 else 'R';w=bones['hand'+suffix];k=bones['fingers'+suffix]
 objects=[sphere('Palm',w+Vector((0,-.043,.004)),(.020,.053,.040))]
 # Four fingers share the existing two finger joints; their silhouette and webbing are authored.
 for i,(z,length) in enumerate([(-.028,.066),(-.009,.074),(.010,.078),(.029,.067)]):
  objects.append(sphere('Finger '+str(i),Vector((w.x,k.y-length*.43,w.z+z)),(.0105,length*.60,.0093)))
 t=bones['thumb'+suffix];direction=Vector((-side*.35,-.72,.6)).normalized()
 thumb=sphere('Thumb',t+direction*.020,(.014,.042,.014));objects.append(thumb)
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();obj=bpy.context.object
 # Voxel union makes palm, webbing and thumb one connected surface. Keep a readable 1.5 mm web.
 apply_modifier(obj,'REMESH',mode='VOXEL',voxel_size=.0018,use_smooth_shade=True)
 apply_modifier(obj,'SMOOTH',factor=.24,iterations=2)
 apply_modifier(obj,'DECIMATE',ratio=.055)
 # Retain the original arm-to-wrist width and overlap; no rig or IK contact moves.
 for v in obj.data.vertices:
  p=to_engine(obj.matrix_world@v.co)
  if p.y>w.y-.014:
   t0=max(0,min(1,(p.y-(w.y-.014))/.014));p.y=min(p.y,w.y+.001)
   p.x=w.x+(p.x-w.x)*(1-.12*t0);v.co=obj.matrix_world.inverted()@Vector(to_blender(p))
 # Bake object translation into vertices for the canonical bind-space exporter.
 bpy.context.view_layer.objects.active=obj;obj.select_set(True);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);obj.select_set(False)
 for col in list(obj.users_collection):col.objects.unlink(obj)
 authored.objects.link(obj);return obj

def connected_foot(obj,side,rig):
 ankle=Vector(next(b['bind'] for b in rig['bones'] if b['name']=='foot'+('L' if side==1 else 'R')))
 for v in obj.data.vertices:
  p=to_engine(v.co)
  if p.z>.135:p.z=.135+(p.z-.135)*.13
  v.co=to_blender(p)
 digits=[]
 for lateral,length,width in [(-.032,.035,.012),(-.012,.032,.010),(.006,.029,.009),(.023,.025,.008),(.036,.020,.007)]:
  digits.append(sphere('Toe',Vector((ankle.x+side*lateral-.003,.030,.160)),(width,.024,length)))
 bpy.ops.object.select_all(action='DESELECT');obj.select_set(True)
 for o in digits:o.select_set(True)
 bpy.context.view_layer.objects.active=obj;bpy.ops.object.join()
 apply_modifier(obj,'REMESH',mode='VOXEL',voxel_size=.002,use_smooth_shade=True);apply_modifier(obj,'SMOOTH',factor=.16,iterations=1);apply_modifier(obj,'DECIMATE',ratio=.025)
 for v in obj.data.vertices:
  p=to_engine(v.co)
  if p.y<.011:p.y=0
  v.co=to_blender(p)
 return obj

def barycentric(p,a,b,c):
 v0=b-a;v1=c-a;v2=p-a;d00=v0.dot(v0);d01=v0.dot(v1);d11=v1.dot(v1);d20=v2.dot(v0);d21=v2.dot(v1);den=d00*d11-d01*d01
 if abs(den)<1e-18:return [1.,0.,0.]
 v=(d11*d20-d01*d21)/den;w=(d00*d21-d01*d20)/den
 ws=[max(0,min(1,x)) for x in [1-v-w,v,w]];s=sum(ws);return [x/s for x in ws]
def frame(a,b,c):
 u=(b-a).normalized();n=(b-a).cross(c-a).normalized();v=n.cross(u);return u,v,n
def fnv(words):
 h=2166136261
 for x in words:h=((h^(int(x)&0xffffffff))*16777619)&0xffffffff
 return format(h,'08x')
def topo(pos,indices):
 # JavaScript Math.round, including negative halves.
 return fnv([len(pos),len(indices)]+[math.floor(float(c)*1e6+.5) for p in pos for c in p]+indices)
def layout(pos,indices):return fnv([len(pos),len(indices)]+indices)

import importlib.util
module_spec=importlib.util.spec_from_file_location('driftwing_export',ROOT/'scripts/rider-blender-export.py');exp=importlib.util.module_from_spec(module_spec);module_spec.loader.exec_module(exp)
records=[];objects=[]
for source in data['parts']:
 part=copy.deepcopy(source);name=part['build']+' / '+part['id'];cloth=part['method']=='cloth'
 print('Authoring '+name,flush=True)
 if cloth:
  positions=[Vector(part['positions'][i:i+3]) for i in range(0,len(part['positions']),3)];indices=[];cols=part['cols'];rows=part['rows']
  for j in range(rows-1):
   for i in range(cols-1):a=j*cols+i;indices += [a,a+1,a+cols,a+1,a+cols+1,a+cols]
 else:
  attrs=part['attributes'];positions=[Vector(attrs['position']['values'][i:i+3]) for i in range(0,len(attrs['position']['values']),3)];indices=part['indices']
 ref=mesh_object('SOURCE / '+name,positions,indices,originals);obj=mesh_object(name,positions,indices,authored)
 obj['driftwing_part']=part['id'];obj['build']=part['build'];obj['method']=part['method'];obj['source_layout']=layout(positions,indices)
 groups,adj=components(obj.data);id=part['id'];h=rigs[part['build']]['dims']['h']
 if id=='head':
  biggest=max(groups,key=len)
  if set(biggest)!=set(range(590)):raise RuntimeError('Head construction source changed; remeasure its skin grid')
  obj['dw_skin_source_vertices']=sorted(biggest)
  # C02 adult face: connected cheek/jaw/chin planes authored against the current
  # head frame. Preserve the upper cranium for every existing hair/headgear fit.
  center=Vector(next(b['bind'] for b in rigs[part['build']]['bones'] if b['name']=='head'))+Vector((0,.1*h,.016))
  profile=[[-.127,0,.030,0],[-.120,.026,.060,.024],[-.110,.046,.076,.044],[-.096,.070,.082,.060],[-.080,.076,.089,.075],[-.055,.080,.087,.092],[-.025,.090,.087,.107],[0,.095,.082,.112],[.04,.090,.085,.109],[.08,.070,.071,.078],[.127,0,0,0]]
  def section(y):
   q=max(profile[0][0],min(profile[-1][0],y-center.y))
   for a,c in zip(profile,profile[1:]):
    if a[0]<=q<=c[0]:
     t=(q-a[0])/(c[0]-a[0]);return [a[j]*(1-t)+c[j]*t for j in range(1,4)]
   return profile[-1][1:]
  def relief(x,y):
   return (.011*math.exp(-(x/.012)**2-((y-(center.y-.020))/.034)**4)
    +.018*math.exp(-((x/.016)**2+((y-(center.y-.047))/.015)**2))
    +.004*sum(math.exp(-(((x-sign*.055)/.024)**2+((y-(center.y-.023))/.022)**2)) for sign in [1,-1])
    -.0035*sum(math.exp(-(((x-sign*.036)/.019)**2+((y-(center.y-.005))/.012)**2)) for sign in [1,-1])
    +.004*math.exp(-((x/.042)**2+((y-(center.y-.096))/.016)**2))
    +.004*math.exp(-((x/.030)**2+((y-(center.y-.072))/.015)**2)))
  def front_surface(x,y):
   rx,rf,rb=section(y);return center.z+rf*math.sqrt(max(.02,1-(x/max(.001,rx))**2))+relief(x,y)
  semantic=obj.data.attributes.new(name='dw_feature_recipe',type='FLOAT',domain='POINT')
  for group in groups:
   hint=-1 if group is biggest else part['recipeIds'][group[0]]
   for i in group:semantic.data[i].value=hint
  for i in biggest:
   p=positions[i].copy()
   if i in [0,589]:
    if i==589:p.z=center.z+.030
   else:
    theta=((i-1)%28)/28*math.pi*2;rx,rf,rb=section(p.y);x=math.sin(theta)*rx;cs=math.cos(theta)
    q=Vector((x,p.y,center.z+cs*(rf if cs>=0 else rb)))
    if cs>0:q.z+=relief(x,p.y)*cs**2
    preserve=max(0,min(1,(p.y-(center.y+.015))/.025));p=q.lerp(p,preserve)
   obj.data.vertices[i].co=to_blender(p)
  for group in groups:
   if group is biggest:continue
   mid=sum((positions[i] for i in group),Vector())/len(group)
   eye_group=mid.z>center.z+.055 and .02<abs(mid.x)<.075 and abs(mid.y-(center.y-.005))<.012
   brow_group=mid.z>center.z+.055 and .02<abs(mid.x)<.075 and .012<mid.y-center.y<.028
   mouth_group=abs(mid.x)<.012 and mid.y<center.y-.060 and mid.z>center.z+.065
   nostril_group=abs(mid.x)<.012 and center.y-.060<mid.y<center.y-.035 and mid.z>center.z+.090
   for i in group:
    p=positions[i].copy()
    if eye_group:
     eye=Vector((math.copysign(.03562,mid.x),center.y-.00512,.10936));p.x=eye.x+(p.x-eye.x)*.96;p.y=eye.y+(p.y-eye.y)*.82;p.z+=front_surface(eye.x,eye.y)+.0015-eye.z
    elif brow_group:
     p.y=mid.y+(p.y-mid.y)*1.25-.012;p.z=front_surface(p.x,p.y)+.0025+(p.z-mid.z)*.5
    elif mouth_group:
     p.x*=1.35;p.y=mid.y+(p.y-mid.y)*1.35+.001*(abs(p.x)/.032)**2;p.z=front_surface(p.x,p.y)+.002+(p.z-mid.z)*.15
    elif nostril_group:p.z=front_surface(p.x,p.y)+.0008+(p.z-mid.z)*.2
    obj.data.vertices[i].co=to_blender(p)
  apply_modifier(obj,'SUBSURF',subdivision_type='CATMULL_CLARK',levels=1)
 elif id.startswith('hand'):
  bpy.data.objects.remove(obj,do_unlink=True);obj=connected_hand(1 if id.endswith('L') else -1,rigs[part['build']]);obj.name=name
 elif id.startswith('barefoot'):
  obj=connected_foot(obj,1 if id.endswith('L') else -1,rigs[part['build']]);obj.name=name
 elif id=='upper':
  for i,p in enumerate(positions):
   # Adult rounded deltoid/forearm shaping. Wrist and neck seam bands are fixed.
   q=p.copy();shoulder=math.exp(-((p.y-1.365)/.07)**2)*math.exp(-((abs(p.x)-.17)/.08)**2)
   q.x+=math.copysign(.0035*shoulder,p.x);q.z+=.0018*shoulder*math.sin(math.atan2(p.z,p.x))
   obj.data.vertices[i].co=to_blender(q)
 elif id.startswith('leg'):
  side=1 if id.endswith('L') else -1;joint=Vector(next(b['bind'] for b in rigs[part['build']]['bones'] if b['name']=='thigh'+id[-1]))
  for i,p in enumerate(positions):
   q=p.copy();s=joint.y-p.y;theta=math.atan2(p.z-joint.z,p.x-joint.x);gather=math.sin(max(0,min(1,s/.34))*math.pi)**2
   q.x+=math.cos(theta)*.0038*math.cos(theta*5+s*18)*gather;q.z+=math.sin(theta)*.0038*math.cos(theta*5+s*18)*gather
   obj.data.vertices[i].co=to_blender(q)
 elif id.startswith('foot'):
  for i,p in enumerate(positions):
   q=p.copy();q.y+=.002*math.exp(-((p.z-.06)/.055)**2)*max(0,min(1,(p.y-.04)/.04));obj.data.vertices[i].co=to_blender(q)
 elif id=='ponytail-crown':
  # The original cap is a full sphere with a buried lower half. The shallower
  # authored face requires that hidden half to sit deeper inside the head.
  # Preserve the visible hairline, crown, loose waves, tie and moving tail.
  cap_center=Vector(next(b['bind'] for b in rigs[part['build']]['bones'] if b['name']=='head'))+Vector((0,.1*h,.016))
  cap_group=next(group for group in groups if 0 in group)
  if set(cap_group)!=set(range(222)):raise RuntimeError('Ponytail cap source changed; remeasure its hairline')
  hairline_keys=[(0,.36),(.55,.26),(1.1,.05),(1.45,-.32),(1.75,-.28),(2.4,-.55),(math.pi,-.62)]
  for i in cap_group:
   if i==0:continue
   unit_y=-1 if i==221 else math.cos(((i-1)//20+1)/12*math.pi)
   phi=0 if i==221 else ((i-1)%20)/20*math.pi*2
   phi=abs(phi if phi<=math.pi else phi-math.pi*2)
   line=hairline_keys[-1][1]
   for (aa,ay),(bb,by) in zip(hairline_keys,hairline_keys[1:]):
    if phi<=bb:
     t=(phi-aa)/(bb-aa);t=t*t*(3-2*t);line=ay+(by-ay)*t;break
   fade=max(0,min(1,(unit_y-line)/.07))
   q=cap_center+(positions[i]-cap_center)*((.38+.62*fade)/(.78+.22*fade))
   obj.data.vertices[i].co=to_blender(q)
  # Preserve each small wave's silhouette while softening its depth by 2%.
  for group in groups:
   if group is cap_group or len(group)>350:continue
   center=sum((positions[i] for i in group),Vector())/len(group)
   for i in group:
    p=positions[i].copy();p.z=center.z+(p.z-center.z)*.98;obj.data.vertices[i].co=to_blender(p)
  apply_modifier(obj,'SUBSURF',subdivision_type='CATMULL_CLARK',levels=1)
  apply_modifier(obj,'DECIMATE',ratio=.5)
 elif id.startswith('piece:'):
  slot=id.split(':')[1]
  # Authored restrained folds follow the existing asymmetric construction and pinned skirt.
  for i,p in enumerate(positions):
   q=p.copy();theta=math.atan2(p.z,p.x);r=Vector((p.x,0,p.z)).normalized()
   if slot=='shoulderDrape':q+=r*(.0015*math.sin((p.y/h-1.16)*math.pi*6)*math.sin(theta*2)**2)
   if slot=='top':q+=r*(.002*math.sin(theta*4+(p.y/h)*5)*max(0,1-abs(p.y/h-1.2)/.2))
   if slot=='waist':q+=r*(.0015*math.cos((p.y/h-1.02)*math.pi*32))
   obj.data.vertices[i].co=to_blender(q)
  if slot=='shoulderDrape':
   # Weld after shaping: source vertex indices stay valid during the sculpt loop.
   bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001);bm.to_mesh(obj.data);bm.free();obj.data.update()
  # Add real curved edges to scales and the turned shoulder cloth, then bind final topology.
  if slot in ['chest','shoulderDrape']:
   apply_modifier(obj,'SUBSURF',subdivision_type='SIMPLE',levels=1)
   apply_modifier(obj,'SMOOTH',factor=.12 if slot=='chest' else .025,iterations=2)
   if slot=='chest':apply_modifier(obj,'DECIMATE',ratio=.4)
 elif cloth:
  for i,p in enumerate(positions):
   j=i//part['cols'];u=(i%part['cols'])/(part['cols']-1);v=j/(part['rows']-1)
   q=p.copy();radial=Vector((p.x,0,p.z)).normalized()
   # Pinned seam remains exact; broad offset folds taper into the secured lower hem.
   if not part['pinned'][i]:q+=radial*(.003*math.sin(u*math.pi*4+v*.8)*math.sin(v*math.pi)**2)
   obj.data.vertices[i].co=to_blender(q)
 # Final evaluated topology is the source of every binding, skin influence and hash.
 print('Binding '+name+' / '+str(len(obj.data.vertices))+' vertices',flush=True)
 rec=exp.make_record(obj,part)
 bind,bary,skin_indices,skin_weights=rec['bind'],rec['bary'],rec['joints'],rec['weights']
 mesh=obj.data
 records.append(rec);objects.append((obj,rec))
 # Editable paint and vertex groups are stored in the .blend, apart from export metadata.
 col=mesh.color_attributes.new(name='Dye preview',type='FLOAT_COLOR',domain='POINT')
 original_colors=part.get('attributes',{}).get('color',{}).get('values')
 for i in range(len(mesh.vertices)):
  tri=bind[i*3:i*3+3];ws=bary[i*3:i*3+3];rgb=[sum(original_colors[k*3+t]*w for k,w in zip(tri,ws)) for t in range(3)] if original_colors else [.84,.81,.74]
  col.data[i].color=(*rgb,1)
 for bone_index,bone in enumerate(rigs[part['build']]['bones']):
  group=obj.vertex_groups.new(name=bone['name'])
  for i in range(len(mesh.vertices)):
   weight=sum(skin_weights[i*4+t] for t in range(4) if skin_indices[i*4+t]==bone_index)
   if weight>0:group.add([i],weight,'REPLACE')
 obj['driftwing_part']=id;obj['build']=part['build'];obj['method']=part['method'];obj['final_topology']=rec['topology'];obj['binding_generated_after_modifiers']=True
 obj.hide_render=part['build']!='medium' or id.endswith(':wanderer');obj.hide_set(obj.hide_render)

# Native editable armatures follow the measured joint hierarchy. No actions or baked poses.
print('Building editable armatures',flush=True)
for build,rig in rigs.items():
 arm=bpy.data.armatures.new('Current 27 joints / '+build);o=bpy.data.objects.new('Rig / '+build,arm);authored.objects.link(o);bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.mode_set(mode='EDIT');bones={}
 for bone in rig['bones']:
  eb=arm.edit_bones.new(bone['name']);eb.head=to_blender(bone['bind']);eb.tail=eb.head+Vector((0,0,.025));bones[bone['name']]=eb
 for bone in rig['bones']:
  if bone['parent']:bones[bone['name']].parent=bones[bone['parent']]
 bpy.ops.object.mode_set(mode='OBJECT');o.select_set(False);o.show_in_front=True
 for obj,rec in objects:
  if rec['build']==build:mod=obj.modifiers.new('Existing shared rig','ARMATURE');mod.object=o
 o.hide_render=True;o.hide_set(build!='medium')

text=bpy.data.texts.new('AUTHORING_README.txt');text.write('Bounded Driftwing rider trial. Metres, Blender Z-up; export converts (x,y,z) to (x,z,-y).\nMeasured fitting sources are hidden and preserved. Edit authored meshes, then run rider-blender-export.py on this saved file.\nMaterials preview vertex dyes only. Runtime uses the existing painterly shader and shared atlas.\nEach garment and cloth patch has its own source identity; never join variants or apply the armature before export.\nNo harness fit adjustment is used here. Ponytail solver, root and motion envelope remain the original runtime system.\n')
bpy.context.scene['driftwing_source_head']=data['sourceHead'];bpy.context.scene['driftwing_contract']=1
# Store exact source metadata in the editable project for subsequent manual edits/export.
meta=bpy.data.texts.new('DRIFTWING_EXPORT_SOURCE.json');meta.write(json.dumps({'sourceFile':'FITTING_CAGES.json','sha256':hashlib.sha256((SRC/'FITTING_CAGES.json').read_bytes()).hexdigest()},indent=2))
print('Saving editable project',flush=True)
bpy.ops.wm.save_as_mainfile(filepath=str(SRC/'rider-trial.blend'))
# Export implementation is intentionally separate so a manually edited .blend can be re-exported.
exp.write_assets(records,rigs)
