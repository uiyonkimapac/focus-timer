# Focus Timer on Apple Watch — setup guide

A small native watch app that shows **today's tasks** from your existing sync
backend, runs a **countdown with wrist taps** (haptic at time-up, amber
overtime after — nothing completes until you tap ✓), and writes completions
back so your phone/desktop see them like any other device.

It ships as two pieces:
- **Focus Timer** (watch app) — the actual timer.
- **FT Watch Setup** (iPhone app) — one screen, only for entering your sync
  code and sending it to the watch. Defaults to `FT-WQDP-8N`.

## One-time setup

1. **Install Xcode** from the Mac App Store (free, ~12 GB — start the download
   and let it run). Open it once, accept the license, let it finish
   "installing components".
2. **Sign in with your Apple ID** in Xcode: Settings → Accounts → “+” →
   Apple ID. This creates your free "Personal Team" used to sign the app.
3. **Open the project**: double-click `watch/FocusTimerWatch.xcodeproj`
   (or from Terminal: `open watch/FocusTimerWatch.xcodeproj`).
4. **Set signing**: click the blue project icon (top of left sidebar) →
   select target **FocusTimerPhone** → *Signing & Capabilities* → Team =
   your Personal Team. Repeat for target **FocusTimerWatchApp**.
   If Xcode complains the bundle id is taken, change `com.uiyonkim` to
   anything unique in both targets (keep the watch one as
   `<phone-id>.watchkitapp`).
5. **Plug in your iPhone** with a cable. First run only: on the iPhone,
   enable **Settings → Privacy & Security → Developer Mode** (phone reboots),
   and trust the Mac when prompted. Do the same on the watch
   (Settings → Privacy & Security → Developer Mode).
6. In Xcode's top bar, pick scheme **FocusTimerWatchApp** and as destination
   your Apple Watch (shows "via iPhone"). Press **▶ Run**. First install
   also needs: iPhone Settings → General → VPN & Device Management →
   trust your developer certificate.
7. Run scheme **FocusTimerPhone** on the iPhone once too, open **FT Watch
   Setup**, check the sync code, tap **Send to Watch**.

## Daily reality with a free Apple ID

- Apps signed with a free Personal Team **expire after 7 days** — the watch
  app just stops opening. Fix: plug the iPhone in, press ▶ Run in Xcode
  again (2 minutes). A paid Apple Developer account ($99/yr) removes this.

## v1 scope and honest limitations

- Shows today's list (done and "not today" tasks are hidden), starts a
  countdown per task, taps your wrist at 0:00 (plus a local notification if
  the app is asleep), holds in overtime, ✓ writes the completion + history
  entry back to sync.
- No routines, no breaks, no run-mode on the watch yet — start with this,
  extend if it earns its place.
- Completing a task on the watch uses the same whole-state last-write-wins
  sync as every other device: if another device pushes at the same moment,
  last writer wins.
- The stats cards (Focused minutes today) are recomputed by the web app from
  its own state; watch completions update tasks + history, which is what
  reports and the Done count read.

## Regenerating the Xcode project

The `.xcodeproj` is generated from `project.yml`:

    cd watch && xcodegen

Run that after adding/removing Swift files (file *edits* don't need it).
