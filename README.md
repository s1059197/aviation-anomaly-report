# Aviation Anomaly Report POC

Static, GitHub Pages-ready prototype for an aviation anomaly reporting form. It avoids naming a specific agency while keeping a sober government intake tone.

## Run locally

Open `index.html` directly in a browser, or serve the folder with any static server.

```powershell
.\serve.ps1 4173
```

Then visit `http://localhost:4173`.

## POC behavior

- Captures position, altitude, airspeed, heading, aircraft context, sighting characteristics, environmental notes, sensor context, safety impact, and a narrative.
- Provides aligned flight sliders, a radar-style heading/airspeed visualization on the Flight and Review steps, and visual reconstruction controls.
- Builds a final report and submits the prototype by saving a PDF copy through the backend.
- Uses a live image backend when an API base URL is configured. Otherwise it falls back to the local procedural renderer so the prototype remains usable without spending credits.

## Live image generation

GitHub Pages can host the form, but it cannot safely host the image-generation secret. To make image generation work for pilots away from your home network, deploy the serverless functions in `api/` to a public HTTPS host such as Vercel, then set that deployment URL in `config.js`.

The API expects these environment variables:

```powershell
OPENAI_API_KEY=sk-proj-replace-me
OPENAI_IMAGE_MODEL=gpt-image-1.5
ALLOWED_ORIGIN=https://your-github-username.github.io
```

Local testing options:

```powershell
npm run check
```

For a local serverless run, use Vercel's local dev command after installing Vercel CLI:

```powershell
vercel dev
```

When deployed, set the app's API base URL to the public backend origin in `config.js`, for example:

```text
https://your-uap-image-api.vercel.app
```

```js
window.UAP_IMAGE_API_BASE = "https://your-uap-image-api.vercel.app";
```

The frontend automatically starts visualization when the user reaches the Visualization step, limits live image requests to three per report session, and falls back to the local renderer if the backend fails. The Review step's Submit button calls `api/save-report-pdf.js`, shows a confirmation, and downloads the generated PDF. It does not transmit the report to an agency.

## Demo report storage

For the simplest GitHub Pages-compatible report backend, use the Google Apps Script in `apps-script/Code.gs`.

Setup:

1. Create a new Google Apps Script project.
2. Paste in `apps-script/Code.gs`.
3. Deploy it as a Web App.
4. Use **Execute as: Me** and **Who has access: Anyone** for the demo.
5. Copy the Web App URL into `config.js`:

```js
window.UAP_REPORT_SUBMIT_URL = "https://script.google.com/macros/s/your-deployment-id/exec";
```

On submit, the script creates or reuses a Google Sheet, creates a Drive PDF containing the report body and both images, and stores the PDF link in the sheet. Set `notifyEmail` in `Code.gs` if you also want a copy emailed.

## Claude Code handoff

Useful next tasks:

- Add attachment handling for photos, cockpit display screenshots, ADS-B exports, or ATC notes.
- Add validation rules for coordinate precision, altitude units, and required operational context.
- Add a review queue, encrypted storage, or authenticated submission workflow after the PDF-only prototype is approved.
