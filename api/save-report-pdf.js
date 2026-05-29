import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function wrapText(text, maxChars) {
  const words = String(text || "").split(/\s+/);
  const lines = [];
  let line = "";

  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });

  if (line) lines.push(line);
  return lines;
}

async function addTextPages(pdfDoc, report) {
  const font = await pdfDoc.embedFont(StandardFonts.Courier);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  let page = pdfDoc.addPage([612, 792]);
  let y = 744;

  page.drawText("Aviation Anomaly Report", {
    x: 54,
    y,
    size: 18,
    font: bold,
    color: rgb(0.06, 0.31, 0.29)
  });
  y -= 30;

  const lines = String(report || "No report body provided.")
    .split("\n")
    .flatMap((line) => wrapText(line, 88));

  lines.forEach((line) => {
    if (y < 54) {
      page = pdfDoc.addPage([612, 792]);
      y = 744;
    }
    page.drawText(line || " ", {
      x: 54,
      y,
      size: 9.5,
      font,
      color: rgb(0.12, 0.14, 0.14)
    });
    y -= 13;
  });
}

async function addImagePage(pdfDoc, imageData, title = "Visual Reconstruction") {
  if (!imageData) return;
  const base64 = String(imageData).replace(/^data:image\/png;base64,/, "");
  const image = await pdfDoc.embedPng(Buffer.from(base64, "base64"));
  const page = pdfDoc.addPage([612, 792]);
  const margin = 54;
  const maxWidth = page.getWidth() - margin * 2;
  const maxHeight = page.getHeight() - margin * 2 - 28;
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
  const width = image.width * scale;
  const height = image.height * scale;

  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  page.drawText(title,
  {
    x: margin,
    y: page.getHeight() - margin,
    size: 16,
    font,
    color: rgb(0.06, 0.31, 0.29)
  });
  page.drawImage(image, {
    x: (page.getWidth() - width) / 2,
    y: page.getHeight() - margin - 28 - height,
    width,
    height
  });
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST." });
    return;
  }

  try {
    const input = await parseBody(req);
    const pdfDoc = await PDFDocument.create();
    await addTextPages(pdfDoc, input.report);

    const images = Array.isArray(input.images)
      ? input.images
      : [{ title: "Visual Reconstruction", data: input.image }];
    for (const image of images) {
      await addImagePage(pdfDoc, image.data, image.title);
    }

    const pdfBytes = await pdfDoc.save();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${input.fileName || "aviation-anomaly-report.pdf"}"`);
    res.status(200).send(Buffer.from(pdfBytes));
  } catch (error) {
    res.status(500).json({ error: error.message || "Could not create PDF." });
  }
}
