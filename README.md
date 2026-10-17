# Havens of the Drift evidence archive

Orphan branch holding review-capture binaries removed from `main` on 2026-10-17 to keep working clones small. Nothing here is a runtime asset or a build dependency.

| Folder | Files | Source |
|---|---|---|
| `docs/rider-c02/evidence/` | 664 | Rider C02 clothing, layering, fidelity, QA captures |
| `docs/rider-blender-trial/evidence/` | 147 | Authored Blender rider trial captures and measurement JSON |

`EVIDENCE_MANIFEST.json` lists every file with its SHA-256 as it stood at main `18a7aab`. The review markdown that cites these captures stays on `main` at the original paths.

Fetch on demand: `git fetch origin archive/evidence-2026-10-17 && git checkout archive/evidence-2026-10-17 -- docs/rider-c02/evidence`.

Intended final home: a private `rporter33/havens-archive` repository. Push this branch there with `git push <archive-remote> archive/evidence-2026-10-17:main` once that repository exists.
