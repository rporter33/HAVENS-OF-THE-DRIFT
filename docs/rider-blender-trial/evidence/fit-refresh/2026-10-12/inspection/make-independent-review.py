"""Evidence-only contact sheets and independent readback hashes. Never changes runtime/source."""
from pathlib import Path
from PIL import Image, ImageDraw
import json, hashlib, datetime

TRIAL=Path('C:/Users/Robert/.codex/worktrees/rider-blender-trial/Driftwing')
VISUAL=Path('C:/Users/Robert/.codex/visualizations/2026/10/11/01a12d01-df73-7353-bddb-5533013056c8/rider-fit-refresh-20261012')
FIT=TRIAL/'shots/rider-blender/windkeel-resting-fit/2026-10-12T06-27-36-293Z'
WALK=VISUAL/'walk-run-supplement/2026-10-12T06-35-35-372Z-94884439'
OUT=VISUAL/'inspection'
OUT.mkdir(parents=True,exist_ok=True)
hash_file=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
reports=[(FIT/'report.json',TRIAL),(WALK/'report.json',None)]
captures=[]
for report_path,base in reports:
    report=json.loads(report_path.read_text(encoding='utf-8-sig'))
    for entry in report['captures']:
        p=Path(entry['file'])
        if not p.is_absolute():p=base/p
        digest=hash_file(p)
        if digest!=entry['sha256']:raise RuntimeError('Capture hash mismatch: '+str(p))
        accepted=base is None or '-stable-' in entry['name'] or '-gameplay-mounted-' in entry['name']
        captures.append({'name':entry['name'],'path':str(p),'sha256':digest,'report':str(report_path),'acceptedVisibleFit':accepted,'qualification':'Clear bounded Stable view' if '-stable-' in entry['name'] else 'Broad mounted silhouette only; small rider' if '-gameplay-mounted-' in entry['name'] else 'Clear actual on-foot follow-camera supplement' if base is None else 'Retained raw state evidence; excluded from visible-fit proof because nearby wyvern obstructs Medium walk and separate supplement supersedes this group'})

sheets=[]
def sheet(name,entries,cols,size,crop=None):
    rows=(len(entries)+cols-1)//cols
    label=30
    result=Image.new('RGB',(cols*size[0],rows*(size[1]+label)),(32,32,32))
    draw=ImageDraw.Draw(result)
    for i,entry in enumerate(entries):
        picture=Image.open(entry['path']).convert('RGB')
        if crop:picture=picture.crop(crop)
        if picture.size!=size:picture=picture.resize(size,Image.Resampling.LANCZOS)
        x=(i%cols)*size[0];y=(i//cols)*(size[1]+label)
        draw.text((x+5,y+5),entry['name'],fill=(245,245,245))
        result.paste(picture,(x,y+label))
    target=OUT/name
    result.save(target)
    sheets.append({'path':str(target),'sha256':hash_file(target),'sourceNames':[e['name'] for e in entries],'crop':crop,'cellSize':size,'qualification':'Derived review aid. Raw full frames independently inspected; no altered asset pixels or runtime changes.'})

for look in ['medium-travel','slight-travel','broad-travel','medium-flight']:
    group=[e for e in captures if e['name'].startswith(look+'-stable-')]
    sheet('stable-'+look+'.png',group,4,(300,650),(860,240,1160,890))
mounted=[e for e in captures if '-gameplay-mounted-' in e['name']]
sheet('mounted-all-full-frames.png',mounted,2,(720,540))
for look in ['medium-travel-drape','medium-flight']:
    group=[e for e in captures if e['name'].startswith(look) and e['report']==str(WALK/'report.json')]
    sheet('walk-run-'+look+'-full-frames.png',group,2,(720,540))

source_files=['src/creatures/rider/authoredConstruction.ts','src/creatures/rider/windkeelHarness.ts','src/creatures/rider/windkeelContact.ts','src/creatures/rider/Rider.ts','src/creatures/rider/model.ts','src/assets/rider-blender/rider-trial.glb','assets/rider-blender/source/rider-trial.blend','scripts/rider-blender-fit-qa.mjs']
review={'reviewedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'reviewer':'fit_audit independent subagent','scope':'Read-only source/evidence review. All accepted raw images were visually inspected individually before these sheets were generated. No runtime/source edits, tests, servers, commits or deployment by this reviewer.','assetSha256':hash_file(TRIAL/'src/assets/rider-blender/rider-trial.glb'),'sources':[{'path':str(TRIAL/p),'sha256':hash_file(TRIAL/p)} for p in source_files],'reports':[{'path':str(p),'sha256':hash_file(p)} for p,_ in reports],'captures':captures,'sheets':sheets,'acceptedVisibleFitCaptures':sum(e['acceptedVisibleFit'] for e in captures),'excludedRawCaptures':sum(not e['acceptedVisibleFit'] for e in captures),'observations':['All16 Stable front/left/right/back views are rider-focused and unobstructed. The three Travel builds show continuous thin cloth across both shoulders and close blue/linen torso/back straps. No gross detached cap or floating torso harness was visible at this framing.','Medium Flight front/left/right/back keeps blue/linen Windkeel close to the jacket. Retained brown jacket/waist equipment remains visible as mixed garment equipment; this audit does not redefine it as a production art defect.','All8 actual mounted-side captures retain visible rider silhouette. Small rider size supports broad silhouette/attachment review only, not millimetric contact or hidden-surface certification.','All8 walk/run supplement frames show the full rider unobstructed in actual on-foot follow-camera front/back framing. Travel shoulders/harness stay connected and close in the sampled moving poses. No gross new suspension was visible.','The full-fit raw walk/run group is retained for state evidence and excluded from visible-fit acceptance; the separately recorded clear supplement supplies Medium Travel/Flight walk/run appearance.'],'defectsObserved':[],'limits':['Bounded still-frame inspection of scripted real-game transitions, not physical-controller playtest or exhaustive animation/layer coverage.','Software Edge/SwiftShader frames do not certify hardware performance.','No near-indistinguishable concept likeness, cloth self-collision, arbitrary-world contact, hidden seams, or every wardrobe mix certification.','Existing software CPU gate remains open; this visual refresh does not resolve or rerun it.'],'recommendation':'Preserve current authored geometry and fittings. No further model change justified by the reviewed fresh evidence; owner artistic acceptance remains separate.'}
target=OUT/'INDEPENDENT_VISUAL_REVIEW.json'
target.write_text(json.dumps(review,indent=2),encoding='utf-8')
print(json.dumps({'review':str(target),'sha256':hash_file(target),'accepted':review['acceptedVisibleFitCaptures'],'excluded':review['excludedRawCaptures'],'sourceHashes':len(source_files),'sheets':len(sheets)}))
