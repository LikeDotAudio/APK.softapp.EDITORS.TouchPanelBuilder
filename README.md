# EDITORS.TouchPanelBuilder — Touch Panel & Control Surface Designer

**Wiki:** [Documentation/README.md](Documentation/README.md) — principles, architecture, delivery.

Design a touch panel on the real glass of a real panel, wire any control to anything a device on the bench can be told to do, dress it in any look from the widget library or a vintage console, and hand it to the OS as a frame it runs.

| | |
|---|---|
| **Opens** | the OS shell (Design → Surfaces & Controls), or `index.html` standalone; `run.html` runs a panel |
| **Reads** | the instrument library through WEB.OsApi (`/api/instrument/api`, `/api/devices`), the bench through DATABASE.server.BIM (`/api/bim/instances`), the widget library (`/FrontEnd/api/tree.json`), devices' presented panels on the bus |
| **Writes** | a `touch_panel` block to the CAD (`cad.like.audio/host@1`), standalone the `.json` beside its `.ifc` twin (Save Model: the panel an IfcUnitaryControlElement CONTROLPANEL in its room, the layout by hash, `js/touchPanelIfc.js`), a Gui_Frames `.frame.json`, a device's saved panel retained on the bus |
| **Build** | none — plain ES modules; `npm test` (node's own runner) |
| **Ships** | baked into WEB.Frontend-Assets (`up-stack.sh WEB.Frontend-Assets`), served at `:8080/Softapps/EDITORS/EDITORS.TouchPanelBuilder/` |

## In one screen

- **Left — Control Devices.** Online and recently online boxes pinned at the top (orange = status unknown), offline ones kept greyed so bindings survive, then the whole instrument library by family. Drag a device onto the glass to bring its whole palette; ▣ opens a box's own panel in the OS.
- **Centre — the glass.** True resolution (1280 × 800 …) scaled to fit; page tabs across the top; ⚙ Engine glass draws the page with the real widget engine.
- **Right — Controllable Variables.** Per device its ins and outs, then Set / Do / Rig / Get / Nab and their sub-categories; every level is a grab bag (⊞).
- **Bottom — the schedule.** Every control's address, bindings, place and size; pops out; each row opens a Look and a Behaviour editor.

Wire by dragging a variable onto a control (or onto bare glass to make one), a control's ● port onto a variable, or ＋. Push and hold a control to copy it with all its wiring.

<!-- wiki:smoke -->
<!-- /wiki:smoke -->
