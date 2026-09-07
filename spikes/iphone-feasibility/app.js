"use strict";

const TEST_DEFINITIONS = [
  { id: "install", label: "Secure, installed app" },
  { id: "photo-inputs", label: "Camera and photo library" },
  { id: "photo-processing", label: "HEIC orientation and optimization" },
  { id: "storage", label: "Durable local storage" },
  { id: "voice", label: "Microphone and transcription" },
  { id: "files", label: "Apple Files export" },
];

const requestedParameters = new URLSearchParams(window.location.search);
const requestedRunId = requestedParameters.get("run") || "owner";
const runId = /^[a-z0-9-]{1,32}$/i.test(requestedRunId) ? requestedRunId.toLowerCase() : "owner";
const storageSimulation = runId.startsWith("automated-") ? requestedParameters.get("simulate") || "" : "";
const voiceConfig = window.WIM_VOICE_CONFIG || { enabled: false, sessionEndpoint: "", region: "us-east-2", maxCaptureSeconds: 45 };
const STATE_KEY = `what-i-made-feasibility-state-v1-${runId}`;
const DB_NAME = `what-i-made-feasibility-${runId}`;
const DB_VERSION = 1;
const STORE_NAME = "diagnostics";
const OWNER_TOKEN_RECORD_ID = "voice-owner-token";
const currentLoadId = createId();

const defaultState = {
  install: {
    secure: window.isSecureContext,
    standalone: false,
    serviceWorker: null,
    error: "",
  },
  photoInputs: {
    camera: false,
    library: false,
  },
  photoProcessing: {
    processed: false,
    error: "",
    orientation: null,
    details: null,
  },
  storage: {
    indexedDb: "indexedDB" in window,
    writeRead: false,
    blobRoundTrip: false,
    arrayBufferRoundTrip: false,
    storageMode: null,
    attemptId: null,
    survivedReload: false,
    persistent: null,
    usage: null,
    quota: null,
    directBlobError: "",
    errorStage: "",
    error: "",
  },
  voice: {
    mediaDevices: Boolean(navigator.mediaDevices?.getUserMedia),
    recognitionSupported: Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
    localOnlyControl: false,
    processingMode: "not-started",
    microphone: "idle",
    recognition: "idle",
    transcriptReceived: false,
    transcriptCharacters: 0,
    awsConfigured: false,
    awsState: "idle",
    awsTranscriptReceived: false,
    awsProcessingMode: "not-configured",
    awsError: "",
    error: "",
  },
  files: {
    fileShareSupported: false,
    shareOpened: false,
    confirmation: null,
    fallbackDownloaded: false,
    error: "",
  },
};

let state = mergeState(defaultState, loadSavedState());
let databasePromise = null;
let previewUrl = "";
let latestOptimizedBlob = null;
let activeRecognition = null;
let recognitionTimer = null;
let activeAwsAdapter = null;
let activeAwsTranscript = null;
let ownerToken = "";
let awsElapsedTimer = null;
let awsStartedAt = null;

const elements = {
  progressCount: document.querySelector("#progress-count"),
  progressTrack: document.querySelector("#progress-track"),
  progressFill: document.querySelector("#progress-fill"),
  environmentSecure: document.querySelector("#environment-secure"),
  environmentDisplay: document.querySelector("#environment-display"),
  environmentStorage: document.querySelector("#environment-storage"),
  installResults: document.querySelector("#install-results"),
  photoInputResults: document.querySelector("#photo-input-results"),
  photoMessage: document.querySelector("#photo-message"),
  processingMessage: document.querySelector("#processing-message"),
  photoPreviewShell: document.querySelector("#photo-preview-shell"),
  photoPreview: document.querySelector("#photo-preview"),
  photoCaption: document.querySelector("#photo-caption"),
  photoMetrics: document.querySelector("#photo-metrics"),
  photoSource: document.querySelector("#photo-source"),
  photoOriginal: document.querySelector("#photo-original"),
  photoOptimized: document.querySelector("#photo-optimized"),
  photoReduction: document.querySelector("#photo-reduction"),
  orientationYes: document.querySelector("#orientation-yes"),
  orientationNo: document.querySelector("#orientation-no"),
  storageResults: document.querySelector("#storage-results"),
  storageMessage: document.querySelector("#storage-message"),
  voiceResults: document.querySelector("#voice-results"),
  voiceMessage: document.querySelector("#voice-message"),
  transcript: document.querySelector("#transcript"),
  transcriptionButton: document.querySelector("#start-transcription"),
  awsTranscriptionButton: document.querySelector("#start-aws-transcription"),
  awsCancelButton: document.querySelector("#cancel-aws-transcription"),
  awsVoiceStatus: document.querySelector("#aws-voice-status"),
  awsLiveTranscriptShell: document.querySelector("#aws-live-transcript-shell"),
  awsLiveTranscript: document.querySelector("#aws-live-transcript"),
  ownerTokenInput: document.querySelector("#owner-token"),
  saveOwnerTokenButton: document.querySelector("#save-owner-token"),
  removeOwnerTokenButton: document.querySelector("#remove-owner-token"),
  tokenMessage: document.querySelector("#token-message"),
  voiceSetup: document.querySelector("#voice-setup"),
  filesResults: document.querySelector("#files-results"),
  filesMessage: document.querySelector("#files-message"),
  filesConfirmation: document.querySelector("#files-confirmation"),
  filesYes: document.querySelector("#files-yes"),
  filesNo: document.querySelector("#files-no"),
  summaryResults: document.querySelector("#summary-results"),
  reportPreview: document.querySelector("#report-preview"),
  summaryMessage: document.querySelector("#summary-message"),
  announcement: document.querySelector("#announcement"),
};

initialize();

async function initialize() {
  bindEvents();
  state.install.secure = window.isSecureContext;
  state.install.standalone = isStandalone();
  state.storage.indexedDb = "indexedDB" in window;
  state.voice.mediaDevices = Boolean(navigator.mediaDevices?.getUserMedia);
  state.voice.recognitionSupported = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  state.voice.localOnlyControl = detectLocalRecognitionControl();
  state.voice.awsConfigured = Boolean(voiceConfig.enabled && (voiceConfig.fake || voiceConfig.sessionEndpoint));
  state.voice.awsProcessingMode = voiceConfig.fake ? "local-test-simulation" : state.voice.awsConfigured ? "amazon-transcribe-streaming" : "not-configured";
  state.files.fileShareSupported = detectFileSharing();
  await Promise.allSettled([
    registerServiceWorker(),
    refreshStorageEstimate(),
    restoreStoredEvidence(),
    restoreOwnerToken(),
  ]);
  saveState();
  renderAll();
}

function bindEvents() {
  document.querySelector("#refresh-install").addEventListener("click", async () => {
    state.install.secure = window.isSecureContext;
    state.install.standalone = isStandalone();
    await registerServiceWorker();
    saveAndRender("Install check updated.");
  });

  document.querySelector("#camera-input").addEventListener("change", (event) => {
    handlePhotoSelection(event, "camera");
  });
  document.querySelector("#library-input").addEventListener("change", (event) => {
    handlePhotoSelection(event, "library");
  });

  elements.orientationYes.addEventListener("click", () => setOrientationResult(true));
  elements.orientationNo.addEventListener("click", () => setOrientationResult(false));

  document.querySelector("#run-storage").addEventListener("click", runStorageTest);
  document.querySelector("#clear-storage").addEventListener("click", clearStoredEvidence);
  document.querySelector("#check-microphone").addEventListener("click", checkMicrophone);
  elements.transcriptionButton.addEventListener("click", toggleTranscription);
  elements.awsTranscriptionButton.addEventListener("click", toggleAwsTranscription);
  elements.awsCancelButton.addEventListener("click", () => cancelAwsTranscription("Cancelled. Your visible text is still editable."));
  elements.saveOwnerTokenButton.addEventListener("click", saveOwnerToken);
  elements.removeOwnerTokenButton.addEventListener("click", removeOwnerToken);

  elements.transcript.addEventListener("input", () => {
    state.voice.transcriptCharacters = elements.transcript.value.trim().length;
    saveAndRender();
  });

  document.querySelector("#share-test-file").addEventListener("click", shareTestFile);
  elements.filesYes.addEventListener("click", () => setFilesConfirmation(true));
  elements.filesNo.addEventListener("click", () => setFilesConfirmation(false));
  document.querySelector("#copy-results").addEventListener("click", copyResults);
  document.querySelector("#download-results").addEventListener("click", downloadResults);
  document.querySelector("#reset-all").addEventListener("click", resetAllResults);

  const displayMode = window.matchMedia("(display-mode: standalone)");
  displayMode.addEventListener?.("change", () => {
    state.install.standalone = isStandalone();
    saveAndRender("Display mode changed. Install check updated.");
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && activeAwsAdapter) cancelAwsTranscription("Stopped when the app moved to the background.");
  });
  window.addEventListener("pagehide", () => activeAwsAdapter?.cancel("Page closed"));
}

function mergeState(base, saved) {
  const merged = structuredCloneSafe(base);
  if (!saved || typeof saved !== "object") return merged;

  for (const key of Object.keys(merged)) {
    if (saved[key] && typeof saved[key] === "object") {
      Object.assign(merged[key], saved[key]);
    }
  }
  return merged;
}

function structuredCloneSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

function createId() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadSavedState() {
  try {
    return JSON.parse(localStorage.getItem(STATE_KEY) || "null");
  } catch {
    return null;
  }
}

function saveState() {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    // IndexedDB is the capability under test; localStorage failure should not stop the lab.
  }
}

function saveAndRender(announcement = "") {
  saveState();
  renderAll();
  if (announcement) announce(announcement);
}

function announce(message) {
  elements.announcement.textContent = "";
  window.setTimeout(() => {
    elements.announcement.textContent = message;
  }, 20);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
}

function detectFileSharing() {
  if (!navigator.share || !navigator.canShare || typeof File !== "function") return false;
  try {
    const probe = new File(["test"], "what-i-made-share-test.txt", { type: "text/plain" });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

function detectLocalRecognitionControl() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) return false;
  try {
    const recognition = new Recognition();
    return "processLocally" in recognition;
  } catch {
    return false;
  }
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    state.install.serviceWorker = false;
    state.install.error = "Service workers are unavailable in this browser.";
    return;
  }
  if (!window.isSecureContext) {
    state.install.serviceWorker = false;
    state.install.error = "A secure HTTPS connection is required.";
    return;
  }

  try {
    await navigator.serviceWorker.register("./sw.js", { scope: "./" });
    await navigator.serviceWorker.ready;
    state.install.serviceWorker = true;
    state.install.error = "";
  } catch (error) {
    state.install.serviceWorker = false;
    state.install.error = friendlyError(error);
  }
}

async function refreshStorageEstimate() {
  if (!navigator.storage?.estimate) return;
  try {
    const estimate = await navigator.storage.estimate();
    state.storage.usage = Number.isFinite(estimate.usage) ? estimate.usage : null;
    state.storage.quota = Number.isFinite(estimate.quota) ? estimate.quota : null;
  } catch {
    state.storage.usage = null;
    state.storage.quota = null;
  }
}

async function handlePhotoSelection(event, source) {
  const input = event.currentTarget;
  const file = input.files?.[0];
  if (!file) return;

  state.photoInputs[source] = true;
  state.photoProcessing.processed = false;
  state.photoProcessing.error = "";
  state.photoProcessing.orientation = null;
  state.photoProcessing.details = null;
  latestOptimizedBlob = null;
  clearPhotoPreview();
  try {
    await deleteRecord("latest-photo");
  } catch {
    // A stale preview must not be reported, even if the diagnostic store is unavailable.
  }
  elements.photoMessage.textContent = `Processing ${file.name || "selected image"} locally…`;
  elements.processingMessage.textContent = "Decoding and creating the planned JPEG display copy…";
  saveState();
  renderAll();

  try {
    const result = await processPhoto(file, source);
    latestOptimizedBlob = result.blob;
    state.photoProcessing.processed = true;
    state.photoProcessing.details = result.details;
    state.photoProcessing.error = "";
    showPhotoPreview(result.blob, result.details);
    elements.photoMessage.textContent = `${source === "camera" ? "Camera" : "Library"} selection worked. Try the other entry point too.`;
    elements.processingMessage.textContent = "Processing succeeded. Confirm whether the preview is upright.";
    saveAndRender(`${source === "camera" ? "Camera" : "Library"} photo processed locally.`);
  } catch (error) {
    state.photoProcessing.processed = false;
    state.photoProcessing.details = null;
    state.photoProcessing.error = friendlyError(error);
    elements.photoMessage.textContent = `The ${source} image could not be processed: ${state.photoProcessing.error}`;
    elements.processingMessage.textContent = "Try a different image and record this as a device compatibility issue if it repeats.";
    saveAndRender("Photo processing needs attention.");
  } finally {
    input.value = "";
  }
}

async function processPhoto(file, source) {
  if (!file.type.startsWith("image/") && !/\.(heic|heif|jpe?g|png|webp)$/i.test(file.name)) {
    throw new Error("The selected file does not look like a supported image.");
  }

  const image = await decodeImage(file);
  let canvas = drawScaledImage(image, 2048);
  let quality = 0.82;
  let blob = await canvasToJpeg(canvas, quality);

  if (blob.size > 1_200_000) {
    quality = 0.72;
    blob = await canvasToJpeg(canvas, quality);
  }

  if (blob.size > 1_200_000 && Math.max(canvas.width, canvas.height) > 1600) {
    canvas = drawScaledImage(image, 1600);
    blob = await canvasToJpeg(canvas, 0.72);
  }

  if (blob.size > 1_200_000) {
    quality = 0.62;
    blob = await canvasToJpeg(canvas, quality);
  }

  if (blob.size > 1_200_000 && Math.max(canvas.width, canvas.height) > 1280) {
    canvas = drawScaledImage(image, 1280);
    blob = await canvasToJpeg(canvas, quality);
  }

  if (blob.size > 1_200_000) {
    image.cleanup();
    throw new Error("The local processor could not reach the 1.2 MB display-copy limit.");
  }

  image.cleanup();

  const reduction = file.size > 0 ? Math.round((1 - blob.size / file.size) * 100) : null;
  const details = {
    source,
    fileName: file.name || "Unnamed image",
    sourceType: file.type || inferImageType(file.name),
    originalBytes: file.size,
    originalWidth: image.width,
    originalHeight: image.height,
    optimizedBytes: blob.size,
    optimizedWidth: canvas.width,
    optimizedHeight: canvas.height,
    quality,
    reduction,
  };

  return { blob, details };
}

async function decodeImage(file) {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  image.src = url;

  try {
    if (image.decode) {
      await image.decode();
    } else {
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error("Safari could not decode this image."));
      });
    }
  } catch {
    URL.revokeObjectURL(url);
    throw new Error("Safari could not decode this image. Record the file type and try one more photo.");
  }

  if (!image.naturalWidth || !image.naturalHeight) {
    URL.revokeObjectURL(url);
    throw new Error("The image decoded without usable dimensions.");
  }

  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    cleanup: () => URL.revokeObjectURL(url),
  };
}

function drawScaledImage(image, maximumLongEdge) {
  const longEdge = Math.max(image.width, image.height);
  const scale = Math.min(1, maximumLongEdge / longEdge);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false, colorSpace: "srgb" }) || canvas.getContext("2d");

  if (!context) throw new Error("Canvas image processing is unavailable.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image.source, 0, 0, width, height);
  return canvas;
}

function canvasToJpeg(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Safari could not create the optimized JPEG."));
      },
      "image/jpeg",
      quality,
    );
  });
}

function inferImageType(fileName) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  return extension ? `.${extension}` : "Unknown";
}

function showPhotoPreview(blob, details) {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(blob);
  elements.photoPreview.src = previewUrl;
  elements.photoPreviewShell.hidden = false;
  elements.photoMetrics.hidden = false;
  elements.photoCaption.textContent = `${details.fileName} · display copy created locally`;
  elements.photoSource.textContent = `${details.source === "camera" ? "Camera" : "Library"} · ${details.sourceType}`;
  elements.photoOriginal.textContent = `${details.originalWidth} × ${details.originalHeight} · ${formatBytes(details.originalBytes)}`;
  elements.photoOptimized.textContent = `${details.optimizedWidth} × ${details.optimizedHeight} · ${formatBytes(details.optimizedBytes)}`;
  elements.photoReduction.textContent = formatReduction(details.reduction);
}

function clearPhotoPreview() {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = "";
  elements.photoPreview.removeAttribute("src");
  elements.photoPreviewShell.hidden = true;
  elements.photoMetrics.hidden = true;
  elements.photoCaption.textContent = "Processed locally";
}

function setOrientationResult(isCorrect) {
  if (!state.photoProcessing.processed) return;
  state.photoProcessing.orientation = isCorrect;
  elements.processingMessage.textContent = isCorrect
    ? "Orientation confirmed. The portable JPEG is ready for the storage test."
    : "Orientation is incorrect. We will need a dedicated HEIC orientation adapter before production.";
  saveAndRender(isCorrect ? "Photo orientation confirmed." : "Photo orientation issue recorded.");
}

async function openDatabase() {
  if (!("indexedDB" in window)) throw new Error("IndexedDB is unavailable in this browser.");
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB could not be opened."));
  });

  return databasePromise;
}

async function putRecord(record) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const request = transaction.objectStore(STORE_NAME).put(record);
    let requestError = null;
    request.onerror = () => {
      requestError = request.error;
    };
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(requestError || transaction.error || new Error("IndexedDB write failed without a browser error detail."));
    transaction.onabort = () => reject(requestError || transaction.error || new Error("IndexedDB write was aborted without a browser error detail."));
  });
}

async function getRecord(id) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error("IndexedDB read failed."));
  });
}

async function deleteRecord(id) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const request = transaction.objectStore(STORE_NAME).delete(id);
    let requestError = null;
    request.onerror = () => {
      requestError = request.error;
    };
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(requestError || transaction.error || new Error("IndexedDB delete failed without a browser error detail."));
    transaction.onabort = () => reject(requestError || transaction.error || new Error("IndexedDB delete was aborted without a browser error detail."));
  });
}

async function resetDatabaseConnection() {
  try {
    const database = await databasePromise;
    database?.close();
  } catch {
    // The next open attempt provides the useful error if Safari's IDB process is unavailable.
  }
  databasePromise = null;
}

async function restoreStoredEvidence() {
  if (!("indexedDB" in window)) return;
  state.storage.writeRead = false;
  state.storage.blobRoundTrip = false;
  state.storage.arrayBufferRoundTrip = false;
  state.storage.storageMode = null;
  state.storage.survivedReload = false;
  try {
    const [metadataRecord, durabilityRecord] = await Promise.all([
      getRecord("durability-metadata-check"),
      getRecord("durability-check"),
    ]);

    const metadataSurvived = metadataRecord?.loadId && metadataRecord.loadId !== currentLoadId;
    const binarySurvived = durabilityRecord?.loadId && durabilityRecord.loadId !== currentLoadId;
    const metadataMatchesLatest =
      metadataSurvived && state.storage.attemptId && metadataRecord?.attemptId === state.storage.attemptId;
    state.storage.writeRead = Boolean(metadataMatchesLatest && metadataRecord.token);
    if (state.storage.error) {
      elements.storageMessage.textContent = `Last storage test failed: ${state.storage.error}`;
      return;
    }
    const matchingAttempt =
      metadataMatchesLatest &&
      binarySurvived &&
      durabilityRecord?.attemptId === state.storage.attemptId;
    if (!metadataSurvived || !binarySurvived || !matchingAttempt) {
      return;
    }

    state.storage.storageMode = durabilityRecord.storageMode || (durabilityRecord.blob instanceof Blob ? "blob" : null);
    state.storage.blobRoundTrip =
      state.storage.storageMode === "blob" &&
      durabilityRecord.binary instanceof Blob &&
      durabilityRecord.binary.size === durabilityRecord.byteLength;
    state.storage.arrayBufferRoundTrip =
      state.storage.storageMode === "array-buffer" &&
      durabilityRecord.binary instanceof ArrayBuffer &&
      durabilityRecord.binary.byteLength === durabilityRecord.byteLength;
    state.storage.survivedReload =
      state.storage.writeRead && (state.storage.blobRoundTrip || state.storage.arrayBufferRoundTrip);

    if (state.storage.survivedReload) {
      elements.storageMessage.textContent = state.storage.storageMode === "array-buffer"
        ? "The metadata and ArrayBuffer photo adapter survived a page reload on this device."
        : "The metadata and photo Blob survived a page reload on this device.";
    }

    if (durabilityRecord.details) {
      const restoredBlob = durabilityRecord.binary instanceof Blob
        ? durabilityRecord.binary
        : new Blob([durabilityRecord.binary], { type: durabilityRecord.contentType || "image/jpeg" });
      latestOptimizedBlob = restoredBlob;
      showPhotoPreview(restoredBlob, durabilityRecord.details);
    }
  } catch (error) {
    state.storage.errorStage = "reload-read";
    state.storage.error = describeStorageError(error);
  }
}

async function runStorageTest() {
  state.storage.error = "";
  state.storage.errorStage = "";
  state.storage.directBlobError = "";
  state.storage.writeRead = false;
  state.storage.blobRoundTrip = false;
  state.storage.arrayBufferRoundTrip = false;
  state.storage.storageMode = null;
  state.storage.attemptId = createId();
  state.storage.survivedReload = false;
  state.storage.persistent = null;
  elements.storageMessage.textContent = "Testing metadata, direct photo Blob storage, and the portable fallback…";
  renderAll();

  try {
    state.storage.errorStage = "preflight-clear";
    if (storageSimulation === "preflight-failure") {
      throw new DOMException("Simulated evidence-clear rejection for the automated stale-evidence check.", "UnknownError");
    }
    await resetDatabaseConnection();
    await deleteRecord("durability-metadata-check");
    await deleteRecord("durability-check");

    const testBlob = latestOptimizedBlob || new Blob(["what-i-made-local-photo-test"], { type: "image/jpeg" });
    const attemptId = state.storage.attemptId;
    const metadataRecord = {
      id: "durability-metadata-check",
      attemptId,
      loadId: currentLoadId,
      token: createId(),
      createdAt: new Date().toISOString(),
    };

    state.storage.errorStage = "metadata-write";
    if (storageSimulation === "metadata-failure") {
      throw new DOMException("Simulated metadata rejection for the automated stale-evidence check.", "UnknownError");
    }
    await putRecord(metadataRecord);
    state.storage.errorStage = "metadata-read";
    const restoredMetadata = await getRecord(metadataRecord.id);
    state.storage.writeRead = restoredMetadata?.token === metadataRecord.token;
    if (!state.storage.writeRead) throw new Error("IndexedDB returned different metadata than the value that was written.");

    const binaryRecord = {
      id: "durability-check",
      attemptId,
      loadId: currentLoadId,
      token: createId(),
      storageMode: "blob",
      binary: testBlob,
      byteLength: testBlob.size,
      contentType: testBlob.type || "image/jpeg",
      details: state.photoProcessing.details,
      createdAt: new Date().toISOString(),
    };

    try {
      state.storage.errorStage = "blob-write";
      if (storageSimulation === "blob-failure" || storageSimulation === "binary-failure") {
        throw new DOMException("Simulated direct Blob rejection for the automated adapter check.", "DataCloneError");
      }
      await putRecord(binaryRecord);
      state.storage.errorStage = "blob-read";
      const restored = await getRecord(binaryRecord.id);
      state.storage.blobRoundTrip =
        restored?.token === binaryRecord.token &&
        restored?.binary instanceof Blob &&
        restored.binary.size === testBlob.size;
      if (!state.storage.blobRoundTrip) throw new Error("IndexedDB did not return the same photo Blob that was written.");
      state.storage.storageMode = "blob";
    } catch (blobError) {
      state.storage.directBlobError = describeStorageError(blobError);
      await resetDatabaseConnection();

      const arrayBuffer = await testBlob.arrayBuffer();
      const fallbackRecord = {
        ...binaryRecord,
        storageMode: "array-buffer",
        binary: arrayBuffer,
        byteLength: arrayBuffer.byteLength,
      };
      state.storage.errorStage = "array-buffer-write";
      if (storageSimulation === "binary-failure") {
        throw new DOMException("Simulated ArrayBuffer rejection for the automated stale-evidence check.", "UnknownError");
      }
      await putRecord(fallbackRecord);
      state.storage.errorStage = "array-buffer-read";
      const restoredFallback = await getRecord(fallbackRecord.id);
      state.storage.arrayBufferRoundTrip =
        restoredFallback?.token === fallbackRecord.token &&
        restoredFallback?.binary instanceof ArrayBuffer &&
        restoredFallback.binary.byteLength === arrayBuffer.byteLength;
      if (!state.storage.arrayBufferRoundTrip) {
        throw new Error("IndexedDB did not return the same ArrayBuffer that was written by the fallback adapter.");
      }
      state.storage.storageMode = "array-buffer";
    }

    if (navigator.storage?.persist) {
      try {
        state.storage.persistent = await navigator.storage.persist();
      } catch {
        state.storage.persistent = false;
      }
    }

    await refreshStorageEstimate();
    state.storage.errorStage = "";
    state.storage.error = "";
    elements.storageMessage.textContent = state.storage.storageMode === "array-buffer"
      ? `Metadata passed. Safari rejected direct Blob storage (${state.storage.directBlobError}), but the ArrayBuffer adapter passed. Reload once to prove durability.`
      : "Metadata and direct photo Blob storage passed. Reload this page once to prove durability.";
    saveAndRender("Local storage check completed.");
  } catch (error) {
    const failedStage = state.storage.errorStage || "unknown";
    state.storage.error = `${failedStage}: ${describeStorageError(error)}`;
    state.storage.blobRoundTrip = false;
    state.storage.arrayBufferRoundTrip = false;
    elements.storageMessage.textContent = state.storage.directBlobError
      ? `Storage test failed. Direct Blob: ${state.storage.directBlobError} Fallback: ${state.storage.error}`
      : `Storage test failed: ${state.storage.error}`;
    saveAndRender("Local storage check failed.");
  }
}

async function clearStoredEvidence() {
  try {
    const database = await openDatabase();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).clear();
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error("Could not clear the diagnostic store."));
    });

    state.storage.writeRead = false;
    state.storage.blobRoundTrip = false;
    state.storage.arrayBufferRoundTrip = false;
    state.storage.storageMode = null;
    state.storage.attemptId = null;
    state.storage.survivedReload = false;
    state.storage.persistent = null;
    state.storage.directBlobError = "";
    state.storage.errorStage = "";
    state.storage.error = "";
    latestOptimizedBlob = null;
    elements.storageMessage.textContent = "Diagnostic IndexedDB records were removed.";
    saveAndRender("Diagnostic storage cleared.");
  } catch (error) {
    elements.storageMessage.textContent = `Could not clear lab data: ${friendlyError(error)}`;
  }
}

async function checkMicrophone() {
  state.voice.error = "";
  if (!navigator.mediaDevices?.getUserMedia) {
    state.voice.microphone = "unsupported";
    elements.voiceMessage.textContent = "Microphone capture is unavailable in this browser context.";
    saveAndRender("Microphone capture is unavailable.");
    return;
  }

  state.voice.microphone = "checking";
  elements.voiceMessage.textContent = "Requesting microphone access…";
  renderAll();

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    state.voice.microphone = "pass";
    elements.voiceMessage.textContent = state.voice.recognitionSupported
      ? "Microphone access worked. Now try one sentence of transcription."
      : "Microphone access worked, but browser transcription is unavailable. AWS fallback is likely needed.";
    saveAndRender("Microphone access worked.");
  } catch (error) {
    state.voice.microphone = "fail";
    state.voice.error = friendlyMediaError(error);
    elements.voiceMessage.textContent = state.voice.error;
    saveAndRender("Microphone access needs attention.");
  }
}

async function restoreOwnerToken() {
  if (!("indexedDB" in window)) {
    elements.tokenMessage.textContent = "IndexedDB is unavailable, so private voice setup cannot be saved.";
    return;
  }
  try {
    const record = await getRecord(OWNER_TOKEN_RECORD_ID);
    ownerToken = typeof record?.token === "string" ? record.token : "";
    elements.tokenMessage.textContent = ownerToken
      ? "Owner token saved on this device."
      : "No owner token is saved.";
  } catch (error) {
    elements.tokenMessage.textContent = `Could not read private voice setup: ${friendlyError(error)}`;
  }
}

async function saveOwnerToken() {
  const token = elements.ownerTokenInput.value.trim();
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) {
    elements.tokenMessage.textContent = "Use the 32-character-or-longer private token created during AWS setup.";
    elements.ownerTokenInput.focus();
    return;
  }
  elements.saveOwnerTokenButton.disabled = true;
  try {
    await putRecord({ id: OWNER_TOKEN_RECORD_ID, token, savedAt: new Date().toISOString() });
    ownerToken = token;
    elements.ownerTokenInput.value = "";
    elements.tokenMessage.textContent = "Owner token saved on this device.";
    elements.voiceSetup.open = false;
    announce("Private voice setup saved.");
  } catch (error) {
    elements.tokenMessage.textContent = `Could not save the token: ${friendlyError(error)}`;
  } finally {
    elements.saveOwnerTokenButton.disabled = false;
    updateAwsControls();
  }
}

async function removeOwnerToken() {
  if (activeAwsAdapter) await cancelAwsTranscription("Voice access was removed.");
  try {
    await deleteRecord(OWNER_TOKEN_RECORD_ID);
    ownerToken = "";
    elements.ownerTokenInput.value = "";
    elements.tokenMessage.textContent = "Owner token removed from this device.";
    announce("Private voice setup removed.");
  } catch (error) {
    elements.tokenMessage.textContent = `Could not remove the token: ${friendlyError(error)}`;
  }
  updateAwsControls();
}

function toggleAwsTranscription() {
  if (activeAwsAdapter?.state === "listening") {
    activeAwsAdapter.stop();
    return;
  }
  startAwsTranscription();
}

async function startAwsTranscription() {
  if (!state.voice.awsConfigured) {
    elements.awsVoiceStatus.textContent = "AWS voice setup has not been deployed. Dictation and typing remain available.";
    return;
  }
  if (!ownerToken) {
    elements.voiceSetup.open = true;
    elements.tokenMessage.textContent = "Save the private owner token before starting AWS voice.";
    elements.ownerTokenInput.focus();
    return;
  }
  if (activeAwsAdapter) return;

  const Adapter = voiceConfig.fake
    ? window.WhatIMadeTranscribe?.FakeTranscribeAdapter
    : window.WhatIMadeTranscribe?.AwsTranscribeAdapter;
  if (!Adapter) {
    state.voice.awsState = "fail";
    state.voice.awsError = "The AWS voice adapter did not load.";
    saveAndRender("AWS voice adapter unavailable.");
    return;
  }

  state.voice.awsError = "";
  state.voice.awsTranscriptReceived = false;
  const adapter = new Adapter({
    endpoint: voiceConfig.sessionEndpoint,
    maxCaptureSeconds: voiceConfig.maxCaptureSeconds || 45,
    failure: voiceConfig.fakeFailure,
    onState: (runtimeState, detail) => handleAwsState(adapter, runtimeState, detail),
    onText: (text, detail) => handleAwsText(adapter, text, detail),
  });
  activeAwsAdapter = adapter;
  activeAwsTranscript = { adapter, text: "", hasFinalText: false, committed: false };

  try {
    await adapter.start(ownerToken);
  } catch (error) {
    state.voice.awsError = error.message || "AWS transcription could not start.";
    if (activeAwsAdapter === adapter && adapter.state !== "failed") handleAwsState(adapter, "failed", state.voice.awsError);
  }
}

async function cancelAwsTranscription(message) {
  const adapter = activeAwsAdapter;
  if (!adapter) return;
  await adapter.cancel(message);
}

function handleAwsText(adapter, text, detail) {
  if (activeAwsAdapter !== adapter || activeAwsTranscript?.adapter !== adapter) return;
  activeAwsTranscript.text = text;
  activeAwsTranscript.hasFinalText = Boolean(detail?.hasFinalText);
  state.voice.awsTranscriptReceived = activeAwsTranscript.hasFinalText;
  elements.awsLiveTranscript.textContent = text;
  elements.awsLiveTranscriptShell.hidden = !text;
}

function commitAwsText(adapter) {
  const transcript = activeAwsTranscript;
  if (!transcript || transcript.adapter !== adapter || transcript.committed || !transcript.text.trim()) return;
  transcript.committed = true;
  const existing = elements.transcript.value.trimEnd();
  elements.transcript.value = existing ? `${existing}\n${transcript.text.trim()}` : transcript.text.trim();
  state.voice.transcriptCharacters = elements.transcript.value.trim().length;
}

function clearAwsLivePreview(adapter) {
  if (activeAwsTranscript?.adapter !== adapter) return;
  elements.awsLiveTranscript.textContent = "";
  elements.awsLiveTranscriptShell.hidden = true;
  activeAwsTranscript = null;
}

function handleAwsState(adapter, runtimeState, detail) {
  if (activeAwsAdapter !== adapter) return;
  window.clearInterval(awsElapsedTimer);
  awsElapsedTimer = null;

  if (runtimeState === "listening") {
    state.voice.awsState = "listening";
    awsStartedAt = performance.now();
    awsElapsedTimer = window.setInterval(() => {
      const elapsed = Math.floor((performance.now() - awsStartedAt) / 1000);
      const seconds = String(elapsed % 60).padStart(2, "0");
      elements.awsVoiceStatus.textContent = `Listening ${Math.floor(elapsed / 60)}:${seconds} · audio is streaming to Amazon Transcribe`;
    }, 500);
  } else if (runtimeState === "complete") {
    commitAwsText(adapter);
    state.voice.awsState = state.voice.awsTranscriptReceived ? "pass" : "fail";
    activeAwsAdapter = null;
    clearAwsLivePreview(adapter);
  } else if (runtimeState === "failed") {
    commitAwsText(adapter);
    state.voice.awsState = "fail";
    state.voice.awsError = detail || "AWS transcription stopped.";
    activeAwsAdapter = null;
    clearAwsLivePreview(adapter);
  } else {
    state.voice.awsState = runtimeState;
  }

  elements.awsVoiceStatus.textContent = detail || awsStateLabel(runtimeState);
  updateAwsControls();
  saveAndRender(`AWS voice: ${runtimeState}.`);
}

function updateAwsControls() {
  const runtimeState = activeAwsAdapter?.state || "idle";
  const active = ["authorizing", "connecting", "listening", "finishing"].includes(runtimeState);
  const canStop = runtimeState === "listening";
  elements.awsTranscriptionButton.disabled = !state.voice.awsConfigured || (active && !canStop);
  elements.awsTranscriptionButton.setAttribute("aria-pressed", String(canStop));
  elements.awsTranscriptionButton.innerHTML = canStop
    ? '<svg aria-hidden="true"><use href="#icon-stop"></use></svg>Done'
    : active
      ? '<svg aria-hidden="true"><use href="#icon-mic"></use></svg>Connecting…'
      : '<svg aria-hidden="true"><use href="#icon-mic"></use></svg>Speak your cook';
  elements.awsCancelButton.hidden = !active;

  if (!state.voice.awsConfigured) {
    elements.awsVoiceStatus.textContent = "AWS voice setup is not deployed yet. Dictation and typing remain available.";
  } else if (!ownerToken && !active) {
    elements.awsVoiceStatus.textContent = "Open Private voice setup and save the owner token.";
  }
}

function awsStateLabel(value = state.voice.awsState) {
  const labels = {
    idle: "Ready",
    authorizing: "Preparing microphone",
    connecting: "Opening secure AWS session",
    listening: "Listening",
    finishing: "Finishing transcript",
    complete: "Transcript ready",
    pass: "Usable transcript returned",
    fail: "AWS transcription needs attention",
  };
  return labels[value] || value;
}

function toggleTranscription() {
  if (activeRecognition) {
    activeRecognition.stop();
    return;
  }
  startTranscription();
}

function startTranscription() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    state.voice.recognition = "unsupported";
    elements.voiceMessage.textContent = "Browser speech recognition is unavailable. This is evidence for the AWS fallback.";
    saveAndRender("Browser speech recognition is unavailable.");
    return;
  }

  state.voice.error = "";
  state.voice.recognition = "starting";
  state.voice.transcriptReceived = false;
  setTranscriptionButton(true);
  elements.voiceMessage.textContent = "Starting transcription…";
  renderAll();

  const recognition = new Recognition();
  activeRecognition = recognition;
  state.voice.localOnlyControl = "processLocally" in recognition;
  if (state.voice.localOnlyControl) {
    recognition.processLocally = true;
    state.voice.processingMode = "on-device-required";
  } else {
    state.voice.processingMode = "browser-managed-may-use-apple";
  }
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = navigator.language || "en-US";

  recognition.onstart = () => {
    state.voice.recognition = "listening";
    elements.voiceMessage.textContent = "Listening now. Speak one natural cooking note, then tap Stop transcription.";
    saveAndRender("Transcription is listening.");
  };

  recognition.onresult = (event) => {
    let finalText = "";
    let interimText = "";
    for (let index = 0; index < event.results.length; index += 1) {
      const result = event.results[index];
      const text = result[0]?.transcript || "";
      if (result.isFinal) finalText += text;
      else interimText += text;
    }
    elements.transcript.value = `${finalText}${interimText}`.trim();
    state.voice.transcriptCharacters = elements.transcript.value.length;
    if (finalText.trim()) state.voice.transcriptReceived = true;
    renderAll();
  };

  recognition.onerror = (event) => {
    state.voice.error = friendlyRecognitionError(event.error);
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      state.voice.recognition = "fail";
    } else if (event.error !== "aborted") {
      state.voice.recognition = "attention";
    }
    elements.voiceMessage.textContent = state.voice.error;
  };

  recognition.onend = () => {
    window.clearTimeout(recognitionTimer);
    recognitionTimer = null;
    activeRecognition = null;
    setTranscriptionButton(false);
    state.voice.transcriptCharacters = elements.transcript.value.trim().length;
    if (state.voice.transcriptReceived) {
      state.voice.recognition = "pass";
      elements.voiceMessage.textContent = "Browser transcription returned usable text. Review its accuracy before marking this route viable.";
    } else if (state.voice.recognition !== "fail" && state.voice.recognition !== "attention") {
      state.voice.recognition = "attention";
      elements.voiceMessage.textContent = "The session ended without a final transcript. Try once more in a quiet room.";
    }
    saveAndRender("Transcription test ended.");
  };

  try {
    recognition.start();
    recognitionTimer = window.setTimeout(() => recognition.stop(), 45_000);
  } catch (error) {
    activeRecognition = null;
    setTranscriptionButton(false);
    state.voice.recognition = "fail";
    state.voice.error = friendlyError(error);
    elements.voiceMessage.textContent = state.voice.error;
    saveAndRender("Transcription could not start.");
  }
}

function setTranscriptionButton(isRecording) {
  elements.transcriptionButton.innerHTML = isRecording
    ? '<svg aria-hidden="true"><use href="#icon-stop"></use></svg>Stop transcription'
    : '<svg aria-hidden="true"><use href="#icon-mic"></use></svg>Retry Safari transcription';
  elements.transcriptionButton.setAttribute("aria-pressed", String(isRecording));
}

async function shareTestFile() {
  state.files.error = "";
  state.files.fileShareSupported = detectFileSharing();
  const report = buildReport();
  const file = new File([JSON.stringify(report, null, 2)], diagnosticFileName(), {
    type: "application/json",
  });

  if (state.files.fileShareSupported) {
    elements.filesMessage.textContent = "Opening the native share sheet…";
    try {
      await navigator.share({
        title: "What I Made feasibility result",
        text: "A private device-capability result from What I Made.",
        files: [file],
      });
      state.files.shareOpened = true;
      elements.filesConfirmation.hidden = false;
      elements.filesMessage.textContent = "The share action completed. Confirm whether Save to Files was available.";
      saveAndRender("Share sheet test completed. Confirmation is required.");
    } catch (error) {
      if (error?.name === "AbortError") {
        elements.filesMessage.textContent = "The share sheet was dismissed. No result was recorded; try again when ready.";
      } else {
        state.files.error = friendlyError(error);
        elements.filesMessage.textContent = `File sharing failed: ${state.files.error}`;
        saveAndRender("File sharing needs attention.");
      }
    }
    return;
  }

  downloadBlob(file, file.name);
  state.files.fallbackDownloaded = true;
  elements.filesMessage.textContent = "File sharing is unavailable here, so a standard download was used. Apple Files remains unverified.";
  saveAndRender("Standard download fallback used.");
}

function setFilesConfirmation(didAppear) {
  state.files.confirmation = didAppear;
  elements.filesMessage.textContent = didAppear
    ? "Save to Files is available. Portable manual backup is feasible on this device."
    : "Save to Files did not appear. We need another export route before production.";
  saveAndRender(didAppear ? "Apple Files export confirmed." : "Apple Files export issue recorded.");
}

async function copyResults() {
  const text = formatReportAsText(buildReport());
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      fallbackCopy(text);
    }
    elements.summaryMessage.textContent = "Results copied. They contain no photo or transcript text.";
    announce("Feasibility results copied.");
  } catch (error) {
    elements.summaryMessage.textContent = `Could not copy results: ${friendlyError(error)}`;
  }
}

function downloadResults() {
  const report = buildReport();
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  downloadBlob(blob, diagnosticFileName());
  elements.summaryMessage.textContent = "Diagnostic JSON downloaded. It contains no photo or transcript text.";
  announce("Feasibility report downloaded.");
}

function fallbackCopy(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.className = "sr-only";
  document.body.append(textarea);
  textarea.select();
  const didCopy = document.execCommand("copy");
  textarea.remove();
  if (!didCopy) throw new Error("Clipboard access is unavailable.");
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function resetAllResults() {
  const shouldReset = window.confirm("Reset every feasibility result and remove the lab's local diagnostic records?");
  if (!shouldReset) return;

  try {
    localStorage.removeItem(STATE_KEY);
    const database = await openDatabase();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).clear();
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error("Could not reset the lab."));
    });
  } finally {
    window.location.reload();
  }
}

function getTestStatuses() {
  const photoInputPass = state.photoInputs.camera && state.photoInputs.library;
  const photoProcessingPass = state.photoProcessing.processed && state.photoProcessing.orientation === true;
  const binaryStoragePass = state.storage.blobRoundTrip || state.storage.arrayBufferRoundTrip;
  const storagePass = state.storage.writeRead && binaryStoragePass && state.storage.survivedReload;
  const filesPass = state.files.confirmation === true;

  return {
    install: getInstallStatus(),
    "photo-inputs": photoInputPass
      ? status("pass", "Passed", "Both camera and photo-library inputs worked.")
      : state.photoInputs.camera || state.photoInputs.library
        ? status("attention", "One of two", "One photo entry point remains to be tested.")
        : state.photoProcessing.error
          ? status("fail", "Needs attention", state.photoProcessing.error)
          : status("idle", "Not run", "Camera and library have not been tried."),
    "photo-processing": photoProcessingPass
      ? status("pass", "Passed", "Local JPEG optimization and upright orientation confirmed.")
      : state.photoProcessing.orientation === false || state.photoProcessing.error
        ? status("fail", "Needs adapter", state.photoProcessing.error || "The processed image was not upright.")
        : state.photoProcessing.processed
          ? status("attention", "Check preview", "Processing worked; orientation needs manual confirmation.")
          : status("idle", "Waiting for photo", "Select a photo to begin."),
    storage: storagePass
      ? state.storage.storageMode === "array-buffer"
        ? status("pass", "Passed with adapter", "Metadata and the ArrayBuffer photo adapter survived an IndexedDB reload.")
        : status("pass", "Passed", "Metadata and the direct photo Blob survived an IndexedDB reload.")
      : state.storage.error
        ? status("fail", "Failed", state.storage.error)
        : state.storage.writeRead && binaryStoragePass
          ? status(
              "attention",
              "Reload once",
              state.storage.storageMode === "array-buffer"
                ? "The ArrayBuffer photo adapter worked; reload persistence is pending."
                : "Direct photo Blob storage worked; reload persistence is pending.",
            )
          : status("idle", "Not run", "The IndexedDB write/read test has not run."),
    voice: getVoiceStatus(),
    files: filesPass
      ? status("pass", "Passed", "Save to Files was available in the native share sheet.")
      : state.files.confirmation === false || state.files.error
        ? status("fail", "Needs another route", state.files.error || "Save to Files was not available.")
        : state.files.shareOpened || state.files.fallbackDownloaded
          ? status("attention", "Unconfirmed", "The file action ran, but Apple Files is not yet confirmed.")
          : status("idle", "Not run", "The native file-sharing check has not run."),
  };
}

function getInstallStatus() {
  if (!state.install.secure) {
    return status("fail", "Needs HTTPS", "This page is not running in a secure context.");
  }
  if (state.install.serviceWorker === false) {
    return status("fail", "Service worker failed", state.install.error || "The service worker could not register.");
  }
  if (state.install.serviceWorker === null) {
    return status("attention", "Checking", "Service-worker readiness is still being checked.");
  }
  if (!state.install.standalone) {
    return status("attention", "Needs Home Screen", "Secure context is ready; standalone display still needs confirmation.");
  }
  return status("pass", "Passed", "Secure context, service worker, and standalone display confirmed.");
}

function getVoiceStatus() {
  if (!state.voice.mediaDevices || state.voice.microphone === "unsupported") {
    return status("fail", "Microphone unavailable", "This browser context does not expose microphone capture.");
  }
  if (state.voice.microphone === "fail") {
    return status("fail", "Microphone failed", state.voice.error || "Microphone permission or capture failed.");
  }
  if (state.voice.awsState === "pass") {
    return status("pass", "AWS voice passed", "The custom button returned an editable transcript.");
  }
  if (state.voice.awsState === "fail") {
    return status("fail", "AWS voice failed", state.voice.awsError || "The custom transcription route failed.");
  }
  if (!state.voice.awsConfigured && state.voice.recognition === "fail") {
    return status("attention", "AWS selected", "Safari recognition failed; the reviewed AWS adapter is ready for deployment.");
  }
  if (!state.voice.recognitionSupported || state.voice.recognition === "unsupported") {
    return status("attention", "AWS likely", "Microphone may work, but browser speech recognition is unavailable.");
  }
  if (state.voice.microphone === "pass" && state.voice.recognition === "pass") {
    return state.voice.localOnlyControl
      ? status("pass", "Passed", "Microphone and required local-only Safari transcription returned usable results.")
      : status("pass", "Passed · disclosed", "Safari transcription worked under the disclosed possibility of Apple processing.");
  }
  if (state.voice.microphone === "pass" || state.voice.recognition !== "idle") {
    return status("attention", "Incomplete", "Complete both microphone and Safari transcription checks.");
  }
  return status("idle", "Not run", "Voice checks have not run.");
}

function status(tone, label, summary) {
  return { tone, label, summary };
}

function renderAll() {
  const statuses = getTestStatuses();
  renderEnvironment();
  renderStatusChips(statuses);
  renderDetailedResults();
  renderSummary(statuses);
  renderProgress(statuses);
  renderManualChoices();
  updateAwsControls();
}

function renderEnvironment() {
  elements.environmentSecure.textContent = state.install.secure ? "Secure context" : "HTTPS required";
  elements.environmentDisplay.textContent = state.install.standalone ? "Home Screen app" : "Browser tab";
  elements.environmentStorage.textContent = state.storage.quota
    ? `${formatBytes(state.storage.usage || 0)} of ${formatBytes(state.storage.quota)}`
    : state.storage.indexedDb
      ? "IndexedDB available"
      : "Unavailable";
}

function renderStatusChips(statuses) {
  document.querySelectorAll("[data-status-for]").forEach((chip) => {
    const result = statuses[chip.dataset.statusFor];
    chip.dataset.tone = result.tone;
    chip.textContent = result.label;
  });
}

function renderDetailedResults() {
  renderResultList(elements.installResults, [
    resultItem("Secure HTTPS context", state.install.secure, state.install.secure ? "Available" : "Required"),
    resultItem(
      "Service worker",
      state.install.serviceWorker === true,
      state.install.serviceWorker === null ? "Checking" : state.install.serviceWorker ? "Registered" : "Unavailable",
      state.install.serviceWorker === false ? "fail" : null,
    ),
    resultItem("Standalone Home Screen display", state.install.standalone, state.install.standalone ? "Confirmed" : "Open from Home Screen to confirm"),
  ]);

  renderResultList(elements.photoInputResults, [
    resultItem("Camera input", state.photoInputs.camera, state.photoInputs.camera ? "Selected successfully" : "Not tested"),
    resultItem("Photo-library input", state.photoInputs.library, state.photoInputs.library ? "Selected successfully" : "Not tested"),
  ]);

  renderResultList(elements.storageResults, [
    resultItem("IndexedDB support", state.storage.indexedDb, state.storage.indexedDb ? "Available" : "Unavailable"),
    resultItem("Metadata write and read", state.storage.writeRead, state.storage.writeRead ? "Matched" : "Not proven"),
    resultItem(
      "Direct photo Blob round trip",
      state.storage.blobRoundTrip,
      state.storage.blobRoundTrip ? "Matched" : state.storage.directBlobError || "Not proven",
      state.storage.directBlobError ? "attention" : null,
    ),
    resultItem(
      "ArrayBuffer photo adapter",
      state.storage.arrayBufferRoundTrip,
      state.storage.arrayBufferRoundTrip ? "Matched; reconstruct a Blob when displaying" : "Not needed or not proven",
      state.storage.storageMode === "array-buffer" ? "attention" : null,
    ),
    resultItem(
      "Survived page reload",
      state.storage.survivedReload,
      state.storage.survivedReload ? "Confirmed" : state.storage.error ? "Not confirmed; latest test failed" : "Reload after a successful write",
      state.storage.error ? "fail" : null,
    ),
    resultItem(
      "Persistent-storage request",
      state.storage.persistent === true,
      state.storage.persistent === null ? "Not requested" : state.storage.persistent ? "Granted" : "Not granted; backup remains essential",
      state.storage.persistent === false ? "attention" : null,
    ),
  ]);

  renderResultList(elements.voiceResults, [
    resultItem("Microphone API", state.voice.mediaDevices, state.voice.mediaDevices ? "Available" : "Unavailable", state.voice.mediaDevices ? null : "fail"),
    resultItem(
      "Microphone permission",
      state.voice.microphone === "pass",
      microphoneLabel(),
      state.voice.microphone === "fail" || state.voice.microphone === "unsupported" ? "fail" : null,
    ),
    resultItem(
      "Browser speech recognition",
      state.voice.recognition === "pass",
      recognitionLabel(),
      !state.voice.recognitionSupported || state.voice.recognition === "attention" ? "attention" : state.voice.recognition === "fail" ? "fail" : null,
    ),
    resultItem(
      "Local-only recognition control",
      state.voice.localOnlyControl,
      state.voice.localOnlyControl ? "Available and required for this test" : "Unavailable; Safari may use Apple processing",
      state.voice.localOnlyControl ? null : "attention",
    ),
    resultItem(
      "Custom AWS transcription",
      state.voice.awsState === "pass",
      state.voice.awsConfigured ? awsStateLabel() : "Not deployed; Dictation and typing remain available",
      state.voice.awsState === "fail" ? "fail" : state.voice.awsConfigured ? null : "attention",
    ),
    resultItem(
      "AWS service-improvement opt-out",
      state.voice.awsConfigured && !voiceConfig.fake,
      voiceConfig.fake ? "Local simulation only" : state.voice.awsConfigured ? "Required deployment gate recorded" : "Required before real audio is enabled",
      state.voice.awsConfigured && !voiceConfig.fake ? null : "attention",
    ),
  ]);

  renderResultList(elements.filesResults, [
    resultItem(
      "Share files capability",
      state.files.fileShareSupported,
      state.files.fileShareSupported ? "Available" : "Standard download only",
      state.files.fileShareSupported ? null : "attention",
    ),
    resultItem(
      "Save to Apple Files",
      state.files.confirmation === true,
      state.files.confirmation === null ? "Not confirmed" : state.files.confirmation ? "Confirmed" : "Not available",
      state.files.confirmation === false ? "fail" : null,
    ),
  ]);
}

function renderResultList(container, items) {
  container.replaceChildren();
  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "result-row";
    row.dataset.tone = item.tone;

    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("aria-hidden", "true");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", item.tone === "pass" ? "#icon-check" : "#icon-alert");
    icon.append(use);

    const copy = document.createElement("span");
    const label = document.createElement("strong");
    label.textContent = `${item.label}: `;
    copy.append(label, document.createTextNode(item.detail));
    row.append(icon, copy);
    container.append(row);
  });
}

function resultItem(label, passed, detail, forcedTone = null) {
  const neutralDetails = ["Not tested", "Not proven", "Not requested", "Checking", "Reload after a successful write", "Not confirmed"];
  const tone = forcedTone || (passed ? "pass" : neutralDetails.includes(detail) ? "idle" : "attention");
  return { label, detail, tone };
}

function renderSummary(statuses) {
  elements.summaryResults.replaceChildren();
  TEST_DEFINITIONS.forEach((test) => {
    const result = statuses[test.id];
    const row = document.createElement("div");
    row.className = "summary-row";
    const label = document.createElement("span");
    label.textContent = test.label;
    const chip = document.createElement("span");
    chip.className = "status-chip";
    chip.dataset.tone = result.tone;
    chip.textContent = result.label;
    row.append(label, chip);
    elements.summaryResults.append(row);
  });
  elements.reportPreview.textContent = JSON.stringify(buildReport(), null, 2);
}

function renderProgress(statuses) {
  const passed = Object.values(statuses).filter((result) => result.tone === "pass").length;
  elements.progressCount.textContent = `${passed} of ${TEST_DEFINITIONS.length} passed`;
  elements.progressTrack.setAttribute("aria-valuenow", String(passed));
  elements.progressFill.className = `progress-${passed}`;
}

function renderManualChoices() {
  elements.orientationYes.setAttribute("aria-pressed", String(state.photoProcessing.orientation === true));
  elements.orientationNo.setAttribute("aria-pressed", String(state.photoProcessing.orientation === false));
  elements.filesYes.setAttribute("aria-pressed", String(state.files.confirmation === true));
  elements.filesNo.setAttribute("aria-pressed", String(state.files.confirmation === false));
  if (state.files.shareOpened) elements.filesConfirmation.hidden = false;
}

function microphoneLabel() {
  const labels = {
    idle: "Not tested",
    checking: "Checking",
    pass: "Granted and released",
    fail: "Denied or failed",
    unsupported: "Unavailable",
  };
  return labels[state.voice.microphone] || state.voice.microphone;
}

function recognitionLabel() {
  if (!state.voice.recognitionSupported) return "Unavailable; evaluate AWS fallback";
  const labels = {
    idle: "Available, not tested",
    starting: "Starting",
    listening: "Listening",
    pass: `Usable transcript returned (${state.voice.transcriptCharacters} characters)`,
    attention: "No usable final transcript",
    fail: "Failed or denied",
    unsupported: "Unavailable; evaluate AWS fallback",
  };
  return labels[state.voice.recognition] || state.voice.recognition;
}

function buildReport() {
  const statuses = getTestStatuses();
  return {
    format: "what-i-made-feasibility-v3",
    generatedAt: new Date().toISOString(),
    environment: {
      secureContext: state.install.secure,
      standalone: state.install.standalone,
      online: navigator.onLine,
      language: navigator.language,
      platform: navigator.platform || "Unknown",
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      devicePixelRatio: window.devicePixelRatio,
      storageUsageBytes: state.storage.usage,
      storageQuotaBytes: state.storage.quota,
    },
    results: Object.fromEntries(
      TEST_DEFINITIONS.map((test) => [
        test.id,
        {
          label: test.label,
          result: statuses[test.id].tone,
          summary: statuses[test.id].summary,
        },
      ]),
    ),
    evidence: {
      photo: state.photoProcessing.details
        ? {
            sourceType: state.photoProcessing.details.sourceType,
            originalDimensions: `${state.photoProcessing.details.originalWidth}x${state.photoProcessing.details.originalHeight}`,
            optimizedDimensions: `${state.photoProcessing.details.optimizedWidth}x${state.photoProcessing.details.optimizedHeight}`,
            originalBytes: state.photoProcessing.details.originalBytes,
            optimizedBytes: state.photoProcessing.details.optimizedBytes,
            uprightConfirmed: state.photoProcessing.orientation,
          }
        : null,
      voice: {
        microphone: state.voice.microphone,
        recognitionSupported: state.voice.recognitionSupported,
        recognition: state.voice.recognition,
        transcriptCharacters: state.voice.transcriptCharacters,
        localOnlyControl: state.voice.localOnlyControl,
        processingMode: state.voice.processingMode,
        awsConfigured: state.voice.awsConfigured,
        awsState: state.voice.awsState,
        awsProcessingMode: state.voice.awsProcessingMode,
        awsTranscriptReceived: state.voice.awsTranscriptReceived,
        awsRegion: voiceConfig.region || "us-east-2",
        processingBoundary: "Keyboard Dictation may use Apple. The custom button streams audio directly to Amazon Transcribe; What I Made and Lambda do not durably retain it. AWS service-improvement use must be opted out before enablement, though AWS may retain data needed to provide and maintain the service.",
      },
      storage: {
        writeRead: state.storage.writeRead,
        blobRoundTrip: state.storage.blobRoundTrip,
        arrayBufferRoundTrip: state.storage.arrayBufferRoundTrip,
        storageMode: state.storage.storageMode,
        survivedReload: state.storage.survivedReload,
        persistenceGranted: state.storage.persistent,
        directBlobError: state.storage.directBlobError || null,
        failedStage: state.storage.errorStage || null,
        error: state.storage.error || null,
      },
      files: {
        fileShareSupported: state.files.fileShareSupported,
        saveToFilesConfirmed: state.files.confirmation,
      },
    },
    excluded: ["photograph bytes", "photograph names", "transcript text"],
  };
}

function formatReportAsText(report) {
  const lines = [
    "What I Made — iPhone feasibility report",
    `Generated: ${report.generatedAt}`,
    `Environment: ${report.environment.standalone ? "Home Screen app" : "browser tab"}; ${report.environment.secureContext ? "secure" : "not secure"}`,
    "",
  ];
  for (const result of Object.values(report.results)) {
    lines.push(`${result.label}: ${result.result.toUpperCase()} — ${result.summary}`);
  }
  lines.push(
    "",
    `Storage evidence: metadata=${report.evidence.storage.writeRead}; blob=${report.evidence.storage.blobRoundTrip}; arrayBuffer=${report.evidence.storage.arrayBufferRoundTrip}; mode=${report.evidence.storage.storageMode || "none"}`,
  );
  if (report.evidence.storage.directBlobError) lines.push(`Direct Blob error: ${report.evidence.storage.directBlobError}`);
  if (report.evidence.storage.error) lines.push(`Storage failure: ${report.evidence.storage.error}`);
  lines.push("", `Speech privacy: ${report.evidence.voice.processingBoundary}`);
  lines.push("No photographs or transcript text are included.");
  return lines.join("\n");
}

function diagnosticFileName() {
  return `what-i-made-feasibility-${new Date().toISOString().slice(0, 10)}.json`;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "Unknown";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatReduction(percent) {
  if (!Number.isFinite(percent)) return "Unknown";
  if (percent >= 0) return `${percent}% smaller`;
  return `${Math.abs(percent)}% larger for JPEG portability`;
}

function friendlyMediaError(error) {
  if (error?.name === "NotAllowedError") return "Microphone access was denied. Allow it in Safari settings and retry.";
  if (error?.name === "NotFoundError") return "No microphone was found on this device.";
  if (error?.name === "NotReadableError") return "The microphone is busy in another app. Close it there and retry.";
  if (!window.isSecureContext) return "Microphone access requires HTTPS.";
  return `Microphone check failed: ${friendlyError(error)}`;
}

function friendlyRecognitionError(code) {
  const messages = {
    "not-allowed": "Speech recognition permission was denied. Allow microphone and speech access, then retry.",
    "service-not-allowed": "Safari did not allow its speech-recognition service in this context.",
    "no-speech": "No speech was detected. Try again closer to the phone.",
    network: "Speech recognition reported a network problem. Confirm the connection and retry.",
    "audio-capture": "Speech recognition could not access the microphone.",
    "language-not-supported": "Local-only recognition is unavailable for this language. Use typing or evaluate the disclosed AWS fallback.",
    aborted: "Transcription was stopped.",
  };
  return messages[code] || `Speech recognition reported: ${code || "unknown error"}.`;
}

function friendlyError(error) {
  if (!error) return "Unknown error";
  return error.message || error.name || String(error);
}

function describeStorageError(error) {
  if (!error) return "Unknown IndexedDB error";
  const name = error.name && error.name !== "Error" ? error.name : "";
  const message = error.message || String(error);
  return name && message && message !== name ? `${name}: ${message}` : message || name || "Unknown IndexedDB error";
}
