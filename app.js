const form = document.querySelector("#reportForm");
const panels = [...document.querySelectorAll(".form-step")];
const stepOrder = ["flight", "sighting", "narrative", "review"];
const stepLabels = ["Flight", "Sighting", "Visualization", "Review"];
const progressItems = [...document.querySelectorAll("[data-progress-step]")];
const shell = document.querySelector(".shell");
const livePanel = document.querySelector(".live-panel");
const radarCanvas = document.querySelector("#radarCanvas");
const radarCtx = radarCanvas.getContext("2d");
const reconstructionCanvas = document.querySelector("#reconstructionCanvas");
const reconstructionCtx = reconstructionCanvas.getContext("2d");
const imageLog = document.querySelector("#imageLog");
const finalReport = document.querySelector("#finalReport");
const reviewRadarImage = document.querySelector("#reviewRadarImage");
const reviewDemoImage = document.querySelector("#reviewDemoImage");
const iterateImageButton = document.querySelector("#iterateImage");
const imageFeedbackInput = document.querySelector("#imageFeedback");
const imageLoading = document.querySelector("#imageLoading");
const backStepButton = document.querySelector("#backStep");
const nextStepButton = document.querySelector("#nextStep");
const wizardActions = document.querySelector(".wizard-actions");
const submitReportButton = document.querySelector("#submitReport");
const submitConfirmation = document.querySelector("#submitConfirmation");

const fields = {
  sightingTime: document.querySelector("#sightingTime"),
  flightId: document.querySelector("#flightId"),
  latitude: document.querySelector("#latitude"),
  longitude: document.querySelector("#longitude"),
  altitude: document.querySelector("#altitude"),
  altitudeRange: document.querySelector("#altitudeRange"),
  airspeed: document.querySelector("#airspeed"),
  airspeedRange: document.querySelector("#airspeedRange"),
  heading: document.querySelector("#heading"),
  headingRange: document.querySelector("#headingRange"),
  headingOutput: document.querySelector("#headingOutput"),
  aircraftType: document.querySelector("#aircraftType"),
  phase: document.querySelector("#phase"),
  bearing: document.querySelector("#bearing"),
  range: document.querySelector("#range"),
  duration: document.querySelector("#duration"),
  luminosity: document.querySelector("#luminosity"),
  motion: document.querySelector("#motion"),
  conditions: document.querySelector("#conditions"),
  sensorContext: document.querySelector("#sensorContext"),
  safetyImpact: document.querySelector("#safetyImpact"),
  impactNotes: document.querySelector("#impactNotes"),
  narrative: document.querySelector("#narrative"),
  feedback: document.querySelector("#imageFeedback"),
  apiBaseUrl: document.querySelector("#apiBaseUrl"),
  imageBackendStatus: document.querySelector("#imageBackendStatus"),
  readoutCoords: document.querySelector("#readoutCoords"),
  readoutFlight: document.querySelector("#readoutFlight")
};

let imageIteration = 0;
let activePrompt = "";
let activeStepIndex = 0;
let liveImageCalls = 0;
let visualizationStarted = false;
let firstImageLoaded = false;
const liveImageLimit = 3;

const setInitialTime = () => {
  const now = new Date();
  now.setSeconds(0, 0);
  fields.sightingTime.value = now.toISOString().slice(0, 16);
};

const getShape = () => {
  const selected = document.querySelector("input[name='shape']:checked");
  return selected ? selected.value : "Unspecified";
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const valueOrPending = (value) => {
  const normalized = String(value || "").trim();
  return normalized.length ? normalized : "Not provided";
};

const setStep = (name) => {
  panels.forEach((panel) => panel.classList.toggle("is-active", panel.dataset.panel === name));
  activeStepIndex = stepOrder.indexOf(name);
  if (activeStepIndex < 0) activeStepIndex = 0;
  progressItems.forEach((item, index) => {
    item.classList.toggle("is-active", index === activeStepIndex);
    item.classList.toggle("is-complete", index < activeStepIndex);
  });
  backStepButton.disabled = activeStepIndex === 0;
  nextStepButton.textContent = "Next";
  nextStepButton.disabled = activeStepIndex === stepOrder.length - 1;
  wizardActions.classList.toggle("is-review", name === "review");
  livePanel.classList.toggle("is-hidden", name !== "flight");
  shell.classList.toggle("no-side-panel", name !== "flight");
  if (name === "review") {
    finalReport.value = buildReportText();
    updateReviewExhibits();
  }
  if (name === "narrative") beginVisualization();
  updateAll();
};

backStepButton.addEventListener("click", () => {
  setStep(stepOrder[Math.max(0, activeStepIndex - 1)]);
});

nextStepButton.addEventListener("click", () => {
  setStep(stepOrder[Math.min(stepOrder.length - 1, activeStepIndex + 1)]);
});

const syncNumberPair = (input, range) => {
  input.addEventListener("input", () => {
    if (input.value !== "") range.value = input.value;
    updateAll();
  });
  range.addEventListener("input", () => {
    input.value = range.value;
    updateAll();
  });
};

syncNumberPair(fields.altitude, fields.altitudeRange);
syncNumberPair(fields.airspeed, fields.airspeedRange);
syncNumberPair(fields.heading, fields.headingRange);

const updateHeading = (heading) => {
  const normalized = ((Number(heading) % 360) + 360) % 360;
  fields.heading.value = String(Math.round(normalized));
  fields.headingRange.value = String(Math.round(normalized));
  fields.headingOutput.textContent = `${String(Math.round(normalized)).padStart(3, "0")} deg`;
  updateAll();
};

fields.heading.addEventListener("input", () => updateHeading(fields.heading.value || 0));

const drawRadar = () => {
  const width = radarCanvas.width;
  const height = radarCanvas.height;
  const center = width / 2;
  const heading = Number(fields.heading.value || 90);
  const bearingMap = {
    "Ahead": 0,
    "Left front quarter": -45,
    "Right front quarter": 45,
    "Left beam": -90,
    "Right beam": 90,
    "Aft": 180,
    "Unknown": 135
  };
  const bearing = bearingMap[fields.bearing.value] ?? 0;
  const contactAngle = (heading + bearing - 90) * (Math.PI / 180);
  const contactRadius = 112;
  const contactX = center + Math.cos(contactAngle) * contactRadius;
  const contactY = center + Math.sin(contactAngle) * contactRadius;

  radarCtx.clearRect(0, 0, width, height);
  radarCtx.fillStyle = "#101c23";
  radarCtx.fillRect(0, 0, width, height);

  radarCtx.strokeStyle = "rgba(151, 214, 205, 0.28)";
  radarCtx.lineWidth = 1;
  [60, 110, 160].forEach((radius) => {
    radarCtx.beginPath();
    radarCtx.arc(center, center, radius, 0, Math.PI * 2);
    radarCtx.stroke();
  });

  for (let i = 0; i < 12; i += 1) {
    const angle = (i * 30 - 90) * (Math.PI / 180);
    radarCtx.beginPath();
    radarCtx.moveTo(center, center);
    radarCtx.lineTo(center + Math.cos(angle) * 178, center + Math.sin(angle) * 178);
    radarCtx.stroke();
  }

  const headingAngle = (heading - 90) * (Math.PI / 180);
  radarCtx.strokeStyle = "#f2efe1";
  radarCtx.lineWidth = 4;
  radarCtx.beginPath();
  radarCtx.moveTo(center, center);
  radarCtx.lineTo(center + Math.cos(headingAngle) * 130, center + Math.sin(headingAngle) * 130);
  radarCtx.stroke();

  radarCtx.fillStyle = "#f2efe1";
  radarCtx.beginPath();
  radarCtx.arc(center, center, 7, 0, Math.PI * 2);
  radarCtx.fill();

  radarCtx.fillStyle = "#f2b84b";
  radarCtx.beginPath();
  radarCtx.arc(contactX, contactY, 11, 0, Math.PI * 2);
  radarCtx.fill();

  radarCtx.fillStyle = "#b7d6d0";
  radarCtx.font = "700 16px Arial";
  radarCtx.fillText(`${String(Math.round(heading)).padStart(3, "0")} deg`, 18, 30);
  radarCtx.fillText(valueOrPending(fields.altitude.value) + " ft", 18, 54);
};

const drawDemoLabel = () => {
  reconstructionCtx.save();
  reconstructionCtx.fillStyle = "rgba(16, 28, 35, 0.72)";
  reconstructionCtx.beginPath();
  reconstructionCtx.roundRect(18, 18, 210, 34, 17);
  reconstructionCtx.fill();
  reconstructionCtx.fillStyle = "#ffffff";
  reconstructionCtx.font = "700 14px Arial";
  reconstructionCtx.fillText("demo - no changes made", 34, 40);
  reconstructionCtx.restore();
};

const shouldShowDemoRevisionLabel = (feedback) => String(feedback || "").trim().length > 0;

const setRevisionEnabled = (isEnabled) => {
  iterateImageButton.disabled = !isEnabled;
  imageFeedbackInput.disabled = !isEnabled;
};

const drawReconstruction = (prompt, feedback = "") => {
  imageIteration += 1;
  const width = reconstructionCanvas.width;
  const height = reconstructionCanvas.height;
  const sky = reconstructionCtx.createLinearGradient(0, 0, 0, height);
  const lowerPrompt = `${prompt} ${feedback}`.toLowerCase();
  const isNight = /night|dark|moon|stars|black/.test(lowerPrompt);
  sky.addColorStop(0, isNight ? "#172533" : "#8fbdd2");
  sky.addColorStop(1, isNight ? "#2f4050" : "#e8f2f4");

  reconstructionCtx.clearRect(0, 0, width, height);
  reconstructionCtx.fillStyle = sky;
  reconstructionCtx.fillRect(0, 0, width, height);

  reconstructionCtx.fillStyle = isNight ? "rgba(255,255,255,.8)" : "rgba(255,255,255,.62)";
  for (let i = 0; i < 9; i += 1) {
    const x = (i * 93 + imageIteration * 23) % width;
    const y = 48 + ((i * 37) % 120);
    reconstructionCtx.beginPath();
    reconstructionCtx.ellipse(x, y, 44 + (i % 3) * 18, 12 + (i % 2) * 8, 0, 0, Math.PI * 2);
    reconstructionCtx.fill();
  }

  reconstructionCtx.strokeStyle = "rgba(255,255,255,.72)";
  reconstructionCtx.lineWidth = 3;
  reconstructionCtx.beginPath();
  reconstructionCtx.moveTo(54, 318);
  reconstructionCtx.lineTo(212, 258);
  reconstructionCtx.lineTo(492, 286);
  reconstructionCtx.lineTo(622, 230);
  reconstructionCtx.stroke();

  const shape = getShape();
  const objectX = lowerPrompt.includes("right") ? 510 : lowerPrompt.includes("left") ? 178 : 380;
  const objectY = lowerPrompt.includes("high") ? 88 : lowerPrompt.includes("low") ? 236 : 142;
  const glow = lowerPrompt.includes("dim") ? 0.45 : lowerPrompt.includes("bright") ? 0.92 : 0.68;

  reconstructionCtx.save();
  reconstructionCtx.shadowColor = `rgba(255, 223, 122, ${glow})`;
  reconstructionCtx.shadowBlur = 38;
  reconstructionCtx.fillStyle = lowerPrompt.includes("red") ? "#ff795f" : lowerPrompt.includes("amber") ? "#ffc86b" : "#f6fbff";

  if (shape.includes("Disc")) {
    reconstructionCtx.beginPath();
    reconstructionCtx.ellipse(objectX, objectY, 58, 16, -0.12, 0, Math.PI * 2);
    reconstructionCtx.fill();
  } else if (shape.includes("Cylinder")) {
    reconstructionCtx.roundRect(objectX - 58, objectY - 16, 116, 32, 16);
    reconstructionCtx.fill();
  } else if (shape.includes("Triangular")) {
    reconstructionCtx.beginPath();
    reconstructionCtx.moveTo(objectX, objectY - 42);
    reconstructionCtx.lineTo(objectX - 46, objectY + 34);
    reconstructionCtx.lineTo(objectX + 48, objectY + 28);
    reconstructionCtx.closePath();
    reconstructionCtx.fill();
  } else {
    reconstructionCtx.beginPath();
    reconstructionCtx.arc(objectX, objectY, 25, 0, Math.PI * 2);
    reconstructionCtx.fill();
  }
  reconstructionCtx.restore();
  if (shouldShowDemoRevisionLabel(feedback)) drawDemoLabel();

  reconstructionCtx.fillStyle = "rgba(16, 28, 35, 0.64)";
  reconstructionCtx.fillRect(0, height - 58, width, 58);
  reconstructionCtx.fillStyle = "#eff8f7";
  reconstructionCtx.font = "700 18px Arial";
  reconstructionCtx.fillText(`POC visual reconstruction ${imageIteration}`, 18, height - 32);
  reconstructionCtx.font = "14px Arial";
  reconstructionCtx.fillText(feedback || "Generated from narrative. Add feedback and iterate for a tighter match.", 18, height - 12);

  const li = document.createElement("li");
  li.textContent = feedback ? `Iteration ${imageIteration}: ${feedback}` : `Iteration ${imageIteration}: initial reconstruction`;
  imageLog.prepend(li);
  firstImageLoaded = true;
  setRevisionEnabled(true);
  updateAll();
};

const drawGeneratedImage = (imageData, feedback = "") => new Promise((resolve, reject) => {
  imageIteration += 1;
  const image = new Image();
  image.onload = () => {
    const width = reconstructionCanvas.width;
    const height = reconstructionCanvas.height;
    reconstructionCtx.clearRect(0, 0, width, height);
    reconstructionCtx.fillStyle = "#111d24";
    reconstructionCtx.fillRect(0, 0, width, height);

    const scale = Math.min(width / image.width, height / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    const x = (width - drawWidth) / 2;
    const y = (height - drawHeight) / 2;
    reconstructionCtx.drawImage(image, x, y, drawWidth, drawHeight);
    if (shouldShowDemoRevisionLabel(feedback)) drawDemoLabel();

    reconstructionCtx.fillStyle = "rgba(16, 28, 35, 0.64)";
    reconstructionCtx.fillRect(0, height - 58, width, 58);
    reconstructionCtx.fillStyle = "#eff8f7";
    reconstructionCtx.font = "700 18px Arial";
    reconstructionCtx.fillText(`Live visual reconstruction ${imageIteration}`, 18, height - 32);
    reconstructionCtx.font = "14px Arial";
    reconstructionCtx.fillText(feedback || "Generated from narrative.", 18, height - 12);
    firstImageLoaded = true;
    setRevisionEnabled(true);
    updateAll();
    resolve();
  };
  image.onerror = reject;
  image.src = imageData.startsWith("data:") ? imageData : `data:image/png;base64,${imageData}`;

  const li = document.createElement("li");
  li.textContent = feedback ? `Iteration ${imageIteration}: ${feedback}` : `Iteration ${imageIteration}: live reconstruction`;
  imageLog.prepend(li);
});

const normalizeApiBase = () => {
  const configured = fields.apiBaseUrl.value.trim() || localStorage.getItem("uapImageApiBase") || window.UAP_IMAGE_API_BASE || "";
  return configured.replace(/\/$/, "");
};

const normalizeReportSubmitUrl = () => {
  const configured = localStorage.getItem("uapReportSubmitUrl") || window.UAP_REPORT_SUBMIT_URL || "";
  return configured.trim();
};

const setImageLoading = (isLoading) => {
  imageLoading.classList.toggle("is-active", isLoading);
  if (isLoading) setRevisionEnabled(false);
};

const generateLiveImage = async (feedback = "") => {
  const apiBase = normalizeApiBase();
  if (!apiBase) return false;
  if (liveImageCalls >= liveImageLimit) {
    fields.imageBackendStatus.textContent = "Live image limit reached for this report. Local renderer is still available.";
    return false;
  }

  liveImageCalls += 1;
  setImageLoading(true);
  fields.imageBackendStatus.textContent = `Requesting live reconstruction ${liveImageCalls} of ${liveImageLimit}...`;

  try {
    const response = await fetch(`${apiBase}/api/generate-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        narrative: fields.narrative.value.trim(),
        feedback,
        shape: getShape(),
        luminosity: fields.luminosity.value.trim(),
        motion: fields.motion.value,
        conditions: fields.conditions.value.trim(),
        bearing: fields.bearing.value,
        altitude: fields.altitude.value,
        phase: fields.phase.value
      })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Image generation failed.");

    await drawGeneratedImage(result.image, feedback);
    fields.imageBackendStatus.textContent = result.revisedPrompt
      ? "Live image generated. Prompt was refined by the backend."
      : "Live image generated.";
    return true;
  } catch (error) {
    fields.imageBackendStatus.textContent = `${error.message} Falling back to local renderer.`;
    return false;
  } finally {
    setImageLoading(false);
  }
};

const generateVisualization = async (feedback = "") => {
  activePrompt = fields.narrative.value.trim();
  setImageLoading(true);
  await new Promise((resolve) => setTimeout(resolve, 700));
  const usedLiveImage = await generateLiveImage(feedback);
  if (!usedLiveImage) {
    drawReconstruction(activePrompt || "Unspecified aerial anomaly", feedback);
    fields.imageBackendStatus.textContent = feedback
      ? "Demo revision loaded. Revisions remain enabled."
      : "Demo visualization loaded. Revisions are now enabled.";
  }
  setImageLoading(false);
};

const beginVisualization = () => {
  if (visualizationStarted) return;
  visualizationStarted = true;
  firstImageLoaded = false;
  setRevisionEnabled(false);
  generateVisualization("");
};

iterateImageButton.addEventListener("click", async () => {
  if (!firstImageLoaded) return;
  const feedback = fields.feedback.value.trim();
  activePrompt = activePrompt || fields.narrative.value.trim();
  await generateVisualization(feedback || "Refine visual reconstruction");
  fields.feedback.value = "";
});

const buildReportText = () => {
  const report = [
    "AVIATION ANOMALY REPORT",
    "",
    "1. Flight and position",
    `Date/time UTC: ${valueOrPending(fields.sightingTime.value)}`,
    `Aircraft/flight identifier: ${valueOrPending(fields.flightId.value)}`,
    `Aircraft type: ${valueOrPending(fields.aircraftType.value)}`,
    `Phase of flight: ${valueOrPending(fields.phase.value)}`,
    `Latitude: ${valueOrPending(fields.latitude.value)}`,
    `Longitude: ${valueOrPending(fields.longitude.value)}`,
    `Altitude MSL: ${valueOrPending(fields.altitude.value)} ft`,
    `Airspeed: ${valueOrPending(fields.airspeed.value)} kt`,
    `Heading: ${valueOrPending(fields.heading.value)} deg`,
    "",
    "2. Sighting characteristics",
    `Relative bearing: ${valueOrPending(fields.bearing.value)}`,
    `Estimated range: ${valueOrPending(fields.range.value)}`,
    `Duration: ${valueOrPending(fields.duration.value)}`,
    `Apparent shape: ${getShape()}`,
    `Color/luminosity: ${valueOrPending(fields.luminosity.value)}`,
    `Motion observed: ${valueOrPending(fields.motion.value)}`,
    `Environmental conditions: ${valueOrPending(fields.conditions.value)}`,
    `Sensor or traffic context: ${valueOrPending(fields.sensorContext.value)}`,
    `Safety or operational impact: ${fields.safetyImpact.checked ? "Yes" : "No"}`,
    `Operational impact notes: ${valueOrPending(fields.impactNotes.value)}`,
    "",
    "3. Narrative",
    valueOrPending(fields.narrative.value),
    "",
    "4. Visual reconstruction notes",
    imageIteration
      ? `POC reconstruction iterations completed: ${imageIteration}. Feedback log: ${[...imageLog.querySelectorAll("li")].map((li) => li.textContent).reverse().join(" | ")}`
      : "No visual reconstruction generated yet.",
    "",
    "5. Reporter review",
    "Please review for completeness, de-identification requirements, and attachment handling before formal intake."
  ].join("\n");
  return report;
};

const updateReviewExhibits = () => {
  drawRadar();
  reviewRadarImage.src = radarCanvas.toDataURL("image/png");
  reviewDemoImage.src = reconstructionCanvas.toDataURL("image/png");
};

const buildSubmissionPayload = () => {
  finalReport.value = finalReport.value || buildReportText();
  updateReviewExhibits();
  return {
    submittedAt: new Date().toISOString(),
    report: finalReport.value,
    flight: {
      sightingTime: fields.sightingTime.value,
      flightId: fields.flightId.value,
      aircraftType: fields.aircraftType.value,
      latitude: fields.latitude.value,
      longitude: fields.longitude.value,
      altitude: fields.altitude.value,
      airspeed: fields.airspeed.value,
      heading: fields.heading.value
    },
    images: [
      {
        title: "Heading and Airspeed Visualization",
        data: radarCanvas.toDataURL("image/png")
      },
      {
        title: "Demo Visualization",
        data: reconstructionCanvas.toDataURL("image/png")
      }
    ],
    fileName: "aviation-anomaly-report.pdf"
  };
};

const submitToAppsScript = async (url, payload) => {
  await fetch(url, {
    method: "POST",
    mode: "no-cors",
    body: JSON.stringify(payload)
  });
};

const savePdfThroughApi = async (apiBase, payload) => {
  const response = await fetch(`${apiBase}/api/save-report-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      report: payload.report,
      images: payload.images,
      image: payload.images[1]?.data,
      fileName: payload.fileName
    })
  });

  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || "The backend could not save the PDF.");
  }

  const blob = await response.blob();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = payload.fileName;
  link.click();
  URL.revokeObjectURL(link.href);
};

const updateAll = () => {
  drawRadar();
  fields.readoutCoords.textContent = fields.latitude.value && fields.longitude.value
    ? `${Number(fields.latitude.value).toFixed(6)}, ${Number(fields.longitude.value).toFixed(6)}`
    : "Lat/long pending";
  fields.readoutFlight.textContent = fields.altitude.value && fields.airspeed.value
    ? `${fields.altitude.value} ft MSL at ${fields.airspeed.value} kt`
    : "Flight context pending";
};

const submitReport = async () => {
  const payload = buildSubmissionPayload();
  const reportSubmitUrl = normalizeReportSubmitUrl();
  const apiBase = normalizeApiBase();
  submitReportButton.disabled = true;
  submitConfirmation.textContent = "Saving report...";

  try {
    if (reportSubmitUrl) {
      await submitToAppsScript(reportSubmitUrl, payload);
      submitConfirmation.textContent = "Report saved to the demo backend. A PDF copy will be stored in Drive.";
      return;
    }

    if (apiBase) {
      await savePdfThroughApi(apiBase, payload);
      submitConfirmation.textContent = "Report submitted for this prototype. A PDF copy was saved.";
      return;
    }

    throw new Error("No report backend is configured. Add an Apps Script URL in config.js.");
  } catch (error) {
    submitConfirmation.textContent = `${error.message} Report was not transmitted.`;
  } finally {
    submitReportButton.disabled = false;
  }
};

submitReportButton.addEventListener("click", submitReport);

form.addEventListener("input", updateAll);
document.querySelectorAll("input[name='shape']").forEach((input) => input.addEventListener("change", updateAll));
fields.apiBaseUrl.addEventListener("input", () => {
  const apiBase = fields.apiBaseUrl.value.trim();
  if (apiBase) {
    localStorage.setItem("uapImageApiBase", apiBase);
    fields.imageBackendStatus.textContent = "Live image backend configured.";
  } else {
    localStorage.removeItem("uapImageApiBase");
    fields.imageBackendStatus.textContent = "Using local POC renderer until an API URL is set.";
  }
});

setInitialTime();
fields.apiBaseUrl.value = localStorage.getItem("uapImageApiBase") || "";
if (fields.apiBaseUrl.value) fields.imageBackendStatus.textContent = "Live image backend configured.";
fields.latitude.value = "39.871944";
fields.longitude.value = "-75.241111";
fields.altitude.value = fields.altitudeRange.value;
fields.airspeed.value = fields.airspeedRange.value;
updateHeading(90);
imageIteration = 0;
imageLog.innerHTML = "";
setRevisionEnabled(false);
setStep("flight");
