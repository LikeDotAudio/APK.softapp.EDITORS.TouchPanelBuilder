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
- docs(smoke): pass — results in the wiki (`f4c9cdb`)
- The page grows to the screen; every control on the glass moves and scales, the meter face and trend chart with it (`dc22649`)
- Fit the window: count the tabs' margins and keep the scroll-bar gutter, so a page taller than the stage never side-scrolls (`975b602`)
- run.html is the one renderer of a box's touch panel; a readout shows its own command's reading; FETCH READING stays on its page (`1e52e0d`)
- The deck: the family GUI file's pages first, the added pages (RIG, NAB, TRACE) after — everywhere the panel is drawn (`707524f`)
- run.html inside an OS window: its strip keeps the open frame's continuation pages (SYSTEM ADMIN 2, 3) as well as the added ones (`5ab3282`)
- Everything in / Everything over time: every answer the unit gives, one meter and one trend each, on every device's touch panel (owner 2026-11-12) (`38c46d7`)
- Fader: drag the cap, send once on release; readings shown to sensible precision (`962f38c`)
- ROAD-3746: run.html for a real unit hands off to its OS device window (`89504f2`)
- vendor: apk-contracts re-vendored (contracts gained the youtube_audio problem codes, root f013ba68a) (`c7792d2`)
- vendor/apk-contracts: refresh to contracts/generated/web after ROAD-3759 (contracts split; CHAT_TOPIC origin note) (`d38cf6e`)
- ROAD-3766: touchPanelApp.js split into mixin modules (2,436 -> 233 lines) (`a4a4221`)
- vendor: apk-softapp / apk-table re-joined from their parts (one GENERATED banner line; ROAD-3762) (`387271e`)

## Releases
- **Released `2.0.0`, tag `v2.0.0`** (2026-11-05, ROAD-3452, the owner's V2) — no SDK pin; every manifest says 2.0.0; GitHub release `v2.0.0`.
