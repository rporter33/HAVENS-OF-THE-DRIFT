# Evidence moved to the archive branch

The capture binaries that lived here were moved on 2026-10-17 to the private repository [`rporter33/havens-archive`](https://github.com/rporter33/havens-archive) (its `main`, pushed from this repository's orphan branch `archive/evidence-2026-10-17`, commit `eff904a`) to keep working clones small. Per-file SHA-256 hashes as of main `18a7aab` are in [the archive manifest](../../history/EVIDENCE_ARCHIVE_MANIFEST.json).

Restore locally: `git fetch origin archive/evidence-2026-10-17 && git checkout archive/evidence-2026-10-17 -- docs/rider-blender-trial/evidence`
