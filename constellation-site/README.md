# Constellation

A habit tracker that shows daily consistency as a growing night sky, with a plain streak counter as the comparison condition. Static site, no build step, no backend.

## Pages

| Path | What it is |
| --- | --- |
| `/` | Landing page |
| `/app` | Participant app: check-in, weekly survey, diary, data export |
| `/researcher` | Load participant exports and run the paired comparison |

Share participant links with the ID filled in: `https://your-site.vercel.app/app?pid=P07`. Odd IDs start with the constellation, even IDs with the counter.

## Before you deploy

1. Edit `js/config.js`: study name, institution, contact email, and optionally a `submitUrl`.
2. Get ethics approval and replace the consent wording in `js/app.js` (search for "About this study") with your approved text.
3. Open the app locally once and click through both versions.

## Deploy to Vercel

**With the CLI** (inside this folder):

```
npm i -g vercel
vercel          # first run: accept the defaults, no framework, no build command
vercel --prod
```

**With GitHub:** push this folder to a repository, then on vercel.com choose Add New, Project, import the repository. Set Framework Preset to Other and leave Build Command and Output Directory empty.

`vercel.json` already sets clean URLs, security headers and a content security policy.

## Collecting data

Data lives in each participant's browser. Participants download a CSV or JSON export from the Data tab and send it to you, or, if you set `submitUrl` in `js/config.js`, press Send to researcher. The endpoint must accept a JSON `POST` and allow cross-origin requests (Formspree and Google Apps Script web apps both can). Then drop the JSON files on `/researcher`.

## Data decisions to report

- Each version runs in its own phase. The streak and the sky both restart at the start of phase two.
- You can only check in for today. A missed day stays missed.
- The weekly survey items are written for this study and are not a validated scale.
- A day runs midnight to midnight in the participant's local time.

## Run locally

```
python3 -m http.server 8080
```

Then open http://localhost:8080. The service worker registers only over http(s).
