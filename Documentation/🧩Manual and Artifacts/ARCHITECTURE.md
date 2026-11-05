# Architecture — EDITORS.TouchPanelBuilder

How the designer is built: one page (`index.html`) and one app class over a set of pure modules, each tested in node.

← [Wiki home](../README.md)

## Modules

| Module | Role | Pure? |
|---|---|---|
| `js/touchPanelApp.js` | The app: device / variable columns, the glass, page tabs, wires, the schedule and its editors, the Look Library, engine glass and preview, grab bags, open / save. | DOM |
| `js/library.js` | The control library: instrument catalogue and per-model variables (WEB.OsApi), the bench and its liveness (BIM `/api/bim/instances`, else `/api/devices`). | yes |
| `js/palettes.js` | A device's palette: Set / Do / Rig / Get (Nab under Get) → sub-categories; grab bags; the default whole-device filter; its ins and outs. | yes |
| `js/controls.js` | The stand-in controls (fader, knob, button, meter, tile, readout, LTP, MDP, CMDP, VU, selector, rig, nab), drawn from CSS variables; style and behaviour field lists; style presets. | yes |
| `js/lookLibrary.js` | Vintage looks (consoles, Ward-Beck Systems, UREI & outboard, synths, tape) and the widget-library harvest. | yes |
| `js/copyControl.js` | Push-and-hold copy. | yes |
| `js/frameExport.js` | Panel ↔ Gui_Frames `OcaBin`. | yes |
| `js/devicePanel.js` | A device's presented panel or api.json → a starting panel; device tabs; the panel's link (ROAD-3503). | yes |
| `js/savedPanel.js` | A device's saved panel, retained on the bus (ROAD-3503). | yes |
| `js/runner.js`, `js/runPanel.js`, `run.html` | The running panel: a touch puts the command on the wire through KOMAND. | runner DOM / runPanel pure |
| `js/touchPanelHost.js` | The `touch_panel` block over `cad.like.audio/host@1`. | yes |

## Data

```
panel = { id, name, room, width, height, screenPreset,
          theme: { id?, preset, base?, style },        // device theme
          savedLooks: [look],                            // library looks used as a theme
          pages: [{ id, name }],                         // the tabs
          widgets: [{ id, type, label, x, y, w, h, page, address, channel,
                      style?, behavior?, lookId?, field?,   // look and its library element
                      bindings: [{ id, family, model, verb, command, scpi, topic, device }] }] }
```

A control's effective style is `theme.base ⊕ theme.style ⊕ widget.style` (`effectiveStyle`).

## The glass and the engine

- The stand-ins in `controls.js` draw from CSS custom properties (`--w-bg`, `--w-cap`, …) set per control by `widgetStyleVars`.
- **Engine glass** puts `FrontEnd/apkos-frame-host.html` in an iframe beside the surface and posts it the open page as a frame (`panelToFrame`, bin cover and block title off). The engine places each field absolutely (`layout.position: absolute`, `left/top`) inside a block with `layout.mode: absolute` — opt-in support added to WEB.Frontend-Assets' `frameLayout/` (OcaBlock.jsx, WidgetFactory.jsx). The stand-ins stay on top, invisible, so editing is unchanged.
- **Engine preview** draws the whole panel; **Export Frame** downloads it; **Open** reads a frame or a block.
- The Look Library's **Live** view posts a library frame to the same host and turns a click on any `[data-oca-path*=".fields."]` element into a look.

## Grab bags and device palettes

`dropGrabBag({ key, verb, sub })` loads the model's variables, picks them (`grabBag`, or `paletteFilter` for a whole device), lays them out with `devicePanel.panelFromVariables` and appends the result as new pages named after the device and the bag — nothing already on the glass moves.

## Tests

`npm test` — node's own runner over `tests/*.test.mjs` (73 at the time of writing): library and liveness, palettes against the real 34401A / 33220A api.json, looks and hardware variety, push-and-hold, frame export / import and round trips through devicePanel, host@1 round trips, the discovered panel, the runner's wire format, saved panels.
