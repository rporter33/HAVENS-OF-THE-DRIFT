"""Append the selected preserved Windkeel fits to the editable rider, then export.
Blender --background assets/rider-blender/source/rider-trial.blend --python this-file.
No source branch merge, no repeated Flight adjustment, no topology optimization.
"""
import bpy, json, pathlib, hashlib, shutil, runpy
ROOT=pathlib.Path(__file__).resolve().parents[1]
SRC=ROOT/'assets/rider-blender/source'
REF=ROOT/'assets/rider-blender/references/motion-fit/docs/art-pilots/windkeel-motion-fit-20261011/browser-preview/windkeel-motion'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
old=ROOT.parent/'trial-art-history/before-selected-windkeel'
if not old.exists():
 old.mkdir(parents=True)
 saved=[]
 for p in [SRC/'rider-trial.blend',ROOT/'src/assets/rider-blender/rider-trial.glb',ROOT/'docs/rider-blender-trial/ASSET_MANIFEST.json']:
  q=old/p.name;shutil.copyfile(p,q)
  if sha(q)!=sha(p):raise RuntimeError('Pre-Windkeel backup mismatch')
  saved.append({'path':str(p.relative_to(ROOT)),'backup':q.name,'bytes':q.stat().st_size,'sha256':sha(q)})
 (old/'manifest.json').write_text(json.dumps({'files':saved},indent=2))
base=json.loads((SRC/'FITTING_CAGES.json').read_text())
rig=next(r for r in base['rigs'] if r['build']=='medium');names=[b['name'] for b in rig['bones']]
def linear(x):return x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4
def const(h):return dict(k='const',**dict(zip('rgb',[linear(int(h[i:i+2],16)/255) for i in (0,2,4)])))
recipes=[const('7fa8c4'),const('f2eada'),{'k':'slot','s':'leatherColor'},const('b99152'),const('40596a')]
sockets=[{'name':'AN_SOCKET_WINDLINE_DORSAL','bone':'chest','p':[0,1.19,-.150]},
 {'name':'AN_SOCKET_GUIDE_LEFT','bone':'clavL','p':[.104,1.447,-.036]},
 {'name':'AN_SOCKET_RIDING_LEFT','bone':'hips','p':[.130,1.024,.143]},
 {'name':'AN_SOCKET_RIDING_RIGHT','bone':'hips','p':[-.130,1.024,.143]}]
parts=[];inputs=[]
for fit,file in [('aerie','aerie-medium.json'),('flight','flight-medium-motion.json')]:
 path=REF/file;d=json.loads(path.read_text());a=d['bind'];count=len(a['vertices'])//3
 if count!=1286 or len(a['indices'])//3!=2504 or d['boneNames']!=names:raise RuntimeError('Preserved Windkeel topology/rig differs')
 surface=[];uv=[];recipe_ids=[];components=[]
 for c in a['parts']:
  name=c['name'];start=c['startVertex'];n=c['vertices']
  if start!=len(surface):raise RuntimeError('Component ranges must be contiguous')
  rid=1 if 'linen' in name.lower() or 'cushion' in name else 0 if 'blue' in name or name=='Waist_load_wrap' else 2 if 'flex_link' in name or 'leather' in name or 'soft_cradle' in name else 4 if 'slate_tab' in name else 3
  sid=[1,1,3,4,2][rid];tile={1:(0,0),2:(.5,0),3:(0,.5),4:(.5,.5)}[sid]
  for i in range(start,start+n):
   # Original atlas coordinates are converted to the existing semantic painterly tiles.
   u=(a['uv'][i*2]*4)%1;v=(a['uv'][i*2+1]*2)%1
   uv.extend([tile[0]+(16+u*480)/1024,tile[1]+(16+v*480)/1024]);surface.append(sid);recipe_ids.append(rid)
  components.append({**c,'role':['blue','linen','leather','bronze','slate'][rid]})
 def attr(values,size):return {'itemSize':size,'values':values}
 part={'id':'equipment:windkeel-'+fit,'build':'medium','method':'direct','attributes':{
  'position':attr(a['vertices'],3),'normal':attr(a['normals'],3),'uv':attr(uv,2),'skinIndex':attr(a['skinIndex'],4),'skinWeight':attr(a['skinWeight'],4),
  'c02Surface':attr(surface,1),'glow':attr([0]*count,1)},'indices':a['indices'],'recipes':recipes,'recipeIds':recipe_ids,'equipmentParts':components,'sockets':sockets}
 parts.append(part);inputs.append({'path':str(path.relative_to(ROOT)).replace('\\','/'),'sha256':sha(path),'bytes':path.stat().st_size,'flightAdjustmentAlreadyBaked':fit=='flight'})
extra=SRC/'WINDKEEL_FITTING.json';extra.write_text(json.dumps({'contract':1,'inputs':inputs,'parts':parts},separators=(',',':')))
collection=bpy.data.collections.get('Selected Windkeel - editable fits')
if not collection:collection=bpy.data.collections.new('Selected Windkeel - editable fits');bpy.context.scene.collection.children.link(collection)
arm=next(o for o in bpy.data.objects if o.type=='ARMATURE' and o.name=='Rig / medium')
for part in parts:
 for oldobj in list(collection.objects):
  if oldobj.get('driftwing_part')==part['id']:bpy.data.objects.remove(oldobj,do_unlink=True)
 a=part['attributes'];v=a['position']['values'];indices=part['indices']
 mesh=bpy.data.meshes.new(part['id']);mesh.from_pydata([(v[i],-v[i+2],v[i+1]) for i in range(0,len(v),3)],[],[indices[i:i+3] for i in range(0,len(indices),3)]);mesh.update()
 obj=bpy.data.objects.new(part['id'],mesh);collection.objects.link(obj);obj['driftwing_part']=part['id'];obj['build']='medium';obj['method']='direct';obj['equipmentParts']=json.dumps(part['equipmentParts']);obj['source']='Preserved motion-fit; Flight adjustment already baked'
 for p in mesh.polygons:p.use_smooth=True
 groups=[obj.vertex_groups.new(name=n) for n in names]
 for i in range(len(mesh.vertices)):
  for k in range(4):
   w=a['skinWeight']['values'][i*4+k]
   if w:groups[a['skinIndex']['values'][i*4+k]].add([i],w,'REPLACE')
 mod=obj.modifiers.new('Current shared rider skeleton','ARMATURE');mod.object=arm
 for role,rid in [('Blue',0),('Linen',1),('Leather',2),('Bronze',3),('Slate',4)]:
  m=bpy.data.materials.get('Windkeel / '+role) or bpy.data.materials.new('Windkeel / '+role);r=recipes[rid];m.diffuse_color=(*([r.get(k,.1) for k in 'rgb']),1);mesh.materials.append(m)
 for face in mesh.polygons:face.material_index=part['recipeIds'][face.vertices[0]]
 # Keep fits separately editable and avoid showing two overlapping equipment meshes.
 obj.hide_set(part['id'].endswith('flight'));obj.hide_render=part['id'].endswith('flight')
descriptor=json.loads(bpy.data.texts['DRIFTWING_EXPORT_SOURCE.json'].as_string());descriptor.update(equipmentSource=extra.name,equipmentSha256=sha(extra))
bpy.data.texts['DRIFTWING_EXPORT_SOURCE.json'].clear();bpy.data.texts['DRIFTWING_EXPORT_SOURCE.json'].write(json.dumps(descriptor,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(SRC/'rider-trial.blend'))
runpy.run_path(str(ROOT/'scripts/rider-blender-export.py'),run_name='__main__')
