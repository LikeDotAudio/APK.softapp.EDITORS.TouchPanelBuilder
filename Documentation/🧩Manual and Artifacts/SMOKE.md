# Smoke test — EDITORS.TouchPanelBuilder

Is `EDITORS.TouchPanelBuilder` deployed? Written by `.apk.scripts/smoke.py` from the module's own shape; what each check means is in that script's header.

← [Wiki home](../README.md)

**❌ FAIL** — 2/3 checks, since 2026-11-12 00:16 EST

| Check | Target | Result | Detail |
|---|---|---|---|
| pushed | [APK.softapp.EDITORS.TouchPanelBuilder](https://github.com/LikeDotAudio/APK.softapp.EDITORS.TouchPanelBuilder.git) | ❌ | 1 commit(s) not pushed |
| web | [index.html](https://apk.audio/APK%3ASoftapps/EDITORS/EDITORS.TouchPanelBuilder/index.html) | ✅ | HTTP 200 |
| app | `OS/Touch Panel Builder` → `PODS/POD.THIN/Softapps/EDITORS/EDITORS.TouchPanelBuilder/index.html` | ✅ | present |

Re-run: `python3 .apk.scripts/smoke.py PODS/POD.THIN/Softapps/EDITORS/EDITORS.TouchPanelBuilder`

<!-- smoke:sig afb35e848739 since 2026-11-12 00:16 EST -->
