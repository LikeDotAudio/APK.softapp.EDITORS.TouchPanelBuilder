# Delivery — EDITORS.TouchPanelBuilder

How it is built, shipped, and where it lands.

← [Wiki home](../README.md)

- **No build.** Plain ES modules, loaded as they are.
- **Test:** `npm test` in this repo (node `--test`); every module but the app class runs in node.
- **Ship locally:** it is baked into the WEB.Frontend-Assets image — after an edit, `bash PODS/POD.manager/MANAGER.Docktor/K8/up-stack.sh WEB.Frontend-Assets`; served at `http://localhost:8080/Softapps/EDITORS/EDITORS.TouchPanelBuilder/`.
- **Ship publicly:** with apk.audio — `python3 .apk.scripts/deploy_all.py` (or `--site apk.audio`) from the monorepo root uploads Softapps over FTPS.
- **Depends on:** WEB.OsApi (`/api/instrument/api`, `/api/devices`), DATABASE.server.BIM (`/api/bim/instances`, optional), WEB.Frontend-Assets (`/FrontEnd/api/tree.json`, `/FrontEnd/apkos-frame-host.html`; absolute placement since a61871c8).
- **Commit and sync:** commit in this repo, push, bump the monorepo pointer — `python3 .apk.scripts/deploy_all.py --no-deploy`.

## Delivered 2026-11-04

Library-wired controls (185 devices, ~39,000 variables); device theme and a true-scale glass; 1,096 looks (69 era looks incl. Ward-Beck Systems and UREI, plus the widget library) with distinct hardware and a live engine view; bench liveness; page tabs; Set/Do/Rig/Get/Nab sub-categories and grab bags; drag a device for its whole palette; push-and-hold copy; frame export / import; engine glass and engine preview (ROAD-3499, closed).

## Delivered 2026-11-11 – 2026-11-12

From this repository's own commits (the commit message is the record):

- vendor: apk-contracts web bundle refreshed from contracts/generated/web (report.ts: LogLine + ProblemRecord, System/Problems family) (`b32a13e`)
- Edit opens the panel the device window shows: its frames, its crosspoints, every element wired (`4ea736f`)
- vendor/apk-softapp: re-vendored — every problem card is reported through the SDK (ROAD-3695 step 2) (`868947f`)
- ROAD-3687: ?bim=<part> draws a BIM part's own panel template, no unit — run.html and the builder (`231f1b0`)
- touchPanelApp.js: take back another session's uncommitted ROAD-3697 hunks that 231f1b0 swept in (`e7af9b0`)
- vendor: apk-contracts web bundle refreshed from contracts/generated/web (five report codes, ROAD-3695; unit-gate, ROAD-3684) (`90c75e7`)
- ROAD-3697: the glass and a saved panel keep the device window's addresses; the glass is a read-only mirror (`ecec314`)
- ROAD-3697: a crosspoint stand-in is content-box, as the engine's button, so its wire leaves the drawn button's middle (`c4a320c`)
- re-vendor apk-contracts web bundle: contracts 2.4.0 retires APK.audio/Tests/{suite} (ROAD-3729) (`a5b313a`)
- ROAD-3730: the glass and a saved panel address a device field by the box (Devices/<serial or key>/<frame path>) (`ce7bd5f`)
- A komand_readout listens on the topic it names (the 4263A's Status, primary, secondary reads <box>/Read, not Reading/Read_IDN); the IDN lands only on a control bound to it, never on Make · Model by its label (`33d4859`)

## Releases
- **Released `2.0.0`, tag `v2.0.0`** (2026-11-05, ROAD-3452, the owner's V2) — no SDK pin; every manifest says 2.0.0; GitHub release `v2.0.0`.
