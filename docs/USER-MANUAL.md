# Focus Timer — User Manual

*For the app at **https://uiyonkimapac.github.io/focus-timer/** — updated 2026-06-15.*

Focus Timer is an ADHD-first focus app: a Pomodoro timer + task list for **execution**, and a spatial "Mountain Board" map for **planning**. This manual covers everything, desktop and mobile.

---

## 1. Getting started

### Open or install
- **Browser:** just open the link. No account, no signup. Data is stored on your device (localStorage).
- **Install as an app (recommended on phones):**
  - **iPhone/iPad:** Safari → Share → **Add to Home Screen**. Launches fullscreen with the mountain icon.
  - **Android:** Chrome → menu ⋮ → **Add to Home screen** (or the install prompt).
- **Offline:** after the first visit, the entire app — including sounds — works with no connection.

### The screen
- **Left panel** (top on phones): the timer — mode buttons, ring, controls, per-task notes, today's stats, and your editable motivational banner at the bottom.
- **Main area:** the **Tasks** tab (List or Map view) and the **Completed** tab.

---

## 2. The timer

| Control | What it does |
|---|---|
| **Focus / Short Break / Long Break** | 25 / 5 / 15 minute modes |
| **▶ big button** | Start / pause (keyboard: **Space**) |
| **↺** | Restart the current session (keyboard: **R**) |
| **⏭** | Skip to the end of the session |
| **Session dots** | Your place in the classic 4-pomodoro cycle |

The selected task's remaining time drives the countdown; finishing a session logs focused minutes to your stats and plays a completion sound. A thin progress bar runs along the very top of the page.

**Notes:** the notepad under the timer belongs to the *selected task* — links, sub-steps, thoughts. It saves as you type and follows the task.

### Your motivational banner
At the bottom of the left panel sits a two-line mantra (default: *"Now or Never! / Right Now, Right Here"*). Make it yours:

- **Edit the words:** click either line and type. **Enter** (or click away) saves; **Esc** also saves and exits. Clear a line and its default shows faintly as a placeholder. Pasted text is flattened to plain text so it can't break the styling.
- **Restyle it:** hover the banner and click **Aa · style**. A small panel lets you set, **per line**:
  - **Font** — 6 faces (script, handwritten, two serifs, a bold display, clean sans).
  - **Size** — a slider, 14–72px (recommended 28–48px for the headline, 18–30px for the subline).
  - **Color** — 8 swatches (Accent, Theme, Gold, Teal, Sky, Violet, White, Black). *Theme* adapts to dark/light automatically.

  Changes apply instantly and are saved to this device. *(The banner is desktop-only; it's hidden on narrow phone screens to save space.)*

---

## 3. Tasks (List view `≡`)

### Adding tasks
- Type a name, pick minutes (the **1m–1h chips** or the minutes box), optionally a category → **+ Add**.
- **🧠 Dump Tasks** — the brain-dump door. Paste or type *many lines at once*; each line becomes a task with the default time you pick. Get it out of your head first, organize later.

### Anatomy of a task card
| Element | Tap/click | Notes |
|---|---|---|
| **⋮⋮ handle** | Drag to reorder | On touch: press the handle, or **long-press anywhere on the card** (~0.4s), then drag |
| **MIT** | Toggle Most Important Task | The card turns golden; only one star matters — keep it honest |
| **○ circle** | Complete the task | Moves to Completed with a timestamp |
| **Task name** | Double-click to rename (or use ✎) | |
| **Time badge** | Quick-set 15/25/30/45/60m | |
| **🌙** | "Not today" — snooze until tomorrow | The task mists out but stays visible (object permanence!). Auto-returns at midnight. Three snoozes in a row → red **FACE IT!** badge |
| **▶** | Select this task and start the timer | |
| **✎ / ✕** | Rename / delete | Delete shows an **Undo** toast |

### Categories
- Create them from the category dropdown (10-color picker). Each group header shows a count + total time remaining.
- **Collapse** a group by clicking its header; **rename/recolor** via the color dot; **reorder lanes** by dragging the header (⋮⋮ grip).
- Drag a task **onto another group's header** (or onto a task inside it) to move it there.
- "Uncategorized" stays anchored at the bottom.

### Toolbar
| Button | What it does |
|---|---|
| **≡ List / ⛰ Map** | Switch views (same tasks, two perspectives) |
| **⊞ Guides** | (Map only) toggle the axis guides |
| **◉ Focus Mode** | Hide everything except the current task — tunnel vision on demand |
| **✓ Clear Done** | Archive all completed tasks |
| **🧠 Dump Tasks** | Bulk-add (see above) |
| **💾 Save Report** | Download a formatted HTML report — choose Active / Completed / Stats, pick a filename |
| **Reset Data** | Wipe everything (asks first — Save Report beforehand if in doubt) |
| **☽ / ☀** | Dark (ink) / light (parchment) theme |

---

## 4. The Mountain Board (Map view `⛰`)

Switch with **⛰ Map**. Every active task is a hand-etched **peak**; categories are **ranges** with serif territory names. This is your *thinking* surface — nothing here schedules anything. The map **fills the available space edge to edge** (no wasted margins) and re-fits itself when you resize the window or rotate your phone.

### Reading the map
- **Peak size** = allocated time. **Snow-capped golden peak** = your MIT. **Misted** = "not today". **Glowing** = the active task.
- **X axis** = duration along the hour ruler (1h–8h ticks).
- **Y axis** = priority (the center vertical axis — higher is more important).
- **Red tint past 8h** = you've planned more than a workday. Just a signal.
- Under each peak: its name and time. Under each ridge: the category name.

### Desktop controls
| Action | How |
|---|---|
| Select a task | Click a peak |
| Start/pause · complete | On the active peak: ▶/⏸ in the body · ✓ circle on the summit |
| Move a peak | Drag it (position is remembered; time is never changed by dragging) |
| Change category | Drag a peak **close to a range's peak or ridge** — above, below, or beside it; stacking near a member is enough to join. Drop on open ground (away from any range) to leave a category |
| Group two tasks | Drop one peak **onto** another (it glows green when they'd merge) |
| Delete / duplicate | Drag to the **🗑 trash** / **⧉ copy** zones that appear at the bottom |
| Add a task | **Double-click** empty ground |
| Rename | **Double-click** a peak · **click** a range's name |
| Move a whole range | Drag the ridge/name band |
| Multi-select | Drag a box on empty ground · **Shift/⌘-click** to toggle peaks · totals appear in the HUD |
| Copy / paste / delete selection | **⌘/Ctrl+C**, **⌘/Ctrl+V**, **Delete** · **Esc** clears/cancels |
| Pan | **Ctrl/⌘ + drag** (cursor becomes a hand) |
| Zoom | Mouse wheel, trackpad pinch, or the **+/−** buttons (100% = the whole map filling the frame, up to 400%) |

### Touch controls (phone/tablet)
| Action | How |
|---|---|
| Pan | One-finger drag on empty ground |
| Zoom | Two-finger pinch |
| Select | Tap a peak |
| Move / recategorize / group / trash / copy | Drag a peak (same rules as desktop) |
| **Add a task** | **Long-press empty ground** (½s — a tick vibration confirms), release |
| **Rename a task** | **Long-press a peak**, release |
| Rename a range | Tap its name |

*(Marquee multi-select and copy/paste are desktop-only by design.)*

---

## 5. Completed tab

Every finished task with its completion timestamp, grouped by day. The list's **Completed** section shows recent ones inline (collapsed by default). Use **Clear Done** to tidy, **Save Report** to export.

---

## 6. Sync across devices (optional)

Open **Sync** (top of the left panel) → enter the **same sync code** on each device. Tasks, categories, history, and stats sync in realtime. No code, no cloud — without it the app is 100% local.

---

## 7. Keyboard shortcuts

| Key | Where | Action |
|---|---|---|
| **Space** | Anywhere (outside text fields) | Start / pause the timer |
| **R** | Anywhere (outside text fields) | Restart the session |
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

---

## 9. Troubleshooting

| Symptom | Fix |
|---|---|
| Sounds don't play | Tap/press something first — browsers require one interaction before audio |
| New version doesn't show up | The app updates on the next *online* refresh; close and reopen once |
| Long-press shows no keyboard (iOS) | Release your finger — the input opens on release, then the keyboard follows |
| Synced devices disagree | Last write wins; make sure both run the latest version and the same sync code |
| Lost everything? | If you exported, your **Save Report** HTML has the data. Reset Data warns before wiping |

*Your data never leaves your device unless you turn on sync (your code, Supabase) — there are no accounts and no analytics.*
