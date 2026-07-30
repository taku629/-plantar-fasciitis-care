---
name: testing-plantar-fasciitis-care
description: How to run the plantar-fasciitis-care static PWA locally and reliable tricks for UI/monkey testing it (coordinate mapping, toast verification, console-eval gotchas, SW stale-cache pitfall, quota-forcing trick).
---

# Testing 足底腱膜炎ケア手帳 (static PWA)

## Run it
- Static files, no build: `cd /home/ubuntu/repos/plantar-fasciitis-care && python3 -m http.server 8080`, open `http://127.0.0.1:8080/`.
- Structure: 5 bottom tabs (ホーム/体操/記録/グラフ/レポート) + gear icon top-right = 設定. Timer is a fullscreen overlay `#timerOverlay`.
- Persistence: single `localStorage` key `sokuteiData` (JSON `{settings, days}`). Corrupt it via `localStorage.setItem('sokuteiData', ...)` then reload to test recovery.

## Devin secrets needed
- None (fully local, no auth, no backend).

## Coordinate mapping (computer tool)
The tool's screenshot space is 1024x768 but the page viewport is ~1600x1069 and scaling is non-uniform. Calibrate first with `document.elementFromPoint` + `getBoundingClientRect` rather than trusting raw screenshot coordinates. Empirical mapping on this box: `page_x = ss_x * 1.5625`, `page_y = ss_y * 1.587 - 104`. Bottom nav buttons sit at ss y≈722 (NOT the visually-apparent ~678 — that's page content).

## browser_console gotchas
- Expressions must be wrapped `(function(){...})()` and return a value to serialize.
- It does NOT await promises — for async work store into `window.__var` and read it in a second call.
- Click-burst monkey loop that worked: query `button, .chip, [data-pain], [data-step], [data-standing], [data-shoe], [data-range], [data-week], [data-goto], [data-timer], [data-didset], .nav-btn`, filter `offsetParent && !disabled`, exclude blocking-dialog buttons (`#importBtn,#wipeBtn,#printBtn,#remindToggle,#copyReportBtn,#exportBtn` — they open native prompt/confirm/print/permission dialogs which freeze JS bursts and require keyboard), random `.click()` in a `setInterval`.

## Verifying transient UI
- Toast `#toast` lives ~1.8s — screenshots usually miss it. Verify via DOM: `document.getElementById('toast').textContent` / classList.
- Native dialogs (import prompt, wipe confirm, print, clipboard/notification permission) cannot be clicked via coordinates reliably — use keyboard (Escape=Cancel, Return=OK, type+Return for prompt) or handle via console.

## Service Worker pitfall
`sw.js` v5 uses network-first (`CACHE = "sokutei-care-v5"`; previously cache-first v4). If the page behaves like an OLD build (features missing, e.g. no 使いやすさ/リマインド cards in settings), you're running a stale cached app.js — check `caches.keys()` / app.js byte length vs disk, then unregister SW + `caches.delete` + hard reload.

**Wedged registration recovery:** a manual `registration.unregister()` (or deleting the on-disk `Service Worker` dir under a running Chrome) can leave a zombie registration — `getRegistration()` returns an object with NO active/installing/waiting worker, `ready` never resolves, `update()` throws "invalid state", and even `chrome://serviceworker-internals` Unregister/Start buttons + `siteDetails` "Delete data" won't clear it (worker stuck STARTING, tied to a dead renderer). Reliable recovery: `kill` the `storage.mojom.StorageService` utility process (respawns clean) — or if that fails, fully restart Chrome (`kill <main pid>` then relaunch with the same flags — user-data-dir `/home/ubuntu/.browser_data_dir`, `--remote-debugging-port=29229`; the computer tool reconnects automatically). App keeps working meanwhile since register().catch() swallows errors — only reminder/offline features degrade.

## Validation boundaries worth probing
`normalizeState()`/`sanitizeDay()` validate the top-level envelope AND all `days.*` fields (pain 0-10 clamp, steps 0-200000, whitelisted standing, shoes string-array ≤10, notes ≤5000 chars, exercise ids whitelisted ≤20, date keys `^\d{4}-\d{2}-\d{2}$`) — BUT `settings` field TYPES pass through raw: `shoePresets` non-array crashes renderLog (`.map`) + renderSettings (`.join`); `anonId` non-string + share:true crashes renderSettings (`.slice`). Also `{"foo":1}`-style objects (no settings/days keys) normalize to a valid EMPTY state — import accepts them and wipes all data with a success toast. Probe these via `normalizeState(payload)` in console before reload-testing.

## Forcing save() failure (quota test)
Chrome localStorage quota ~5MB on this box (varies by profile). Same-size value REPLACEMENTS on an existing key still succeed at quota — to force `QuotaExceededError` you must make the serialized state GROW (e.g. inflate `state.days[today].notes` to ~3MB in memory, then trigger a UI save via a pain button). NOTE: `save()`'s error toast can be overwritten by the handler's own success toast (`記録しました`) — verify via localStorage contents, not just the toast.
