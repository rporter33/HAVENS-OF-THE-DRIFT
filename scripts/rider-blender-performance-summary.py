"""Read-only derivation from the completed hardware/CPU evidence; no tests run."""
import pathlib, json, hashlib, datetime
root = pathlib.Path(__file__).resolve().parents[1]
stage = root / 'docs/rider-blender-trial/evidence'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
hardware_path = root / 'shots/rider-blender/qa-performance/report.json'
hardware = json.loads(hardware_path.read_text())
assert len(hardware['cases']) == 12 and not hardware['errors']
assert all(not case.get('failure') for case in hardware['cases'])
stable = next(c for c in hardware['cases'] if c['scene']=='stable' and c['variant']=='trial')
inventory = stable['memoryInventory']
last = inventory['snapshots'][-1]
present = set(last['imported']['cachedRegionGeometries']['bufferIds'])
for item in [last['imported']['fittingCageArrays'], last['sceneReferencedGeometries'],
             last['renderedRiderGeometries'], last['clothAuxiliaryArrays']]:
    present.update(item['bufferIds'])
for item in last['textures']['entries']:
    present.update(item['bufferIds'])
known = [t for t in inventory['encounteredTextureCache']['textures']
         if t['name'].startswith('C02 M01 ') and not t['disposeObserved']]
extra = 0
for texture in known:
    ids = texture['bufferIds']
    assert len(ids)==1, 'Cannot infer individual sizes for a multi-buffer texture'
    if ids[0] not in present:
        extra += texture['uniqueArrayBufferBytes']
        present.add(ids[0])
cases = []
for case in hardware['cases']:
    measure = case['measurement']
    cases.append({k:case[k] for k in ['scene','quality','variant','durationSeconds','renderer']} |
                 {k:measure[k] for k in ['elapsedMs','raf','cpuSubmission','render','memory']})
cpu_path = root/'shots/rider-blender/performance-solo/report.json'
cpu = json.loads(cpu_path.read_text())
cpu_cases = []
for check in cpu['checks']:
    data = json.loads((root/check['evidenceFile']).read_text())
    cpu_cases.append({'variant':check['variant'],'exitCode':check['exitCode'],
                      'provider':check['provider'],
                      'cases':[{'depth':c['depth'],'swinging':c['swinging'],'hanging':c['hanging']}
                               for c in data['cases']]})
record = {'derivedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
          'inputs':[{'path':p.relative_to(root).as_posix(),'sha256':sha(p)} for p in [hardware_path,cpu_path]],
          'hardwareCases':cases,'dyeUpdates':stable['recolor'],
          'memory':{'sample':'Final Low after High/Low/Medium/High/Ultra/Low in one Stable trial context',
                    'cachedImportedRegions':last['imported']['regionCount'],
                    'retainedDecodeArrayBufferBytesLowerBound':last['imported']['retainedDecodeArrayBufferBytesLowerBound'],
                    'glbDeliveryBytesSeparate':last['imported']['encodedGlbDeliveryBytes'],
                    'observedCurrentBoundAndGeometryArrayBufferBytesLowerBound':last['coexistingObservedArrayBufferBytesLowerBound'],
                    'additionalKnownRetainedAtlasCacheBytesDeduplicated':extra,
                    'includingKnownRetainedAtlasCachesArrayBufferBytesLowerBound':last['coexistingObservedArrayBufferBytesLowerBound']+extra,
                    'knownAtlasCachedColorBytes':inventory['encounteredTextureCache']['knownRiderAtlasCacheDataBytesLowerBound'],
                    'atlasResolutions':inventory['encounteredTextureCache']['knownRiderAtlasResolutions'],
                    'method':'Union of recorded current geometry/cage/cloth/texture buffer IDs, then add only undisposed known C02 atlas buffers absent from that union. Each added texture has exactly one recorded ArrayBuffer. No double counting of active Low atlas or GLB delivery length.',
                    'limits':last['limits']+' Known C02 atlas cache ownership is confirmed by the module cache; this remains a lower bound, not total process RAM or physical VRAM.'},
          'originalSoftwareCpuCheck':{'status':'one standalone baseline pass and generated-provider trial failure retained; full-workflow result recorded separately',
                                     'assertion':'swinging p95 <20 ms unchanged','cases':cpu_cases},
          'coverageLimits':['One dedicated GPU, headless Edge, 1440x1080; no integrated GPU/physical controller certification.',
                            '60 seconds each Low mounted case; 20 seconds each other case, two seconds warmup.',
                            'Frame cadence and CPU submission; no GPU timer query, GPU-memory total or FPS guarantee.',
                            'Same scene/start/look/settings/input/duration, naturally changing frame visibility; counters are observations, not exact pixel-locked isolated rider costs.']}
stage.mkdir(parents=True,exist_ok=True)
out=stage/'PERFORMANCE_SUMMARY.json'
out.write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({'output':str(out),'coexistingBufferLowerBound':record['memory']['includingKnownRetainedAtlasCachesArrayBufferBytesLowerBound'],'extraAtlasBytes':extra,'sha256':sha(out)}))
