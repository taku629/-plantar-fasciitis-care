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
`sw.js` uses cache-first (`CACHE = "sokutei-care-v4"`). If the page behaves like an OLD build (features missing, e.g. no 使いやすさ/リマインド cards in settings), you're running a stale cached app.js — check `caches.keys()` / app.js byte length vs disk, then unregister SW + `caches.delete` + hard reload. Note: after manual `registration.unregister()` the registration can be left zombie (no active worker; `navigator.serviceWorker.ready` never resolves) — app still works because register().catch() swallows errors, but reminder features silently no-op.

## Forcing save() failure (quota test)
Chrome localStorage quota ~10-14MB here. Same-size value REPLACEMENTS on an existing key still succeed at quota — to force `QuotaExceededError` you must make the serialized state GROW (e.g. inflate `state.days[today].notes` to ~3MB in memory, then trigger a UI save via a pain button).
