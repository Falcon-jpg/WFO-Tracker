# Office Days — attendance tracker

A lightweight tool for tracking hybrid-work attendance against a target (e.g. 60% in office).
Mark each day as Office, Home, Leave, Half-day, or Holiday; see your monthly percentage,
days-remaining, and a year overview at a glance.

No backend, no build step, no dependencies — just static files a browser loads directly.

## How data works

All data (your marked days, holiday list, name, target, theme) is stored in the
**browser's `localStorage`**. That means:

- Each person who opens the page has their **own private data** in their own browser.
- Nothing is uploaded anywhere — there is no server and no shared database.
- Updating the app code (the files below) never touches saved data.
- Data is lost only if a user clears **site data / cookies** for the domain (clearing the
  ordinary *cache* does not remove it). Use **Export backup** to keep a copy.

## Files

| File            | Purpose                                                        |
|-----------------|---------------------------------------------------------------|
| `index.html`    | Markup shell. Loads the CSS and JS.                           |
| `styles.css`    | All styling (light/dark theme via a `data-theme` attribute).  |
| `app.js`        | All logic: stats, calendar, bulk edit, backup, persistence.  |
| `holidays.json` | Default public holidays, seeded on first run only.           |
| `README.md`     | This file.                                                    |

After first run, holidays are managed in the app (Holidays tab) and stored in
`localStorage`; `holidays.json` is only the initial seed. Edit `holidays.json` to change
the defaults a brand-new user starts with.

## Running it

Because the app fetches `holidays.json`, serve the folder over HTTP rather than opening
`index.html` from disk. (Opening it directly still works — it just falls back to the
built-in default holiday list instead of reading the JSON file.)

Quick local preview, from inside this folder:

```bash
# Python (any version 3.x)
python -m http.server 8000
# then open http://localhost:8000
```

## Deploying

Any static host works, since these are plain files:

- **GitHub Pages:** put the files at the repo root, then Settings → Pages → Deploy from a
  branch → `main` / `/ (root)`. The site rebuilds automatically on every commit.
- **Internal / corporate static hosting:** copy the folder to whatever serves static
  content (internal web server, artifact host, shared site). No Node, npm, or pipeline
  required — which is the main reason this is kept build-free.

## Customizing

- **App name / colours:** edit the `--brand` and `--header` variables and the `.brand`
  text. Category colours are the `--wfo` / `--wfh` / `--leave` / `--holiday` variables.
- **Target rounding:** required office days use standard rounding
  (`Math.round(target% × effective working days)`).
- **Half-days:** a half-day leave reduces effective working days by 0.5 and counts 0.5
  leave. If the worked half was in office, the day earns **full office credit** (office is
  never counted in fractions); if the worked half was from home, it earns **no office
  credit** (counted as half a home day).

## Notes / limitations

- Data is per-browser only; there is no central or team-wide record. Moving devices means
  exporting a backup and importing it on the other device.
- If you later need shared/centralized records (e.g. a manager view), that requires a real
  backend (storage, auth, hosting review) — a separate, larger project, not a change to
  these front-end files.

## Version

1.0
