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

## Releases
- **Released `2.0.0`, tag `v2.0.0`** (2026-11-05, ROAD-3452, the owner's V2) — no SDK pin; every manifest says 2.0.0; GitHub release `v2.0.0`.
