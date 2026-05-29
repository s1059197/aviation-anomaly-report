const CONFIG = {
  sheetName: "UAP Demo Reports",
  folderName: "UAP Demo Report PDFs",
  notifyEmail: ""
};

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || "{}");
    const sheet = getSubmissionSheet();
    const pdfFile = createReportPdf(payload);
    const reportId = Utilities.getUuid();

    sheet.appendRow([
      new Date(),
      reportId,
      getValue(payload, "flight.flightId"),
      getValue(payload, "flight.sightingTime"),
      getValue(payload, "flight.latitude"),
      getValue(payload, "flight.longitude"),
      getValue(payload, "flight.altitude"),
      getValue(payload, "flight.airspeed"),
      getValue(payload, "flight.heading"),
      pdfFile.getUrl(),
      payload.report || ""
    ]);

    if (CONFIG.notifyEmail) {
      MailApp.sendEmail({
        to: CONFIG.notifyEmail,
        subject: "New aviation anomaly demo report",
        body: `A new demo report was stored.\n\nReport ID: ${reportId}\nPDF: ${pdfFile.getUrl()}`,
        attachments: [pdfFile.getBlob()]
      });
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, reportId, pdfUrl: pdfFile.getUrl() }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getSubmissionSheet() {
  const props = PropertiesService.getScriptProperties();
  let spreadsheetId = props.getProperty("REPORT_SPREADSHEET_ID");
  let spreadsheet;

  if (spreadsheetId) {
    spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  } else {
    spreadsheet = SpreadsheetApp.create(CONFIG.sheetName);
    props.setProperty("REPORT_SPREADSHEET_ID", spreadsheet.getId());
  }

  const sheet = spreadsheet.getSheets()[0];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "Received At",
      "Report ID",
      "Flight ID",
      "Sighting Time",
      "Latitude",
      "Longitude",
      "Altitude",
      "Airspeed",
      "Heading",
      "PDF URL",
      "Report Body"
    ]);
  }
  return sheet;
}

function createReportPdf(payload) {
  const folder = getOrCreateFolder();
  const title = `Aviation Anomaly Demo Report - ${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HHmmss")}`;
  const doc = DocumentApp.create(title);
  const body = doc.getBody();

  body.appendParagraph("Aviation Anomaly Report").setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph(payload.report || "No report body provided.").setFontFamily("Courier New").setFontSize(9);

  const images = Array.isArray(payload.images) ? payload.images : [];
  images.forEach((image) => {
    if (!image || !image.data) return;
    body.appendPageBreak();
    body.appendParagraph(image.title || "Report Image").setHeading(DocumentApp.ParagraphHeading.HEADING2);
    const blob = dataUrlToBlob(image.data, `${image.title || "report-image"}.png`);
    const inserted = body.appendImage(blob);
    const maxWidth = 460;
    const scale = maxWidth / inserted.getWidth();
    inserted.setWidth(maxWidth).setHeight(inserted.getHeight() * scale);
  });

  doc.saveAndClose();

  const docFile = DriveApp.getFileById(doc.getId());
  const pdfFile = folder.createFile(docFile.getAs(MimeType.PDF)).setName(`${title}.pdf`);
  docFile.setTrashed(true);
  return pdfFile;
}

function getOrCreateFolder() {
  const props = PropertiesService.getScriptProperties();
  let folderId = props.getProperty("REPORT_FOLDER_ID");
  if (folderId) return DriveApp.getFolderById(folderId);

  const folder = DriveApp.createFolder(CONFIG.folderName);
  props.setProperty("REPORT_FOLDER_ID", folder.getId());
  return folder;
}

function dataUrlToBlob(dataUrl, fileName) {
  const parts = String(dataUrl).split(",");
  const contentType = parts[0].match(/data:(.*?);base64/)?.[1] || "image/png";
  const bytes = Utilities.base64Decode(parts[1] || "");
  return Utilities.newBlob(bytes, contentType, fileName);
}

function getValue(object, path) {
  return path.split(".").reduce((value, key) => value && value[key], object) || "";
}
