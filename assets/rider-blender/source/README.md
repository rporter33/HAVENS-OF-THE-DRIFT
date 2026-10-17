# Rider Blender masters (archived)

`rider-trial.blend` (22 MB) and its six companion files (construction, fitting cages, bind-mesh reference, Windkeel fitting, texture source, measured construction SVG) moved on 2026-10-17 to the private repository [`rporter33/havens-archive`](https://github.com/rporter33/havens-archive) under `assets/rider-blender/source/`, commit `f84dc14`. Restore was verified from a fresh clone (26/26 hashes). Per-file SHA-256: `MASTERS_AND_SCRIPTS_MANIFEST.json` in that repository, mirrored in [the asset register](../../catalog/register.json).

The accepted runtime export `src/assets/rider-blender/rider-trial.glb` stays in this repository.

Restore locally before running `scripts/rider-blender-author.py`, `rider-blender-export.py` or `rider-blender-windkeel.py`:

```
git clone --depth 1 --filter=blob:none --sparse https://github.com/rporter33/havens-archive /tmp/havens-archive
git -C /tmp/havens-archive sparse-checkout set assets/rider-blender/source
cp /tmp/havens-archive/assets/rider-blender/source/* assets/rider-blender/source/
```
