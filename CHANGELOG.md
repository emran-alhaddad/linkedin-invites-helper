# Changelog

## 1.2.1
- Fix: panel disappeared for good when LinkedIn re-rendered the invitation list; it now comes back every time
- Fix: re-checks the count once invitations load, if the first check ran too early

## 1.2.0
- Uses LinkedIn's own invitations API (the calls the web app makes); clicking page buttons is now only a fallback
- Handles any number of invitations: pages through all of them, skips ones LinkedIn rejects
- Human pace: 2–5 s between actions, 1–2 min break every 50, max 1,500 a day
- Backs off on rate limits (429/999), stops on sign-out, and stops at LinkedIn's 30,000-connection cap
- Progress is saved, so large jobs continue after a reload or the next day
- `node test/sim.js` simulates 5 / 500 / 50,000 invitations against a strict fake rate limiter

## 1.1.0
- Fix: works again with LinkedIn's new invitation markup (matches by invitation URN + button aria-label)
- Restyled to match LinkedIn: blue pill "Accept all", tertiary "Ignore all", native-looking toast
- Confirm dialog before bulk actions; simpler SPA handling (one observer)

## 1.0.3
- Hide panel by default; show only when invitations > 0
- Persistent inline anchors across SPA navigations
- Size/typography polish

## 1.0.2
- Re-anchor panel after LinkedIn hydration
- Locale-aware labels (EN/AR)

## 1.0.1
- Inline gradient buttons with counters
- Toast after bulk action

## 1.0.0
- Initial release
