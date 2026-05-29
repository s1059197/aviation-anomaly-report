const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";
const imageModel = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1.5";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function readString(value, maxLength = 2000) {
  return String(value || "").trim().slice(0, maxLength);
}

function buildPrompt(input) {
  return [
    "Create a neutral aviation incident reconstruction image for a formal anomaly report.",
    "The image should look like a factual visual aid, not entertainment, marketing, or science fiction art.",
    "Do not include agency names, seals, insignia, pilot faces, cockpit identifiers, tail numbers, weapons, or classified-looking markings.",
    "Use only details supported by the report. If uncertain, keep the scene restrained and generic.",
    "",
    `Narrative: ${readString(input.narrative, 3000) || "Unspecified aerial anomaly observed from an aircraft."}`,
    `Pilot feedback for this iteration: ${readString(input.feedback, 1000) || "Initial reconstruction."}`,
    `Apparent shape: ${readString(input.shape, 200) || "Unknown"}`,
    `Color and luminosity: ${readString(input.luminosity, 300) || "Unknown"}`,
    `Motion observed: ${readString(input.motion, 300) || "Unknown"}`,
    `Environmental conditions: ${readString(input.conditions, 800) || "Unknown"}`,
    `Relative bearing: ${readString(input.bearing, 200) || "Unknown"}`,
    `Aircraft altitude: ${readString(input.altitude, 100) || "Unknown"} ft MSL`,
    `Phase of flight: ${readString(input.phase, 100) || "Unknown"}`,
    "",
    "Composition: exterior sky view from an aircraft perspective, clear depiction of relative position, understated color, documentary realism."
  ].join("\n");
}

async function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
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

  if (!process.env.OPENAI_API_KEY) {
    res.status(500).json({ error: "OPENAI_API_KEY is not configured on the image backend." });
    return;
  }

  try {
    const input = await parseBody(req);
    const prompt = buildPrompt(input);

    const openaiResponse = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: imageModel,
        prompt,
        n: 1,
        size: "1536x1024",
        quality: "medium",
        output_format: "png"
      })
    });

    const result = await openaiResponse.json();
    if (!openaiResponse.ok) {
      const message = result.error?.message || "OpenAI image generation request failed.";
      res.status(openaiResponse.status).json({ error: message });
      return;
    }

    res.status(200).json({
      image: result.data?.[0]?.b64_json,
      revisedPrompt: result.data?.[0]?.revised_prompt || "",
      model: imageModel
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Unexpected image backend error." });
  }
}
