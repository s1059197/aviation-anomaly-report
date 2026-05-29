# Google Apps Script Demo Backend

This backend is intentionally simple: it stores each submitted report in a Google Sheet and creates a PDF copy in Google Drive.

## Deploy

1. Open Google Apps Script and create a new project.
2. Replace the default file contents with `Code.gs`.
3. Optional: set `notifyEmail` near the top of `Code.gs`.
4. Click **Deploy > New deployment > Web app**.
5. Use **Execute as: Me**.
6. Use **Who has access: Anyone** for a public demo endpoint.
7. Copy the Web App URL.
8. Set that URL in `config.js`:

```js
window.UAP_REPORT_SUBMIT_URL = "https://script.google.com/macros/s/your-deployment-id/exec";
```

Because the GitHub Pages frontend sends this as a demo `no-cors` request, the app treats a completed request as sent and the Apps Script stores the real artifact in Drive.
