# Synthetic demo creators: provenance

These are AI-generated faces of people who do not exist, made by us for demos. No stock photos, no images of unknown
origin, no real person. Each file's sha256 is the `capture_sha256` its testnet account registers on the contract.

| File | Name in the app | Made | How | Prompt (summary) | sha256 |
|---|---|---|---|---|---|
| `asha.jpg` | Asha | 4 Nov 2026 | Rohit's earlier hackathon project (the "synthetic demo creator" asset, request `wfjqaoqTF_LTi9sPptbJ-Q8`), copied unchanged | a fictional adult woman in her late twenties, neutral expression, plain grey background | `e5b69388fda5ca383cc7f3a7d3208e6cbd9cdd8b0cff72903a566a2b5210c642` |
| `maya.jpg` | Maya Lindqvist | 13 Nov 2026 | NEAR AI Cloud, FLUX.2-klein-4B `/images/generations` (`web/scripts/synthetic-faces.ts`, request `77fc617d-2884-47c0-9f04-9b32040a538c`), unchanged | a fictional adult woman in her late twenties, a fitness coach, ponytail, teal sports top | `2be7556bab0363203b32328ec9c6a9d397a430c7cacde06b02fdb8efbdf4b7f0` |

Asha's prompt began "A photorealistic head-and-shoulders portrait photograph of a fictional adult who does not exist
(not a real or famous person)"; Maya's full prompt is in `web/scripts/synthetic-faces.ts` and ends "This is
a fictional person who does not exist. The face must be entirely invented and must not resemble any real person,
celebrity, public figure or famous person." The full origin is in `docs/HACKATHON.md`.
