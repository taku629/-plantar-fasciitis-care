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
- Click-burst monkey loop that worked: query `button, .chip, [data-pain], [data-step], [data-standing], [data-shoe], [data-range], [data-week], [data-goto], [data-timer], [data-didset], [data-font], [data-flag], [data-hstar], [data-hvisit], [data-hdel], [data-cal], [data-delphoto], .nav-btn, .hosp-star, summary`, filter `offsetParent && !disabled`, exclude blocking-dialog buttons (`#importBtn,#wipeBtn,#printBtn,#remindToggle,#copyReportBtn,#exportBtn,#lineShareBtn,#addPhotoBtn` — they open native prompt/confirm/print/permission/file-picker dialogs or `window.open` external tabs which freeze JS bursts), random `.click()` in a `setInterval`. A burst that clicks `[data-cal]` will legitimately leave `logDate` on a random past date — not a bug.

## Verifying transient UI
- Toast `#toast` lives ~1.8s — screenshots usually miss it. Verify via DOM: `document.getElementById('toast').textContent` / classList.
- Native dialogs (import prompt, wipe confirm, print, clipboard/notification permission) cannot be clicked via coordinates reliably — use keyboard (Escape=Cancel, Return=OK, type+Return for prompt) or handle via console.

## Service Worker pitfall
`sw.js` v5 uses network-first (`CACHE = "sokutei-care-v5"`; previously cache-first v4). If the page behaves like an OLD build (features missing, e.g. no 使いやすさ/リマインド cards in settings), you're running a stale cached app.js — check `caches.keys()` / app.js byte length vs disk, then unregister SW + `caches.delete` + hard reload.

**Wedged registration recovery:** a manual `registration.unregister()` (or deleting the on-disk `Service Worker` dir under a running Chrome) can leave a zombie registration — `getRegistration()` returns an object with NO active/installing/waiting worker, `ready` never resolves, `update()` throws "invalid state", and even `chrome://serviceworker-internals` Unregister/Start buttons + `siteDetails` "Delete data" won't clear it (worker stuck STARTING, tied to a dead renderer). Reliable recovery: `kill` the `storage.mojom.StorageService` utility process (respawns clean) — or if that fails, fully restart Chrome (`kill <main pid>` then relaunch with the same flags — user-data-dir `/home/ubuntu/.browser_data_dir`, `--remote-debugging-port=29229`; the computer tool reconnects automatically). App keeps working meanwhile since register().catch() swallows errors — only reminder/offline features degrade.

## Validation boundaries worth probing
`normalizeState()`/`sanitizeDay()`/`sanitizeHospital()` now validate the envelope, all `days.*` fields (pain 0-10 clamp, steps 0-200000, whitelisted standing, notes ≤5000 chars, exercise ids whitelisted ≤20, weight 20-300, meds/clinic bools, photos `data:image/` prefix ≤4, date keys `^\d{4}-\d{2}-\d{2}$`), settings field types (shoePresets array, font whitelist, booleans, anonId string-or-null), and hospital objects — AND reject objects lacking BOTH `settings` and `days` keys (`{"foo":1}` → "データの形式が正しくありません", data preserved). REMAINING gaps found in v1343: (1) `wipeBtn` rebuilds `state` WITHOUT a `hospitals` key → `renderHome` throws on `state.hospitals.length` → home frozen at stale pre-wipe DOM until reload (normalizeState heals it); (2) `day.shoes` accepts ANY string → rendered raw in the shoe-correlation advice line → stored XSS; (3) `day.photos` prefix check allows `data:image/x" onerror=...` → unescaped `<img src>` attribute breakout → stored XSS; (4) `?tab=` init guard `renderers[tabParam]` truthiness-checks a plain object → `?tab=toString`/`__proto__`/`constructor` pass it, then `$("#tab-"+tab)` is null → blank page on load (recoverable by tapping a tab). Probe sanitize via `normalizeState(payload)` in console before reload-testing.

## Forcing save() failure (quota test)
Chrome localStorage quota ~5MB on this box (varies by profile). Same-size value REPLACEMENTS on an existing key still succeed at quota — to force `QuotaExceededError` you must make the serialized state GROW (e.g. inflate `state.days[today].notes` to ~5KB in memory, then trigger a UI save via a pain button). As of v1343 `save()` returns bool and handlers gate the success toast on `if(ok)` — the error toast「保存できませんでした…」now stays visible (verify toast text via DOM, plus mem-vs-LS divergence which is expected).

## Environment/tooling quirks (don't misreport as app bugs)
- The Devin browser DOM annotation strips `target` attributes from rendered anchors and adds `devin-*` attrs — `a.getAttribute('target')` returns null even though source has `target="_blank"`. Verify links against app.js source, not DOM.
- `document.getElementById('x').open = true` on a `<details>` fires the `toggle` event ASYNC — module-level flags (e.g. `moreOpen`) stay stale if you render-trigger synchronously right after. Insert `setTimeout` settles in synthetic tests; human taps are slow enough not to hit it.
- Chrome on this box reaches some external sites (line.me loaded fine) but `fetch` to `eutils.ncbi.nlm.nih.gov` hangs indefinitely while curl succeeds in 0.4s — the feed card「読み込み中…」sticking is partly this proxy; app still has no fetch timeout (a real minor gap).
