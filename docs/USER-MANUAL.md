# Now This — User Manual

*For the app at **https://uiyonkimapac.github.io/focus-timer/** — updated 2026-06-27.*

**Now This** is an ADHD-first focus app: a Pomodoro timer + task list for **execution**, and a spatial "Mountain Board" map for **planning**. The name is the whole philosophy — *now this, this one thing*. This manual covers everything, desktop and mobile.

---

## 1. Getting started

### Open or install
- **Browser:** just open the link. No account, no signup. Data is stored on your device (localStorage).
- **Install as an app (recommended on phones):**
  - **iPhone/iPad:** Safari → Share → **Add to Home Screen**. Launches fullscreen with the etched-clock icon.
  - **Android:** Chrome → menu ⋮ → **Add to Home screen** (or the install prompt).
- **Offline:** after the first visit, the app — including sounds — works with no connection. (The font and the optional sync library load from the network the first time only.)

### The screen
- **Left panel** (top on phones): the **logo + theme toggle + sync badge**, the timer (mode buttons, ring, controls), the selected task's notes, and today's three stat cards.
- **Main area:** the **Tasks** tab (List or Map view) and the **Completed** tab, with **Reset Data** and **Save Report** in the top-right. *On phones, Reset Data moves to a recessive button at the bottom of the list so it's harder to tap by accident.*

---

## 2. The timer

| Control | What it does |
|---|---|
| **Focus / Short Break / Long Break** | 25 / 5 / 15 minute modes. In a break, the active break button takes on the blue break colour. |
| **▶ big button** | Start / pause (keyboard: **Space**) |
| **↺** | Restart the current session (keyboard: **R**) |
| **⏭** | Skip to the end of the session |
| **Session dots** | Your place in the classic 4-pomodoro cycle |

The selected task's remaining time drives the countdown; finishing a focus session credits focused minutes (these feed your Save Report and sync) and plays a completion sound. A thin progress bar runs along the very top of the page.

**The active pill** under the ring always shows which task the timer is counting down — or "No task selected".

**Notes:** the notepad under the timer belongs to the *selected task* — links, sub-steps, thoughts. It saves as you type and follows the task (it's disabled until you select one).

**Today's stats** — three cards under the timer, all scoped to *today* (they reset at midnight):
- **Focused** — time you've actually focused today (counts up minute by minute while the timer runs).
- **Remaining** — total time still allocated across your active tasks.
- **Done** — tasks you completed today.

---

## 3. Tasks (List view `≡`)

### Adding tasks
- Type a name, pick a length from the **minutes dropdown** (1 min–2 hr), optionally choose a category → **+ Add**. *On phones the add box is collapsed behind a **+ Add a task** button so your list stays in view — tap it to open (it focuses the field and stays open for several adds).*
- **🧠 Dump Tasks** — the brain-dump door. Paste or type *many lines at once* (one task per line; blank lines skipped, duplicates ignored). Works great for pasting from Google Tasks or notes. Get it out of your head first, organize later.

### Anatomy of a task card
| Element | Tap/click | Notes |
|---|---|---|
| **⋮⋮ handle** | Drag to reorder | On touch: press the handle, or **long-press anywhere on the card** (~0.4s), then drag |
| **MIT** | Toggle Most Important Task | The card gains an **amber/gold** accent and bold name; only one star matters — keep it honest |
| **○ circle** | Complete the task | Moves to Completed with a timestamp |
| **Task name** | Double-click to rename (or use ✎) | |
| **Time badge** | Quick-set 15/25/30/45/60m | |
| **🌙** | "Not today" — snooze until tomorrow | The task mists out but stays visible (object permanence!). Auto-returns at midnight. Three snoozes in a row → red **FACE IT!** badge |
| **▶** | Select this task and start the timer | |
| **✎ / ✕** | Rename / delete | Delete shows an **Undo** toast |

### Categories
- Create them from the category dropdown (10-color picker). Each group header shows a count + total time remaining.
- **Collapse** a group by clicking its header; **reorder lanes** by dragging the header (⋮⋮ grip).
- **Rename, recolor, or delete** a category from its **color dot** → the **Edit category** popup. Delete is a deliberate button there (it asks first); a deleted category's tasks move to **Uncategorized** — nothing is lost.
- **🗂 Manage categories…** (bottom of the category dropdown) lists **every** category — including empty ones that no longer appear in the list — with live task counts. Rename/recolor (✎) or delete (✕) each; the window stays open so you can clean out several stale categories in one visit.
- Drag a task **onto another group's header** (or onto a task inside it) to move it there.
- "Uncategorized" stays anchored at the bottom.

### Toolbar
| Button | What it does |
|---|---|
| **≡ List / ⛰ Map** | Switch views (same tasks, two perspectives) |
| **⊞ Guides** | (Map only) toggle the axis guides |
| **⛶ Full map** | (Map only) **maximize the board** — hides the timer panel *and* the header/tabs/add-row above it, so the map fills the window. Toggle off to bring them back. |
| **◉ Focus Mode** | Hide everything except the current task — tunnel vision on demand |
| **⟳ Run** | Auto-loop your list for each task's set time, with optional breaks (see **Run mode** below) |
| **🧠 Dump Tasks** | Bulk-add (see above) |

*(Clear completed tasks from the **Completed** tab — see §5.)*

### Run mode (⟳)
Turn your list into a guided session. **⟳ Run** opens a setup sheet where you:
- **uncheck** any tasks you want to skip this run;
- **drag the ⋮⋮ grip** to reorder the queue (each row shows its time and, if it has one, its **category name**);
- set breaks **per gap**: tap the thin line *between* two rows to cycle **none / 5 min / 15 min** (the **Breaks (all gaps)** segment sets every gap at once, chips override individual ones).

**Start Run →** works each task for its set time, in order, full-screen.

**When a task's time runs out, nothing is taken from you.** The chime sounds, the clock flips to **−overtime** (amber, with a gentle re-chime at −5 min), and the timer keeps counting until *you* hit **✓ done** or **⏭ skip** — estimates are always wrong, and the overtime is tracked as real focused minutes. If you *want* Routinery-style auto-advance (hygiene routines: shower → teeth → dress), tick **Auto-advance when time's up** in setup; the choice is remembered.

**When a break ends,** the run waits on a **Ready** screen ("Next: …") — the next task's clock starts only when you tap **Begin →**, so minutes never get billed to a climb you haven't started.

### Routines (saved runs) ★
Like Routinery: build the routine once, keep it forever. Two ways to make one:
- **＋ New routine** (top of the Run sheet) opens the **builder** — name the routine, type steps directly (name + minutes), tap the line between steps to set that gap's break, press **Enter** on the last step to add another, drag **⋮⋮** to reorder. Your task list is never touched: a routine is its own thing until you start it.
- **☆ Save as routine** (bottom-left of the Run sheet) snapshots the current queue — steps, minutes, per-gap breaks, the auto-advance setting — under a name you choose.
- Saved routines appear as **cards at the top of the Run sheet**: tap one to start it, **✎** to edit it in the builder, **✕** to delete. They sync across devices.
- Starting a routine **creates its steps as real tasks** (grouped under a category named after the routine), so completions land in history and today's stats like any other task.
- **Exit a run early** and the unfinished steps are tidied off your list automatically (an **Undo** toast brings them back) — the routine template itself is never touched. Finished steps stay in history.

In the tab bar (top-right of the main area):
| Button | What it does |
|---|---|
| **Save Report** | Download a formatted **HTML** report — choose Active / Completed / Stats and a filename |
| **Reset Data** | Wipe all tasks and history (asks first — Save Report beforehand if in doubt). *On phones it lives at the bottom of the list, not the top bar.* |
| **☽ / ☀** (in the logo row) | Dark (ink) / light (parchment) theme |

---

## 4. The Mountain Board (Map view `⛰`)

Switch with **⛰ Map**. Every active task is a hand-etched **peak**; categories are **ranges** with serif territory names, drawn as stacked peaks joined by proximity. The map fills the area edge-to-edge. This is your *thinking* surface — nothing here schedules anything.

### Reading the map
- **Peak size** = allocated time. **Snow-capped golden peak** = your MIT. **Misted** = "not today". **Glowing** = the active task.
- **X axis** = duration along the hour ruler (1h–8h ticks).
- **Y axis** = priority (the center vertical axis — higher is more important).
- **Red tint past 8h** = you've planned more than a workday. Just a signal.
- **Names stay visible** under every peak so the board reads at a glance; the per-task **minutes** appear when a peak is active, your MIT, selected, or hovered (kept on-demand so a busy board doesn't get cluttered). Under each ridge: the category name.
- **⛶ Full map** maximizes the board (hides the timer panel and the header/tabs/add-row above it); **⊞ Guides** toggles the axis lines. *On phones, Map view already hides the list chrome so the board owns the screen.*

### Desktop controls
| Action | How |
|---|---|
| Select a task | Click a peak |
| Start/pause · complete | On the active peak: ▶/⏸ in the body · ✓ circle on the summit |
| Move a peak | Drag it (position is remembered; time is never changed by dragging) |
| Change category | Drag a peak until it **touches another range's peak or ridge**; drop on open ground to leave a category |
| Group two tasks | Drop one peak **onto** another (it glows green when they'd merge) |
| Delete / duplicate | Drag to the **🗑 trash** / **⧉ copy** zones that appear at the bottom |
| Add a task | **Double-click** empty ground |
| Retune a task in place | **Click** a peak → an etched popover: **−5 / +5** minutes, **click its name to rename** (Enter saves, Esc cancels), or **🌙 Not today** to snooze |
| Rename | **Double-click** a peak · **click** a range's name · or via the peak popover |
| Move a whole range | Drag the ridge/name band |
| Deselect | **Click empty ground** — clears the active peak and any multi-selection (a *running* timer is left alone) |
| Multi-select | Drag a box on empty ground (replaces the selection) · hold **Ctrl/⌘/Shift while dragging** to *add* the boxed peaks to it · **Ctrl/⌘-click** a peak to toggle it · running totals (count · categories · time) show in the HUD |
| Copy / paste / delete selection | **⌘/Ctrl+C**, **⌘/Ctrl+V**, **Delete** · **Esc** clears/cancels |
| Pan | **Middle-mouse drag** (Ctrl/⌘ now drives selection, not panning) |
| Zoom | Mouse wheel, trackpad pinch, or the **+/−** buttons (100% = the whole world, up to 400%) |

### Touch controls (phone/tablet)
| Action | How |
|---|---|
| Pan | One-finger drag on empty ground |
| Zoom | Two-finger pinch |
| Select | Tap a peak (also opens the popover: **−5/+5** time, **tap the name to rename**, **Not today**) |
| Move / recategorize / group / trash / copy | Drag a peak (same rules as desktop) |
| **Add a task** | **Long-press empty ground** (½s — a tick vibration confirms), release |
| **Rename a task** | **Long-press a peak**, release |
| Rename a range | Tap its name |

*(Marquee multi-select and copy/paste are desktop-only by design.)*

---

## 5. Completed tab

Every finished task with its completion timestamp, plus a summary. The List view also shows recent completed tasks inline (collapsed by default). Tools on this tab:
- **Export CSV** — download the completed log as a spreadsheet-friendly CSV.
- **Clear All** — empty the completed history.

For a richer, formatted snapshot (active + completed + stats), use **Save Report** in the tab bar (downloads HTML).

---

## 6. Sync across devices (optional)

Open **Sync** (the badge at the top of the left panel) → enter the **same sync code** on each device. Tasks, categories, history, and stats sync in realtime. Generate a fresh code with **✨ New** on your first device, then enter that code on the others. Without a code the app is 100% local — no cloud, no account.

### 🎛 Remote control

With sync connected, tap the **🎛 badge** (next to the sync badge) to open the Remote sheet. Every other device online with your sync code appears with a **live view of its timer** — running or paused, time left, and the task it's on. From there:

- **▶ / ⏸** — start or pause the timer *on that device*.
- **↺** — reset its current session.
- **⏭** — skip to the end of its session.

The other device reacts exactly as if you'd tapped it there — same sounds, stats, and overtime rules — and shows a small toast naming the device that sent the command. Rename how this device appears to others with the **This device** field at the top of the sheet. Commands are instant and never stored; if a device is offline it simply doesn't appear in the list.

---

## 7. Keyboard shortcuts

| Key | Where | Action |
|---|---|---|
| **Space** | Anywhere (outside inputs) | Start / pause the timer |
| **R** | Anywhere | Restart the session |
| **⌘/Ctrl + C / V** | Map | Copy / paste selected peak(s) |
| **Delete / Backspace** | Map | Delete selection (or the selected peak) |
| **Esc** | Map | Cancel a drag · clear the selection |
| **Enter / Esc** | Any inline input | Confirm / cancel |

---

## 8. Tips for ADHD brains (from the design)

1. **Start every day with Dump Tasks.** Empty your head; the list is the memory.
2. **Pick exactly one MIT.** The golden mountain is hard to ignore — that's the point.
3. **Use 🌙 instead of deleting.** It returns tomorrow; nothing is silently lost. When FACE IT! appears, do it first or break it into a smaller mountain.
4. **Plan on the map, execute on the list.** Arrange your day spatially, watch for the red 8h overflow, then switch to ≡ and run the timer.
5. **Focus Mode when the list itself is the distraction.**
6. **Glance at the Focused card** for a guilt-free read on the day — it counts the time you actually put in, not the time you meant to.

---

## 9. Troubleshooting

| Symptom | Fix |
|---|---|
| Sounds don't play | Tap/press something first — browsers require one interaction before audio |
| New version doesn't show up | The app updates on the next *online* refresh; close and reopen once |
| Long-press shows no keyboard (iOS) | Release your finger — the input opens on release, then the keyboard follows |
| Synced devices disagree | Last write wins; make sure both run the latest version and the same sync code |
| Lost everything? | If you exported, your **Save Report** HTML (or **Export CSV**) has the data. Reset Data warns before wiping |
| "Focused" shows 0m | It resets at midnight — it's today's focused time, so a fresh day starts at zero |

*Your data never leaves your device unless you turn on sync (your code, Supabase) — there are no accounts and no analytics.*
