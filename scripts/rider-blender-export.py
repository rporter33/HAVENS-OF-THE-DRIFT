"""Re-export the currently open editable rider-trial.blend. No topology optimizer follows binding.
Run Blender rider-trial.blend --background --python scripts/rider-blender-export.py.
"""
import bpy,json,pathlib,struct,hashlib,math,copy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=pathlib.Path(__file__).resolve().parents[1]
to_engine=lambda p:Vector((p[0],p[2],-p[1]))
def fnv(words):
 h=2166136261
 for x in words:h=((h^(int(x)&0xffffffff))*16777619)&0xffffffff
 return format(h,'08x')
def topo(pos,indices):return fnv([len(pos),len(indices)]+[math.floor(float(c)*1e6+.5) for p in pos for c in p]+indices)
def layout(pos,indices):return fnv([len(pos),len(indices)]+indices)
def barycentric(p,a,b,c):
 v0=b-a;v1=c-a;v2=p-a;d00=v0.dot(v0);d01=v0.dot(v1);d11=v1.dot(v1);d20=v2.dot(v0);d21=v2.dot(v1);den=d00*d11-d01*d01
 if abs(den)<1e-18:return [1.,0.,0.]
 v=(d11*d20-d01*d21)/den;w=(d00*d21-d01*d20)/den;ws=[max(0,min(1,x)) for x in [1-v-w,v,w]];s=sum(ws);return [x/s for x in ws]
def frame(a,b,c):
 u=(b-a).normalized();n=(b-a).cross(c-a).normalized();v=n.cross(u);return u,v,n

def write_assets(records,rigs):
 binary=bytearray();views=[];accessors=[];nodes=[];meshes=[];skins=[];scene_nodes=[]
 def accessor(values,size=1,component=5126,target=None):
  fmt={5126:'f',5123:'H',5125:'I'}[component];values=list(values)
  while len(binary)%4:binary.append(0)
  raw=struct.pack('<'+fmt*len(values),*values);offset=len(binary);binary.extend(raw);view={'buffer':0,'byteOffset':offset,'byteLength':len(raw)}
  if target:view['target']=target
  views.append(view);a={'bufferView':len(views)-1,'componentType':component,'count':len(values)//size,'type':{1:'SCALAR',2:'VEC2',3:'VEC3',4:'VEC4',16:'MAT4'}[size]}
  if size==3 and component==5126:a.update(min=[min(values[t::3]) for t in range(3)],max=[max(values[t::3]) for t in range(3)])
  accessors.append(a);return len(accessors)-1
 for build,rig in rigs.items():
  first=len(nodes);byname={b['name']:first+i for i,b in enumerate(rig['bones'])}
  for b in rig['bones']:
   parent=next((p for p in rig['bones'] if p['name']==b['parent']),None);local=[x-y for x,y in zip(b['bind'],parent['bind'] if parent else [0,0,0])]
   nodes.append({'name':build+'/'+b['name'],'translation':local,'children':[byname[c['name']] for c in rig['bones'] if c['parent']==b['name']],'extras':{'driftwingJoint':b['name']}})
   if not parent:scene_nodes.append(byname[b['name']])
  inverse=[]
  for b in rig['bones']:x,y,z=b['bind'];inverse.extend([1,0,0,0,0,1,0,0,0,0,1,0,-x,-y,-z,1])
  skins.append({'name':'Shared canonical '+build+' rig','joints':list(range(first,first+27)),'inverseBindMatrices':accessor(inverse,16),'skeleton':first})
 skinid={build:i for i,build in enumerate(rigs)}
 for rec in records:
  count=len(rec['positions']);positions=[x for p in rec['positions'] for x in p];normals=[x for p in rec['normals'] for x in p]
  attrs={'POSITION':accessor(positions,3,target=34962),'NORMAL':accessor(normals,3,target=34962),'TEXCOORD_0':accessor(rec['uv'],2,target=34962),'JOINTS_0':accessor(rec['joints'],4,5123,34962),'WEIGHTS_0':accessor(rec['weights'],4,target=34962)}
  for semantic,key,size in [('_DW_SURFACE','surface',1),('_DW_GLOW','glow',1),('_DW_RECIPE','recipeIds',1),('_DW_CAGE','bind',3),('_DW_BARY','bary',3),('_DW_OFFSET','offset',3)]:attrs[semantic]=accessor(rec[key],size,target=34962)
  meta={'contract':1,'region':rec['id'],'coverage':'owned-region','build':rec['build'],'fitKey':'authored-v1','method':rec['method'],'recipes':rec['recipes'],'topology':rec['topology'],'sourceTopology':rec['sourceTopology'],'sourceLayout':rec['sourceLayout'],'cagePositions':rec['base'],'cageIndices':rec['cageIndices']}
  if rec['method']=='cloth':meta.update(cols=rec['cols'],rows=rec['rows'],control=rec['control'])
  if 'equipmentParts' in rec:meta.update(equipmentParts=rec['equipmentParts'],sockets=rec['sockets'])
  meshes.append({'name':rec['build']+'/'+rec['id'],'primitives':[{'attributes':attrs,'indices':accessor(rec['indices'],1,5125,34963),'material':0}]})
  nodes.append({'name':rec['build']+'/'+rec['id'],'mesh':len(meshes)-1,'skin':skinid[rec['build']],'extras':{'driftwing':meta}});scene_nodes.append(len(nodes)-1)
 contract={'contract':1,'kind':'blender-authored','source':'assets/rider-blender/source/rider-trial.blend','axes':'X-left/Y-up/Z-forward','units':'meters'}
 while len(binary)%4:binary.append(0)
 document={'asset':{'version':'2.0','generator':'Driftwing bounded trial / Blender '+bpy.app.version_string},'scene':0,'scenes':[{'nodes':scene_nodes,'extras':{'driftwing':contract}}],'nodes':nodes,'meshes':meshes,'skins':skins,'materials':[{'name':'Painterly runtime contract; Blender nodes ignored','pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1],'metallicFactor':0,'roughnessFactor':1}}],'buffers':[{'byteLength':len(binary)}],'bufferViews':views,'accessors':accessors}
 js=json.dumps(document,separators=(',',':')).encode();js+=b' '*((-len(js))%4);glb=struct.pack('<III',0x46546c67,2,12+8+len(js)+8+len(binary))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(binary),0x004e4942)+binary
 output=ROOT/'src/assets/rider-blender/rider-trial.glb';output.write_bytes(glb)
 report={'blender':bpy.app.version_string,'buildHash':bpy.app.build_hash.decode(),'source':str(pathlib.Path(bpy.data.filepath).relative_to(ROOT)).replace('\\','/'),'sourceSha256':hashlib.sha256(pathlib.Path(bpy.data.filepath).read_bytes()).hexdigest(),'export':str(output.relative_to(ROOT)).replace('\\','/'),'bytes':len(glb),'sha256':hashlib.sha256(glb).hexdigest(),'compression':'none','axes':'X-left/Y-up/Z-forward','units':'meters','animations':0,'maps':'shared runtime painterly atlas; no embedded images','binding':'regenerated from final editable mesh topology; no optimizer follows','parts':[{'id':r['id'],'build':r['build'],'method':r['method'],'vertices':len(r['positions']),'triangles':len(r['indices'])//3,'topology':r['topology'],'sourceTopology':r['sourceTopology']} for r in records]}
 (ROOT/'docs/rider-blender-trial/ASSET_MANIFEST.json').write_text(json.dumps(report,indent=2));print(json.dumps({k:v for k,v in report.items() if k!='parts'}))

def make_record(obj,source):
 part=copy.deepcopy(source);cloth=part['method']=='cloth';id=part['id']
 if cloth:
  positions=[Vector(part['positions'][i:i+3]) for i in range(0,len(part['positions']),3)];indices=[];cols=part['cols'];rows=part['rows']
  for j in range(rows-1):
   for i in range(cols-1):a=j*cols+i;indices += [a,a+1,a+cols,a+1,a+cols+1,a+cols]
 else:
  attrs=part['attributes'];positions=[Vector(attrs['position']['values'][i:i+3]) for i in range(0,len(attrs['position']['values']),3)];indices=part['indices']
 mesh=obj.data;mesh.calc_loop_triangles();final=[to_engine(v.co) for v in mesh.vertices];final_indices=[v for t in mesh.loop_triangles for v in t.vertices]
 bvh=BVHTree.FromPolygons(positions,[indices[i:i+3] for i in range(0,len(indices),3)],all_triangles=True)
 bind=[];bary=[];offset=[];uv=[];surface=[];glow=[];skin_indices=[];skin_weights=[];recipe_ids=[]
 recipe_list=copy.deepcopy(part.get('recipes',[{'k':'slot','s':'outfitPrimary'}]));recipe_map={json.dumps(r,sort_keys=True):i for i,r in enumerate(recipe_list)}
 def recipe_id(r):
  key=json.dumps(r,sort_keys=True)
  if key not in recipe_map:recipe_map[key]=len(recipe_list);recipe_list.append(r)
  return recipe_map[key]
 for i,p in enumerate(final):
  hit,n,face,distance=bvh.find_nearest(p);tri=indices[face*3:face*3+3];a,b,c=[positions[x] for x in tri];ws=barycentric(hit,a,b,c);f=frame(a,b,c);base=sum((positions[x]*w for x,w in zip(tri,ws)),Vector());delta=p-base
  bind.extend(tri);bary.extend(ws);offset.extend([delta.dot(x) for x in f]);weights={}
  if cloth:
   # These weights validate the bind export only; runtime cloth is an unskinned Mesh.
   ctrl=part['control'];col=min(ctrl['cols']-1,round((i%part['cols'])/(part['cols']-1)*(ctrl['cols']-1)));row=min(ctrl['rows']-1,round((i//part['cols'])/(part['rows']-1)*(ctrl['rows']-1)));guide=ctrl['guideSkin'][row*ctrl['cols']+col]
   weights=dict(zip(guide[::2],guide[1::2]));uv.extend([i%part['cols']/(part['cols']-1),i//part['cols']/(part['rows']-1)]);surface.append(1);glow.append(0);recipe_ids.append(0)
  else:
   for k,w in zip(tri,ws):
    for t in range(4):
     bone=int(attrs['skinIndex']['values'][k*4+t]);weights[bone]=weights.get(bone,0)+attrs['skinWeight']['values'][k*4+t]*w
   nearest=tri[max(range(3),key=lambda x:ws[x])];surface.append(attrs['c02Surface']['values'][nearest]);glow.append(sum(attrs['glow']['values'][x]*w for x,w in zip(tri,ws)))
   uv.extend([sum(attrs['uv']['values'][x*2+t]*w for x,w in zip(tri,ws)) for t in range(2)])
   # Keep source recipes explicit and interpolate in linear RGB, matching the fitting cage.
   rs=[part['recipes'][part['recipeIds'][x]] for x in tri];r=rs[0]
   if ws[1]>1e-7:r={'k':'lmix','a':r,'b':rs[1],'t':ws[1]/max(1e-12,ws[0]+ws[1])}
   if ws[2]>1e-7:r={'k':'lmix','a':r,'b':rs[2],'t':ws[2]}
   recipe_ids.append(recipe_id(r))
  pairs=sorted([(k,w) for k,w in weights.items() if w>1e-8],key=lambda x:-x[1])[:4];total=sum(w for k,w in pairs)
  skin_indices.extend([k for k,w in pairs]+[0]*(4-len(pairs)));skin_weights.extend([w/total for k,w in pairs]+[0]*(4-len(pairs)))
 normals=[to_engine(v.normal) for v in mesh.vertices]
 # Runtime fitting-cage recipes own modular garment colors. Avoid thousands of redundant
 # barycentric recipe trees in the GLB; direct skin/head regions retain authored recipes.
 if part['method']!='direct':recipe_list=[{'k':'slot','s':'outfitPrimary'}];recipe_ids=[0]*len(final)
 elif id=='head':
  # Feature identity is authored and survives subdivision independently of spatial
  # binding. Never let a nearby cheek replace a brow/iris/lip dye recipe.
  hints=mesh.attributes.get('dw_feature_recipe')
  if not hints:raise RuntimeError('Missing authored face semantic attribute')
  skin_source=set(obj.get('dw_skin_source_vertices',[]))
  if not skin_source:raise RuntimeError('Missing authored head skin source identity')
  skin_tris=[indices[i:i+3] for i in range(0,len(indices),3) if all(k in skin_source for k in indices[i:i+3])]
  skin_bvh=BVHTree.FromPolygons(positions,skin_tris,all_triangles=True)
  recipe_list=part['recipes'];recipe_ids=[]
  for i,p in enumerate(final):
   if hints.data[i].value>=0:recipe_ids.append(round(hints.data[i].value));continue
   hit,n,face,distance=skin_bvh.find_nearest(p);tri=skin_tris[face];ws=barycentric(hit,*[positions[k] for k in tri]);recipe_ids.append(part['recipeIds'][tri[max(range(3),key=lambda j:ws[j])]])
 elif id.startswith('hand'):recipe_list=[{'k':'slot','s':'skin'}];recipe_ids=[0]*len(final)
 elif id.startswith('barefoot'):recipe_list=[{'k':'slot','s':'skin'}];recipe_ids=[0]*len(final)
 elif id.startswith('equipment:windkeel-'):
  # Component identity is vertex-authored, not inferred from nearby overlapping trim.
  if layout(final,final_indices)!=layout(positions,indices):raise RuntimeError('Regenerate Windkeel semantic ranges after topology edits')
  recipe_list=part['recipes'];recipe_ids=part['recipeIds'];surface=attrs['c02Surface']['values'];uv=attrs['uv']['values']
 rec={'id':id,'build':part['build'],'method':part['method'],'positions':final,'indices':final_indices,'normals':normals,'uv':uv,'surface':surface,'glow':glow,'joints':skin_indices,'weights':skin_weights,'recipes':recipe_list,'recipeIds':recipe_ids,'bind':bind,'bary':bary,'offset':offset,'base':[x for p in positions for x in p],'cageIndices':indices,'sourceLayout':layout(positions,indices),'sourceTopology':topo(positions,indices),'topology':topo(final,final_indices)}
 if cloth:rec.update(cols=part['cols'],rows=part['rows'],control=part['control'])
 if 'equipmentParts' in part:rec.update(equipmentParts=part['equipmentParts'],sockets=part['sockets'])
 if part['method']=='delta' and layout(final,final_indices)!=layout(positions,indices):raise RuntimeError('Delta cage topology changed: regenerate the fitting source for '+id)
 if cloth and (len(final)!=part['cols']*part['rows'] or final_indices!=indices):raise RuntimeError('Cloth patch must retain its explicit regular grid: '+id)
 return rec

if __name__=='__main__':
 descriptor=json.loads(bpy.data.texts['DRIFTWING_EXPORT_SOURCE.json'].as_string());sourcefile=pathlib.Path(bpy.data.filepath).parent/descriptor['sourceFile']
 if hashlib.sha256(sourcefile.read_bytes()).hexdigest()!=descriptor['sha256']:raise RuntimeError('Fitting source hash changed; regenerate bindings with verified construction inputs')
 source=json.loads(sourcefile.read_text());rigs={r['build']:r for r in source['rigs']};records=[]
 if 'equipmentSource' in descriptor:
  extra=pathlib.Path(bpy.data.filepath).parent/descriptor['equipmentSource']
  if hashlib.sha256(extra.read_bytes()).hexdigest()!=descriptor['equipmentSha256']:raise RuntimeError('Windkeel fitting source hash changed')
  source['parts'].extend(json.loads(extra.read_text())['parts'])
 for part in source['parts']:
  matches=[o for o in bpy.data.objects if o.type=='MESH' and o.get('driftwing_part')==part['id'] and o.get('build')==part['build']]
  if len(matches)!=1:raise RuntimeError('Missing or ambiguous authored mesh '+part['build']+'/'+part['id'])
  records.append(make_record(matches[0],part))
 write_assets(records,rigs)
