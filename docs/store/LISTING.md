# Chrome Web Store listing — v1.2.0

Everything to fill in before **Submit for review**, in dashboard order.
Images are in this folder. Regenerate them with `node promo/store-assets.cjs` (see the script header).

---

## 0. First: unlock the listing

Version 1.2.0 is in review, so the listing is locked.
**⋮ (top right) → Cancel review.** The uploaded 1.2.0 package stays; no need to re-upload.

---

## 1. Store listing tab

### Description

```
Tired of clicking Accept or Ignore one by one?

LinkedIn Invites Helper adds "Accept all" and "Ignore all" buttons to your LinkedIn invitations page:
• https://www.linkedin.com/mynetwork/grow/
• https://www.linkedin.com/mynetwork/invitation-manager/received/

Works with any number of invitations: 5, 500 or 50,000.

Built to keep your account safe
• Human pace: 2–5 seconds between actions
• Short breaks every 50 invitations
• Up to 1,500 a day, then it pauses until tomorrow
• Slows down by itself if LinkedIn asks it to
• Stops cleanly at LinkedIn's 30,000-connection limit
• Remembers progress, so large backlogs continue after a reload or the next day

Features
• One-click Accept all / Ignore all, with a confirmation step
• Live progress and a Stop button
• Looks like LinkedIn's own interface
• English and Arabic

Privacy
• No data collected, sold or sent anywhere except linkedin.com
• No analytics, no servers of its own
• Runs only on the two LinkedIn invitation pages

This tool performs actions you could do manually. Use it responsibly.
```

### Category / language

| Field | Value |
|---|---|
| Category | Productivity › Communication |
| Language | English |

### Graphic assets

| Field | File | Size |
|---|---|---|
| Store icon | `../../icons/icon128.png` | 128×128 |
| Global promo video | `https://youtu.be/BBdoNgA5iFE` | — |
| Screenshot 1 | `screenshot-1.jpg` — Accept all / Ignore all panel | 1280×800 |
| Screenshot 2 | `screenshot-2.jpg` — confirm dialog | 1280×800 |
| Screenshot 3 | `screenshot-3.jpg` — safety pacing | 1280×800 |
| Screenshot 4 | `screenshot-4.jpg` — daily limit / continue | 1280×800 |
| Screenshot 5 | `screenshot-5.jpg` — all done | 1280×800 |
| Small promo tile | `small-promo-tile-440x280.jpg` | 440×280 |
| Marquee promo tile | `marquee-promo-tile-1400x560.jpg` (optional) | 1400×560 |

All screenshots use made-up names; no real LinkedIn members appear.

### Additional fields

| Field | Value |
|---|---|
| Official URL | None |
| Homepage URL | `https://github.com/emran-alhaddad/linkedin-invites-helper` |
| Support URL | `https://github.com/emran-alhaddad/linkedin-invites-helper/issues` |
| Mature content | No |

---

## 2. Privacy tab

### Single purpose

```
Lets the user accept or ignore all of their pending LinkedIn connection invitations in one click, on LinkedIn's invitation pages, at a paced, human-like speed.
```

### Host permission justification

(The extension asks for no permissions; this covers the content script on linkedin.com.)

```
The content script runs only on two LinkedIn pages (My Network → Grow and Invitation Manager → Received). It needs access to these pages to show the "Accept all" / "Ignore all" panel and to accept or ignore invitations the user chose, using the same requests LinkedIn's own website sends. It does not run on any other site.
```

### Remote code

**No, I am not using remote code.** All JavaScript is in the package.

### Data usage

Tick **none** of the data types. The extension does not collect or transmit user data to the developer or any third party. Its only network requests go to linkedin.com, on the user's behalf.

Tick all three certifications:
- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

### Privacy policy URL

```
https://github.com/emran-alhaddad/linkedin-invites-helper/blob/main/PRIVACY.md
```

The updated PRIVACY.md is committed locally but **not pushed yet**. Push before submitting, or reviewers see the old text.

---

## 3. Test instructions tab

```
Requirements: a LinkedIn account with at least one pending connection invitation (ask a second test account to send one).

1. Sign in to LinkedIn.
2. Open https://www.linkedin.com/mynetwork/invitation-manager/received/
3. A panel appears above the invitation list: "N pending invitations" with "Ignore all" and "Accept all".
4. Click "Ignore all" (or "Accept all") and confirm the dialog.
5. The panel shows live progress; actions run 2–5 seconds apart. When finished, a toast shows "N invitations ignored/accepted" and the page reloads with no pending invitations.

The panel is hidden when there are no pending invitations. No login credentials are needed beyond the reviewer's own LinkedIn account.
```

---

## 4. Distribution tab

| Field | Value |
|---|---|
| Payments | Free of charge |
| Visibility | Public |
| Regions | All regions |

---

## 5. Submit

**Save draft → Submit for review.** Review usually takes 1–3 business days.
