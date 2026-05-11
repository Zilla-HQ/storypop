# Sitebeat Chrome Extension

One-click free SEO audit on the active tab. Submissions land in the standard `/api/audit` pipeline tagged with `utm_source=chrome_extension`.

## Local install (developer mode)

1. `chrome://extensions`
2. Toggle **Developer mode** (top right).
3. **Load unpacked** → select this `extension/` folder.
4. The Sitebeat icon appears in the toolbar.

## Icons (you must add)

Create or commission three PNG icons and place them at:

- `icons/icon-16.png` (16×16)
- `icons/icon-48.png` (48×48)
- `icons/icon-128.png` (128×128)

Suggested: emerald background, white "S" — same vibe as the marketing site. Free option: pipe into a generator like `https://favicon.io/`.

## Publishing to the Chrome Web Store

1. Add a developer account ($5 one-time fee) at <https://chrome.google.com/webstore/devconsole>.
2. Zip the `extension/` directory (without `.git` or `README.md` if you want).
3. Upload the zip, fill in store-listing fields:
   - **Description**: pull from `manifest.json` description.
   - **Screenshots**: 1280×800 PNG of the popup + an audit report page.
   - **Privacy policy URL**: `https://sitebeat.com/privacy`.
4. Submit for review. First-time review usually 1–3 days.

## Roadmap

- v1.1: side-panel mode showing the live audit report inline.
- v1.2: per-user ref code (read from `chrome.storage`) so we can attribute installs to the affiliate who promoted the extension.
