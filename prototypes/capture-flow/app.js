(function () {
  "use strict";

  const sample = {
    photo: "./assets/sample-oyakodon.jpg",
    transcript:
      "I made Oyakodon, eight out of ten. The egg texture was much better this time, but use a little less soy next time. Chicken, egg, onion, rice, soy sauce, mirin and dashi.",
    dishName: "Oyakodon",
    rating: "8",
    notes: "The egg texture was much better this time, but use a little less soy next time.",
    ingredients: "Chicken, egg, onion, rice, soy sauce, mirin and dashi",
    country: "Japan",
  };

  const voiceConfig = window.WIM_VOICE_CONFIG || { enabled: false, sessionEndpoint: "", maxCaptureSeconds: 45, fake: false };
  const assistanceConfig = window.WIM_CAPTURE_ASSISTANCE_CONFIG || { enabled: false, endpoint: "", fake: false, timeoutMs: 10000 };
  const parser = window.WhatIMadeCaptureParser;
  const captureAssistance = window.WhatIMadeCaptureAssistance;
  const dishMatcher = window.WhatIMadeDishMatcher;
  const captureDraft = window.WhatIMadeCaptureDraft;
  const photoUrls = window.WhatIMadePhotoUrls;
  const archive = window.WhatIMadeArchive;
  const backup = window.WhatIMadeBackup;
  const ideas = window.WhatIMadeIdeas;
  const recipeClient = window.WhatIMadeRecipeClient;
  const dashboard = window.WhatIMadeDashboard;
  const photoProcessor = window.WhatIMadePhotoProcessor;
  const worldMap = window.WhatIMadeWorldMap;
  const mapGeometry = window.WhatIMadeMapGeometry;
  const culinaryRegions = window.WhatIMadeCulinaryRegions;
  const journalModel = window.WhatIMadeJournal;
  const recapRenderGate = journalModel.createLatestRequestGate();
  const TOKEN_DB_NAME = "what-i-made-feasibility-owner";
  const TOKEN_DB_VERSION = 1;
  const TOKEN_STORE_NAME = "diagnostics";
  const TOKEN_RECORD_ID = "voice-owner-token";

  const state = {
    photoReady: false,
    photoSrc: "",
    photoBlob: null,
    objectUrl: "",
    archiveObjectUrls: [],
    mapMarkerObjectUrls: [],
    currentCookId: "",
    dashboardModel: null,
    mapNavigation: { level: "world", regionId: "", countryKey: "" },
    mapMode: readMapMode(),
    mapRegionShelfScroll: 0,
    mapDetailDishIds: [],
    mapReturnFocusElement: null,
    mapSheetReturnState: null,
    dishReturnCountryKey: "",
    dishReturnFocusElement: null,
    dishHistoryRequestId: 0,
    currentDishHistoryId: "",
    dishReturnMapState: null,
    mapCustomize: null,
    mapCustomizeReturnFocus: null,
    mapCustomizeObjectUrls: [],
    mapCustomizeRequestId: 0,
    editOriginal: null,
    editPhotoBlob: null,
    editObjectUrl: "",
    editPhotoRequestId: 0,
    editPhotoProcessing: false,
    editSaving: false,
    startedAt: null,
    recordingStartedAt: null,
    activeAdapter: null,
    activeTranscript: null,
    assistanceController: null,
    assistanceBusy: false,
    assistanceRequestId: 0,
    lastAssistedTranscript: "",
    lastAssistanceAttemptedTranscript: "",
    lastAssistanceInput: null,
    assistedDishes: [],
    assistanceWarnings: [],
    assistanceFailed: false,
    primaryMatchedDishId: "",
    primaryForceNewDish: true,
    matchingCooks: [],
    countrySuggestion: null,
    countryProvenance: "",
    confirmationBaseline: null,
    ownerToken: "",
    suggestedCountry: "",
    touchedFields: new Set(),
    recordingTimer: null,
    scenario: "blank",
    simulateFailure: false,
    ideaFilter: "all",
    ideaQuery: "",
    ideasScrollTop: 0,
    currentIdeaId: "",
    ideaDraft: null,
    ideaDraftImage: null,
    ideaObjectUrls: [],
    ideaSearchDescription: "",
    ideaReviewMode: "new",
    pendingIdeaId: "",
    yearScrollTop: 0,
    backupReturnFocusElement: null,
    backupArchiveSummary: null,
    backupInspection: null,
    eraseCompleted: false,
    journalQuery: "",
    journalFilters: { country: "all", year: "", month: "", rating: "any" },
    journalCooks: [],
    journalOptions: { countries: [], years: [], hasMissingCountry: false },
    journalScrollTop: 0,
    journalFilterReturnFocus: null,
    journalRenderRequestId: 0,
    recapYear: new Date().getFullYear(),
    recapScrollTop: 0,
    recapOrigin: "year",
    entryReturnScreen: "journal",
    entryReturnCookId: "",
    entryReturnPhotoId: "",
    currentOccasionId: "",
    currentAttemptId: "",
    confirmationDishes: [],
    selectedEntryPhotoId: "",
    photoActionReturnFocus: null,
    entryPhotoProcessing: false,
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const screens = $$("[data-screen]");
  const captureForm = $("#capture-form");
  const confirmForm = $("#confirm-form");
  const photoPicker = $("#photo-picker");
  const photoPreview = $("#photo-preview");
  const photoEmpty = $("#photo-empty");
  const cameraInput = $("#camera-input");
  const libraryInput = $("#library-input");
  const dishName = $("#dish-name");
  const transcript = $("#transcript");
  const rating = $("#rating");
  const notes = $("#notes");
  const ingredients = $("#ingredients");
  const reviewButton = $("#review-button");
  const optionalToggle = $("#optional-toggle");
  const optionalFields = $("#optional-fields");
  const micButton = $("#mic-button");
  const recordingStatus = $("#recording-status");
  const liveTranscriptShell = $("#live-transcript-shell");
  const liveTranscript = $("#live-transcript");
  const voiceSetup = $("#voice-setup");
  const ownerTokenInput = $("#owner-token");
  const tokenMessage = $("#token-message");
  const captureError = $("#capture-error");
  const assistProgress = $("#assist-progress");
  const assistRecovery = $("#assist-recovery");
  const dishError = $("#dish-error");
  const journalList = $("#journal-list");
  const journalEmpty = $("#journal-empty");
  const journalNoResults = $("#journal-no-results");
  const journalError = $("#journal-error");
  const journalScroll = $("#journal-scroll");
  const journalSearch = $("#journal-search");
  const journalFilterDialog = $("#journal-filter-dialog");
  const journalCountryFilter = $("#journal-country-filter");
  const journalYearFilter = $("#journal-year-filter");
  const journalMonthFilter = $("#journal-month-filter");
  const journalRatingFilter = $("#journal-rating-filter");
  const recapScroll = $("#recap-scroll");
  const recapGroups = $("#recap-groups");
  const saveError = $("#save-error");
  const newDishesList = $("#new-dishes-list");
  const repeatDishesList = $("#repeat-dishes-list");
  const yearMapCells = $("#year-map-cells");
  const fullMapCells = $("#full-map-cells");
  const atlasMapLayer = $("#atlas-map-layer");
  const countryShelf = $("#country-shelf");
  const countryDishGrid = $("#country-dish-grid");
  const countrySheetLayer = $("#country-sheet-layer");
  const countrySheet = $("#country-sheet");
  const needsLocationList = $("#needs-location-list");
  const editForm = $("#edit-form");
  const editDish = $("#edit-dish");
  const editDate = $("#edit-date");
  const editCountry = $("#edit-country");
  const editRating = $("#edit-rating");
  const editNotes = $("#edit-notes");
  const editIngredients = $("#edit-ingredients");
  const editError = $("#edit-error");
  const editPhotoError = $("#edit-photo-error");
  const entryStatus = $("#entry-status");
  const entryPhotoGrid = $("#entry-photo-grid");
  const entryDishList = $("#entry-dish-list");
  const photoActionsDialog = $("#photo-actions-dialog");
  const yearScroll = $(".year-content");
  const backupError = $("#backup-error");
  const backupStatus = $("#backup-status");
  const backupFileInput = $("#backup-file-input");
  const restorePreview = $("#restore-preview");
  const confirmRestoreButton = $("#confirm-restore");
  const eraseDialog = $("#erase-dialog");
  const eraseConfirmation = $("#erase-confirmation");
  const mapCustomizeDialog = $("#map-customize-dialog");
  const mapLocationStage = $("#map-location-stage");
  const mapEditorMarker = $("#map-editor-marker");
  let journalSearchTimer = null;

  function readMapMode() {
    try { return localStorage.getItem("what-i-made-map-mode") === "needle" ? "needle" : "photo"; }
    catch { return "photo"; }
  }

  function setMapMode(mode, options = {}) {
    state.mapMode = mode === "needle" ? "needle" : "photo";
    try { localStorage.setItem("what-i-made-map-mode", state.mapMode); } catch {}
    $("#map-mode-photo").setAttribute("aria-pressed", String(state.mapMode === "photo"));
    $("#map-mode-needle").setAttribute("aria-pressed", String(state.mapMode === "needle"));
    if (options.render !== false) {
      if (state.mapNavigation.level === "region") {
        const region = state.dashboardModel?.regions.find((candidate) => candidate.id === state.mapNavigation.regionId);
        if (region) renderRegionDishes(region);
      } else if (state.mapNavigation.level === "country-detail") {
        const country = countryForKey(state.mapNavigation.countryKey);
        if (country) renderCountryDetailMarkers(country);
      }
    }
  }

  function beginTiming() {
    if (state.startedAt === null) {
      state.startedAt = performance.now();
    }
  }

  function currentDateValue() {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function showScreen(name) {
    const currentScreen = screens.find((screen) => !screen.hidden)?.dataset.screen;
    if (name !== "dish") state.mapCustomizeRequestId += 1;
    if (state.assistanceController && currentScreen && currentScreen !== name) {
      state.assistanceController.abort();
      state.assistanceRequestId += 1;
      state.assistanceController = null;
      setAssistanceBusy(false);
    }
    if (name !== "journal") {
      window.clearTimeout(journalSearchTimer);
      state.journalRenderRequestId += 1;
    }
    if (name !== "recap") recapRenderGate.invalidate();
    screens.forEach((screen) => {
      const isTarget = screen.dataset.screen === name;
      screen.hidden = !isTarget;
      screen.classList.toggle("is-active", isTarget);
    });

    const target = $(`[data-screen="${name}"]`);
    $$('[data-nav]').forEach((button) => {
      if (button.dataset.nav === name) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    const heading = $("h2", target);
    window.requestAnimationFrame(() => heading?.focus({ preventScroll: true }));
  }

  function updateReadyState() {
    const hasName = dishName.value.trim().length > 0;
    const hasDescribableNote = transcript.value.trim().length > 0;
    reviewButton.disabled = state.assistanceBusy || !(state.photoReady && (hasName || hasDescribableNote));
    if (hasName) {
      dishName.removeAttribute("aria-invalid");
      dishError.hidden = true;
    }
  }

  function setPhoto(source, alt = "Selected meal", ownsObjectUrl = false, blob = null) {
    state.objectUrl = photoUrls.replaceOwnedObjectUrl(
      state.objectUrl,
      ownsObjectUrl ? source : "",
      (url) => URL.revokeObjectURL(url),
    );

    state.photoReady = true;
    state.photoSrc = source;
    state.photoBlob = blob;
    photoPreview.src = source;
    photoPreview.alt = alt;
    photoPreview.hidden = false;
    photoEmpty.hidden = true;
    photoPicker.dataset.ready = "true";
    beginTiming();
    updateReadyState();
  }

  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      captureError.textContent = "Choose an image from the camera or photo library.";
      captureError.hidden = false;
      return;
    }

    captureError.textContent = "Preparing your photo on this device…";
    captureError.hidden = false;
    try {
      const processed = photoProcessor?.processPhoto ? await photoProcessor.processPhoto(file) : { blob: file };
      const objectUrl = URL.createObjectURL(processed.blob);
      setPhoto(objectUrl, "Photo selected for this cooking occasion", true, processed.blob);
      captureError.hidden = true;
    } catch (error) {
      captureError.textContent = error.message || "This photo could not be prepared. Try another image.";
    } finally {
      event.target.value = "";
    }
  }

  async function resolvePhotoBlob() {
    if (state.photoBlob instanceof Blob && state.photoBlob.size > 0) return state.photoBlob;
    const response = await fetch(state.photoSrc);
    if (!response.ok) throw new Error("The selected photo could not be prepared for saving.");
    return response.blob();
  }

  function revealOptionalFields() {
    optionalFields.hidden = false;
    optionalToggle.setAttribute("aria-expanded", "true");
  }

  function toggleOptionalFields() {
    const willOpen = optionalFields.hidden;
    optionalFields.hidden = !willOpen;
    optionalToggle.setAttribute("aria-expanded", String(willOpen));
    if (willOpen) $("input, textarea", optionalFields)?.focus();
  }

  function applyParsedSample() {
    transcript.value = sample.transcript;
    dishName.value = sample.dishName;
    rating.value = sample.rating;
    notes.value = sample.notes;
    ingredients.value = sample.ingredients;
    state.suggestedCountry = sample.country;
    state.countryProvenance = "suggested";
    revealOptionalFields();
    beginTiming();
    updateReadyState();
  }

  function applyTranscriptSuggestions(value) {
    if (!parser?.parseCaptureTranscript) return;
    const parsed = parser.parseCaptureTranscript(value);
    const fields = { dishName, rating, notes, ingredients };
    Object.entries(fields).forEach(([name, element]) => {
      const suggestion = parsed[name];
      if (suggestion && !state.touchedFields.has(name)) element.value = suggestion;
    });
    state.suggestedCountry = parsed.country || "";
    state.countryProvenance = parsed.country ? "suggested" : "";
    if (parsed.rating || parsed.notes || parsed.ingredients) revealOptionalFields();
    updateReadyState();
  }

  function appendText(existing, addition) {
    const left = String(existing || "").trimEnd();
    const right = String(addition || "").trim();
    return left && right ? `${left}\n${right}` : left || right;
  }

  function setAssistanceBusy(busy, message = "Organizing your note…") {
    state.assistanceBusy = busy;
    assistProgress.hidden = !busy;
    $("#assist-progress-text").textContent = message;
    transcript.setAttribute("aria-busy", String(busy));
    if (!busy) transcript.removeAttribute("aria-busy");
    updateReadyState();
  }

  function countryFromSuggestion(dish) {
    const country = dish?.countryCode ? worldMap?.countries?.find((candidate) => candidate.key === dish.countryCode) : null;
    if (!country) return { auto: "", optional: null };
    const confidence = dish.confidence?.country || 0;
    const shouldFill = dish.countrySource === "explicit" || confidence >= 0.9;
    return shouldFill
      ? { auto: country.name, optional: null, provenance: dish.countrySource === "explicit" ? "from-note" : "suggested" }
      : { auto: "", optional: { name: country.name, source: dish.countrySource }, provenance: "suggested" };
  }

  function applyAssistedDishes(dishes, warnings = []) {
    const proposed = (dishes || []).filter((dish) => dish?.dishName).slice(0, 6);
    state.assistedDishes = proposed.filter((dish) => captureAssistance?.acceptedDishFields?.(dish)?.dishName);
    state.assistanceWarnings = [...warnings, ...(state.assistedDishes.length < proposed.length ? ["A possible dish name was too uncertain to assign."] : [])].slice(0, 6);
    const primary = state.assistedDishes[0];
    if (!primary) return;
    const accepted = captureAssistance?.acceptedDishFields?.(primary) || primary;
    const fields = [
      ["dishName", dishName, accepted.dishName],
      ["rating", rating, accepted.rating],
      ["notes", notes, accepted.notes],
      ["ingredients", ingredients, accepted.ingredientsText],
    ];
    fields.forEach(([key, element, value]) => {
      if (value !== null && value !== "" && !state.touchedFields.has(key)) {
        element.value = String(value);
      }
    });
    const country = countryFromSuggestion(primary);
    state.suggestedCountry = "";
    state.countryProvenance = "";
    if (country.auto) {
      state.suggestedCountry = country.auto;
      state.countryProvenance = country.provenance;
    }
    state.countrySuggestion = country.optional;
    if (primary.rating || primary.notes || primary.ingredientsText) revealOptionalFields();
    updateReadyState();
  }

  async function organizeCaptureText({ existingText = transcript.value, voiceSegment = "", appendVoice = false, retry = false } = {}) {
    const rawSegment = String(voiceSegment || "").trim();
    const combined = appendVoice ? appendText(existingText, rawSegment) : String(existingText || "");
    if (!combined.trim()) return false;
    const requestId = ++state.assistanceRequestId;
    state.lastAssistanceAttemptedTranscript = combined;
    state.assistanceController?.abort();
    const controller = new AbortController();
    state.assistanceController = controller;
    state.lastAssistanceInput = { existingText, voiceSegment: rawSegment, appendVoice };
    assistRecovery.hidden = true;
    setAssistanceBusy(true, retry ? "Trying smart suggestions again…" : "Organizing your note…");
    recordingStatus.textContent = "Organizing your note…";
    try {
      let result;
      if (!assistanceConfig.enabled || !captureAssistance) throw new Error("Smart assistance is not configured.");
      if (assistanceConfig.fake) {
        result = await captureAssistance.fakeParseCook({ transcript: combined, voiceSegment: rawSegment, parseFallback: parser?.parseCaptureTranscript, countryLookup: worldMap?.findCountry });
      } else {
        result = await captureAssistance.parseCook({
          endpoint: assistanceConfig.endpoint, token: state.ownerToken, transcript: combined, voiceSegment: rawSegment,
          locale: "en-US", timeoutMs: assistanceConfig.timeoutMs, signal: controller.signal,
          countryCodes: (worldMap?.countries || []).map((country) => country.key),
        });
      }
      if (requestId !== state.assistanceRequestId || controller.signal.aborted) return false;
      transcript.value = appendVoice ? appendText(existingText, result.cleanedVoiceText || rawSegment) : combined;
      state.lastAssistedTranscript = transcript.value;
      state.assistanceFailed = false;
      applyAssistedDishes(result.dishes, result.warnings);
      recordingStatus.textContent = "Smart suggestions ready";
      if (state.assistanceWarnings.length) {
        assistRecovery.hidden = false;
        $("#assist-recovery-message").textContent = "Some details could not be assigned confidently. Check the editable fields before saving.";
        $("#retry-assistance").hidden = true;
      }
      return true;
    } catch (error) {
      if (requestId !== state.assistanceRequestId || controller.signal.aborted) return false;
      transcript.value = appendVoice ? appendText(existingText, rawSegment) : combined;
      applyTranscriptSuggestions(transcript.value);
      state.lastAssistedTranscript = "";
      state.assistanceFailed = true;
      assistRecovery.hidden = false;
      $("#retry-assistance").hidden = !assistanceConfig.enabled;
      $("#assist-recovery-message").textContent = `${error.message || "Smart suggestions are unavailable."} Basic suggestions were used and your note is still editable.`;
      recordingStatus.textContent = "Basic suggestions ready";
      return false;
    } finally {
      if (requestId === state.assistanceRequestId) {
        state.assistanceController = null;
        setAssistanceBusy(false);
      }
    }
  }

  function openTokenDatabase() {
    if (!("indexedDB" in window)) return Promise.reject(new Error("Private setup storage is unavailable."));
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(TOKEN_DB_NAME, TOKEN_DB_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(TOKEN_STORE_NAME)) {
          request.result.createObjectStore(TOKEN_STORE_NAME, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Private setup could not be opened."));
    });
  }

  async function tokenRecord(action, value) {
    const database = await openTokenDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(TOKEN_STORE_NAME, action === "get" ? "readonly" : "readwrite");
      const store = transaction.objectStore(TOKEN_STORE_NAME);
      const request = action === "get"
        ? store.get(TOKEN_RECORD_ID)
        : action === "put"
          ? store.put({ id: TOKEN_RECORD_ID, token: value, savedAt: new Date().toISOString() })
          : store.delete(TOKEN_RECORD_ID);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("Private setup could not be updated."));
      transaction.oncomplete = () => database.close();
    });
  }

  async function restoreOwnerToken() {
    if (voiceConfig.fake) {
      state.ownerToken = "local-fake-token-for-browser-tests";
      tokenMessage.textContent = "Local voice simulation is ready.";
      return;
    }
    try {
      const record = await tokenRecord("get");
      state.ownerToken = typeof record?.token === "string" ? record.token : "";
      tokenMessage.textContent = state.ownerToken ? "Owner token already saved on this device." : "No owner token is saved on this device.";
      if (!state.ownerToken) voiceSetup.open = true;
    } catch (error) {
      tokenMessage.textContent = error.message;
      voiceSetup.open = true;
    }
  }

  async function saveOwnerToken() {
    const value = ownerTokenInput.value.trim();
    if (!/^[A-Za-z0-9_-]{32,128}$/.test(value)) {
      tokenMessage.textContent = "Enter the private token from AWS setup (at least 32 characters).";
      ownerTokenInput.focus();
      return;
    }
    try {
      await tokenRecord("put", value);
      state.ownerToken = value;
      ownerTokenInput.value = "";
      tokenMessage.textContent = "Owner token saved on this device.";
      voiceSetup.open = false;
    } catch (error) {
      tokenMessage.textContent = error.message;
    }
  }

  async function removeOwnerToken() {
    try {
      await cancelRecording("Voice stopped");
      await tokenRecord("delete");
      state.ownerToken = "";
      ownerTokenInput.value = "";
      tokenMessage.textContent = "Owner token removed from this device.";
      voiceSetup.open = true;
    } catch (error) {
      tokenMessage.textContent = error.message;
    }
  }

  function stopRecordingClock() {
    window.clearInterval(state.recordingTimer);
    state.recordingTimer = null;
    state.recordingStartedAt = null;
  }

  function renderVoiceButton(runtimeState = state.activeAdapter?.state || "idle") {
    const listening = runtimeState === "listening";
    const connecting = ["authorizing", "connecting"].includes(runtimeState);
    const finishing = runtimeState === "finishing";
    micButton.disabled = finishing || !voiceConfig.enabled;
    micButton.setAttribute("aria-pressed", String(listening || connecting));
    micButton.innerHTML = listening
      ? '<svg aria-hidden="true"><use href="#icon-stop"></use></svg><span>Done</span>'
      : connecting
        ? '<svg aria-hidden="true"><use href="#icon-stop"></use></svg><span>Cancel</span>'
        : finishing
          ? '<svg aria-hidden="true"><use href="#icon-mic"></use></svg><span>Finishing…</span>'
          : '<svg aria-hidden="true"><use href="#icon-mic"></use></svg><span>Speak your cook</span>';
  }

  function commitVoiceText(adapter) {
    const current = state.activeTranscript;
    if (!current || current.adapter !== adapter || current.committed || !current.text.trim()) return;
    current.committed = true;
    void organizeCaptureText({ existingText: transcript.value, voiceSegment: current.text, appendVoice: true });
  }

  function handleVoiceText(adapter, text) {
    if (state.activeAdapter !== adapter || state.activeTranscript?.adapter !== adapter) return;
    state.activeTranscript.text = text;
    liveTranscript.textContent = text;
    liveTranscriptShell.hidden = !text;
  }

  function handleVoiceState(adapter, runtimeState, detail) {
    if (state.activeAdapter !== adapter) return;
    stopRecordingClock();

    if (runtimeState === "listening") {
      state.recordingStartedAt = performance.now();
      state.recordingTimer = window.setInterval(() => {
        const elapsed = Math.floor((performance.now() - state.recordingStartedAt) / 1000);
        const seconds = String(elapsed % 60).padStart(2, "0");
        recordingStatus.textContent = `Listening ${Math.floor(elapsed / 60)}:${seconds}`;
      }, 500);
    } else if (runtimeState === "complete" || runtimeState === "failed") {
      commitVoiceText(adapter);
      state.activeAdapter = null;
      state.activeTranscript = null;
      liveTranscript.textContent = "";
      liveTranscriptShell.hidden = true;
      if (runtimeState === "failed") {
        captureError.textContent = `${detail || "Voice transcription stopped."} Your visible text is still editable.`;
        captureError.hidden = false;
      }
    }

    recordingStatus.textContent = detail || (runtimeState === "complete" ? "Transcript ready" : "Ready");
    renderVoiceButton(["complete", "failed"].includes(runtimeState) ? "idle" : runtimeState);
  }

  async function cancelRecording(message = "Cancelled") {
    state.assistanceController?.abort();
    state.assistanceRequestId += 1;
    const adapter = state.activeAdapter;
    if (adapter) await adapter.cancel(message);
    stopRecordingClock();
    renderVoiceButton("idle");
  }

  async function startRecording() {
    beginTiming();
    state.assistanceController?.abort();
    state.assistanceRequestId += 1;
    captureError.hidden = true;
    if (!voiceConfig.enabled) {
      captureError.textContent = "One-tap voice is not configured. Type here or use keyboard Dictation.";
      captureError.hidden = false;
      transcript.focus();
      return;
    }
    if (!state.ownerToken) {
      voiceSetup.open = true;
      tokenMessage.textContent = "Save the private owner token before using one-tap voice.";
      ownerTokenInput.focus();
      return;
    }
    const Adapter = voiceConfig.fake
      ? window.WhatIMadeTranscribe?.FakeTranscribeAdapter
      : window.WhatIMadeTranscribe?.AwsTranscribeAdapter;
    if (!Adapter) {
      captureError.textContent = "The voice component did not load. Type here or use keyboard Dictation.";
      captureError.hidden = false;
      return;
    }
    const adapter = new Adapter({
      endpoint: voiceConfig.sessionEndpoint,
      maxCaptureSeconds: voiceConfig.maxCaptureSeconds || 45,
      failure: voiceConfig.fakeFailure,
      onState: (runtimeState, detail) => handleVoiceState(adapter, runtimeState, detail),
      onText: (text) => handleVoiceText(adapter, text),
    });
    state.activeAdapter = adapter;
    state.activeTranscript = { adapter, text: "", committed: false };
    try {
      await adapter.start(state.ownerToken);
    } catch (error) {
      if (state.activeAdapter === adapter) handleVoiceState(adapter, "failed", error.message);
    }
  }

  async function toggleRecording() {
    const runtimeState = state.activeAdapter?.state;
    if (runtimeState === "listening") await state.activeAdapter.stop();
    else if (["authorizing", "connecting"].includes(runtimeState)) await cancelRecording("Voice setup cancelled");
    else if (!runtimeState) await startRecording();
  }

  function renderCountrySuggestion() {
    const button = $("#country-suggestion-action");
    if (!state.countrySuggestion?.name || $("#confirm-country").value.trim()) { button.hidden = true; return; }
    button.textContent = `Use ${state.countrySuggestion.name}`;
    button.setAttribute("aria-label", `Use suggested country ${state.countrySuggestion.name}`);
    button.hidden = false;
  }

  function matchDescription(candidate) {
    return `${candidate.cookCount} earlier ${candidate.cookCount === 1 ? "cook" : "cooks"}${candidate.country ? ` · ${candidate.country}` : ""}`;
  }

  function renderDishMatches(container, { dishName: proposedName, country, groupName, onSelect }) {
    container.replaceChildren();
    const result = dishMatcher?.findMatches?.({ dishName: proposedName, country, cooks: state.matchingCooks, resolveCountry: worldMap?.findCountry, limit: 3 });
    if (!result?.candidates?.length) { container.hidden = true; onSelect("", true); return; }
    container.hidden = false;
    const legend = document.createElement("legend");
    legend.textContent = `Does ${proposedName || "this dish"} match your history?`;
    container.append(legend);
    result.candidates.forEach((candidate) => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      const copy = document.createElement("span");
      const title = document.createElement("strong");
      const detail = document.createElement("span");
      label.className = "radio-card";
      input.type = "radio"; input.name = groupName; input.value = candidate.dishId;
      input.checked = result.exact?.dishId === candidate.dishId;
      title.textContent = candidate.exact ? `Same as ${candidate.canonicalName}` : candidate.canonicalName;
      detail.textContent = `${matchDescription(candidate)}${candidate.exact ? " · Exact name or alias" : " · Possible match"}`;
      copy.className = "radio-copy"; copy.append(title, detail); label.append(input, copy); container.append(label);
      input.addEventListener("change", () => { if (input.checked) onSelect(candidate.dishId, false); });
    });
    const newLabel = document.createElement("label");
    const newInput = document.createElement("input");
    const newCopy = document.createElement("span");
    const newTitle = document.createElement("strong");
    const newDetail = document.createElement("span");
    newLabel.className = "radio-card"; newInput.type = "radio"; newInput.name = groupName; newInput.value = "new";
    newInput.checked = !result.exact;
    newTitle.textContent = "Make a new dish"; newDetail.textContent = "Keep this history separate";
    newCopy.className = "radio-copy"; newCopy.append(newTitle, newDetail); newLabel.append(newInput, newCopy); container.append(newLabel);
    newInput.addEventListener("change", () => { if (newInput.checked) onSelect("", true); });
    onSelect(result.exact?.dishId || "", !result.exact);
  }

  async function updateConfirmation() {
    const name = dishName.value.trim();
    const failed = state.simulateFailure;

    $("#confirm-photo").src = state.photoSrc;
    $("#confirm-photo").alt = `${name || "Meal"} being reviewed`;
    $("#confirm-photo-caption").textContent = `${name || "Today’s cook"} · Today`;
    $("#confirm-dish").value = name;
    $("#confirm-date").value = currentDateValue();
    $("#confirm-rating").value = rating.value;
    $("#confirm-notes").value = notes.value || (failed ? transcript.value : "");
    $("#confirm-ingredients").value = ingredients.value;
    const inferredCountry = state.assistedDishes.length ? "" : parser?.inferCountry?.(name) || "";
    $("#confirm-country").value = failed ? "" : state.suggestedCountry || inferredCountry;

    $("#assist-warning").hidden = !failed && !state.assistanceFailed && !state.assistanceWarnings.length;
    $("#retry-assistance-confirm").hidden = !state.assistanceFailed || !assistanceConfig.enabled;
    if (state.assistanceWarnings.length) {
      $("#assist-warning strong").textContent = "Check these suggestions.";
      $("#assist-warning span").textContent = "Some details were ambiguous. Check which dish each detail belongs to before saving.";
    } else if (failed || state.assistanceFailed) {
      $("#assist-warning strong").textContent = "Suggestions were unavailable.";
      $("#assist-warning span").textContent = "Basic suggestions were used. Your visible draft is intact and can be saved without retrying.";
    }
    $("#country-suggestion").hidden = failed || (!state.suggestedCountry && !state.countrySuggestion);
    $("#country-suggestion").textContent = state.countryProvenance === "from-note" ? "From your note" : "Suggested";
    $("#details-suggestion").hidden = failed || !state.assistedDishes.length;
    renderCountrySuggestion();
    state.matchingCooks = archive?.listCooks ? await archive.listCooks() : [];
    renderDishMatches($("#match-group"), { dishName: name, country: $("#confirm-country").value, groupName: "dishMatch-primary", onSelect: (id, forceNew) => { state.primaryMatchedDishId = id; state.primaryForceNewDish = forceNew; } });
    clearConfirmationDishes();
    state.assistedDishes.slice(1).forEach((dish) => addConfirmationDish(dish, { focus: false, fromAssistance: true }));
    state.confirmationBaseline = {
      dishName: $("#confirm-dish").value,
      cookedAt: $("#confirm-date").value,
      country: $("#confirm-country").value,
      rating: $("#confirm-rating").value,
      notes: $("#confirm-notes").value,
      ingredients: $("#confirm-ingredients").value,
    };
  }

  function formatCookedDate(value) {
    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
  }

  function clearArchiveObjectUrls() {
    state.archiveObjectUrls.forEach((url) => URL.revokeObjectURL(url));
    state.archiveObjectUrls = [];
    clearMapMarkerObjectUrls();
  }

  function photoUrlForCook(cook) {
    const url = URL.createObjectURL(cook.photoBlob);
    state.archiveObjectUrls.push(url);
    return url;
  }

  function photoUrlForBlob(blob) {
    const url = URL.createObjectURL(blob);
    state.archiveObjectUrls.push(url);
    return url;
  }

  function mapPhotoUrlForDish(dish) {
    const url = URL.createObjectURL(dish.latestCook.mapPhotoBlob || dish.latestCook.photoBlob);
    state.archiveObjectUrls.push(url);
    return url;
  }

  function clearMapMarkerObjectUrls() {
    state.mapMarkerObjectUrls.forEach((url) => URL.revokeObjectURL(url));
    state.mapMarkerObjectUrls = [];
  }

  function mapMarkerPhotoUrl(dish) {
    const url = URL.createObjectURL(dish.latestCook.mapPhotoBlob || dish.latestCook.photoBlob);
    state.mapMarkerObjectUrls.push(url);
    return url;
  }

  function pluralize(count, singular, plural = `${singular}s`) {
    return `${count} ${count === 1 ? singular : plural}`;
  }

  function renderWorldMaps() {
    const countries = worldMap?.countries || [];
    $$('[data-world-countries]').forEach((group) => {
      const interactive = Boolean(group.closest("#full-map"));
      const fragment = document.createDocumentFragment();
      countries.forEach((country) => {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        const region = culinaryRegions?.findRegionByCountryKey?.(country.key);
        path.classList.add("world-country");
        path.dataset.countryKey = country.key;
        if (region) path.dataset.regionId = region.id;
        path.setAttribute("d", country.path);
        path.setAttribute("vector-effect", "non-scaling-stroke");
        if (interactive) path.addEventListener("click", () => handleMapCountryPath(country.key, region?.id || ""));
        fragment.append(path);
      });
      group.replaceChildren(fragment);
    });
  }

  function updateMapCountryStyles(regionId = "", countryKey = "") {
    $$("#full-map .world-country").forEach((country) => {
      country.classList.toggle("is-selected", country.dataset.countryKey === countryKey);
      country.classList.toggle("is-in-region", Boolean(regionId) && country.dataset.regionId === regionId);
    });
  }

  function makeDishButton(dish, className, metaText) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    const image = document.createElement("img");
    const copy = document.createElement("span");
    const name = document.createElement("strong");
    const meta = document.createElement("small");
    button.type = "button";
    button.className = className;
    button.dataset.cookId = dish.latestCook.id;
    image.src = photoUrlForCook(dish.latestCook);
    image.alt = "";
    name.textContent = dish.dishName;
    meta.textContent = metaText;
    copy.append(name, meta);
    button.append(image, copy);
    button.addEventListener("click", () => void openCook(dish.latestCook.id));
    item.append(button);
    return item;
  }

  function renderPhotoMap(container, dishes, interactive) {
    container.replaceChildren();
    dishes.forEach((dish) => {
      const cell = document.createElement(interactive ? "button" : "span");
      const image = document.createElement("img");
      const count = document.createElement("span");
      if (interactive) {
        cell.type = "button";
        cell.dataset.dishId = dish.dishId;
        cell.setAttribute(
          "aria-label",
          `${dish.dishName}, ${dish.country}, ${pluralize(dish.attemptCount, "cook")}`,
        );
        cell.addEventListener("click", () => selectMapDish(dish.dishId));
      }
      cell.className = "map-photo-cell";
      cell.style.setProperty("--map-x", `${dish.position.x}%`);
      cell.style.setProperty("--map-y", `${dish.position.y}%`);
      image.src = mapPhotoUrlForDish(dish);
      image.alt = "";
      count.textContent = String(dish.attemptCount);
      count.className = "map-cell-count";
      cell.append(image, count);
      container.append(cell);
    });
  }

  function renderYearFromCooks(cooks, occasions = []) {
    clearArchiveObjectUrls();
    const model = dashboard.buildYearDashboard(cooks);
    state.dashboardModel = model;
    $("#year-eyebrow").textContent = String(model.year);
    $("#year-summary").textContent = `${pluralize(model.dishCount, "dish", "dishes")} across ${pluralize(model.countryCount, "country", "countries")}, all saved on this device.`;
    $("#year-dish-count").textContent = String(model.dishCount);
    $("#year-cook-count").textContent = String(model.cookCount);
    $("#year-country-count").textContent = String(model.countryCount);
    $("#year-error").hidden = true;

    $(".year-hero").hidden = !model.latestCook;
    if (model.latestCook) {
      $("#year-hero-photo").src = photoUrlForCook(model.latestCook);
      $("#year-hero-photo").alt = `${model.latestCook.dishName}, your latest cook`;
      $("#year-hero-dish").textContent = model.latestCook.dishName;
      $("#year-hero-date").textContent = formatCookedDate(model.latestCook.cookedAt);
    } else {
      $("#year-hero-photo").removeAttribute("src");
      $("#year-hero-photo").alt = "";
      $("#year-hero-dish").textContent = "";
      $("#year-hero-date").textContent = "";
    }

    renderPhotoMap(yearMapCells, model.previewDishes, false);
    $("#year-map-label").textContent = model.mappedDishes.length
      ? `Explore ${pluralize(model.mappedDishes.length, "mapped dish", "mapped dishes")}`
      : "Your first mapped dish starts with a country";
    $("#year-map-helper").textContent = model.needsLocation.length
      ? `${pluralize(model.needsLocation.length, "dish")} still ${model.needsLocation.length === 1 ? "needs" : "need"} a confirmed map location.`
      : "Photo cells show recent dishes near their confirmed countries.";

    newDishesList.replaceChildren();
    model.newDishes.forEach((dish) => newDishesList.append(
      makeDishButton(dish, "dish-strip-card", `${dish.country || "Country not added"} · ${formatCookedDate(dish.firstCookedAt)}`),
    ));
    $("#new-dishes-empty").hidden = model.newDishes.length > 0;

    repeatDishesList.replaceChildren();
    model.repeatDishes.forEach((dish) => repeatDishesList.append(
      makeDishButton(dish, "repeat-card", `${pluralize(dish.attemptCount, "cook")} · Latest ${formatCookedDate(dish.latestCookedAt)}`),
    ));
    $("#repeat-dishes-empty").hidden = model.repeatDishes.length > 0;

    const yearPhotos = occasions
      .filter((occasion) => Number(String(occasion.cookedAt).slice(0, 4)) === model.year)
      .flatMap((occasion) => occasion.photos.map((photo) => ({ ...photo, occasion })));
    const recapImages = $("#year-recap-images");
    recapImages.replaceChildren();
    yearPhotos.slice(0, 4).forEach(({ thumbnailBlob, blob, occasion }) => {
      const image = document.createElement("img");
      image.src = photoUrlForBlob(thumbnailBlob || blob);
      image.alt = `${occasion.dishNames.join(" and ")} photograph`;
      recapImages.append(image);
    });
    $("#year-recap-count").textContent = yearPhotos.length ? pluralize(yearPhotos.length, "photo") : "No photos yet this year";
    $("#year-photo-recap").setAttribute("aria-label", `Open ${model.year} photo recap, ${pluralize(yearPhotos.length, "photo")}`);
  }

  async function openYear(options = {}) {
    try {
      const [cooks, occasions] = await Promise.all([archive.listDishAttempts(), archive.listOccasions()]);
      renderYearFromCooks(cooks, occasions);
      showScreen("year");
      if (options.restoreScroll !== false) {
        window.requestAnimationFrame(() => {
          yearScroll.scrollTop = state.yearScrollTop;
          const focusTarget = options.focusCookId
            ? yearScroll.querySelector(`[data-cook-id="${CSS.escape(options.focusCookId)}"]`)
            : options.focusElement;
          focusTarget?.focus({ preventScroll: true });
        });
      }
    } catch (error) {
      await openJournal();
      journalError.textContent = error.message || "Your year could not be prepared, so your journal is shown instead.";
      journalError.hidden = false;
    }
  }

  function formatFileSize(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return "Unavailable";
    if (bytes < 1024) return `${bytes} bytes`;
    const units = ["KB", "MB", "GB"];
    let value = bytes / 1024;
    let unit = units[0];
    for (let index = 1; index < units.length && value >= 1024; index += 1) {
      value /= 1024;
      unit = units[index];
    }
    return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${unit}`;
  }

  function formatBackupDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown date";
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
  }

  function setBackupError(message = "", focus = false) {
    backupError.textContent = message;
    backupError.hidden = !message;
    if (message && focus) window.requestAnimationFrame(() => backupError.focus({ preventScroll: false }));
  }

  function setBackupStatus(message = "") {
    backupStatus.textContent = message;
    backupStatus.hidden = !message;
  }

  function backupProgressMessage(progress, verb) {
    if (!progress?.total) return `${verb}…`;
    return `${verb} ${progress.completed} of ${progress.total} items…`;
  }

  function renderArchiveSummary(summary) {
    state.backupArchiveSummary = summary;
    $("#backup-cook-count").textContent = String(summary.cooks);
    $("#backup-dish-count").textContent = String(summary.dishes);
    $("#backup-idea-count").textContent = String(summary.ideas);
    $("#backup-photo-count").textContent = String(summary.cookingPhotos + summary.ideaImages);
    const totalRecords = Object.values(summary.counts).reduce((total, count) => total + count, 0);
    $("#open-erase-dialog").disabled = totalRecords === 0;
    refreshRestoreAvailability();
  }

  function refreshRestoreAvailability() {
    if (!state.backupInspection || !state.backupArchiveSummary) return;
    const blocker = $("#restore-blocker");
    const summary = state.backupArchiveSummary;
    if (summary.isEmpty) {
      blocker.hidden = true;
      blocker.textContent = "";
      confirmRestoreButton.disabled = false;
      return;
    }
    const existing = [
      pluralize(summary.cooks, "cook", "cooks"),
      pluralize(summary.ideas, "Idea", "Ideas"),
    ].join(" and ");
    blocker.textContent = `This iPhone already has ${existing}. Create a backup, then erase the local archive before restoring. Backups cannot be merged.`;
    blocker.hidden = false;
    confirmRestoreButton.disabled = true;
  }

  async function renderStorageStatus() {
    const title = $("#storage-protection-title");
    const usage = $("#storage-usage");
    const protect = $("#protect-storage");
    protect.hidden = true;
    try {
      if (navigator.storage?.estimate) {
        const estimate = await navigator.storage.estimate();
        usage.textContent = Number.isFinite(estimate.usage) ? `${formatFileSize(estimate.usage)} used by this app.` : "Storage use is unavailable.";
      } else {
        usage.textContent = "Storage use is managed by this browser.";
      }
      if (navigator.storage?.persisted) {
        const persisted = await navigator.storage.persisted();
        if (persisted) {
          title.textContent = "Protected local storage is on";
        } else if (navigator.storage.persist) {
          title.textContent = "Local storage is not protected";
          protect.hidden = false;
        } else {
          title.textContent = "Local storage is browser-managed";
        }
      } else {
        title.textContent = "Local storage is browser-managed";
      }
    } catch {
      title.textContent = "Local storage is browser-managed";
      usage.textContent = "Storage details are unavailable.";
    }
  }

  async function refreshBackupScreen() {
    setBackupError();
    try {
      const summary = await backup.getArchiveSummary();
      renderArchiveSummary(summary);
    } catch (error) {
      setBackupError(error.message || "Your local archive could not be inspected.");
    }
    await renderStorageStatus();
  }

  async function openBackupStorage(trigger = null) {
    state.yearScrollTop = yearScroll?.scrollTop || 0;
    state.backupReturnFocusElement = trigger || $("#open-backup-storage");
    showScreen("backup");
    await refreshBackupScreen();
  }

  function closeBackupStorage() {
    showScreen("year");
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      if (yearScroll) yearScroll.scrollTop = state.yearScrollTop;
      if (state.backupReturnFocusElement?.isConnected) state.backupReturnFocusElement.focus({ preventScroll: true });
    }));
  }

  async function protectLocalStorage() {
    const button = $("#protect-storage");
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    setBackupStatus("Asking this browser to protect local storage…");
    try {
      const granted = await navigator.storage.persist();
      setBackupStatus(granted
        ? "Protected local storage is on. A separate backup is still recommended."
        : "This browser did not grant protected storage. You can still create a backup.");
      await renderStorageStatus();
    } catch {
      setBackupStatus("Storage protection could not be changed. You can still create a backup.");
    } finally {
      button.disabled = false;
      button.removeAttribute("aria-busy");
    }
  }

  async function createPortableBackup() {
    const button = $("#create-backup");
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    setBackupError();
    setBackupStatus("Reading your local archive…");
    try {
      const blob = await backup.createBackupBlob({
        onProgress(progress) {
          const verb = progress.phase === "read" ? "Reading" : progress.phase === "serialize" ? "Preparing" : "Finishing";
          setBackupStatus(backupProgressMessage(progress, verb));
        },
      });
      const fileName = backup.createBackupFileName();
      const file = typeof File === "function" ? new File([blob], fileName, { type: blob.type }) : null;
      let shared = false;
      if (file && typeof navigator.share === "function" && typeof navigator.canShare === "function") {
        try {
          shared = navigator.canShare({ files: [file] });
        } catch {
          shared = false;
        }
      }
      if (shared) {
        try {
          await navigator.share({ title: "What I Made backup", text: "Keep this file somewhere safe, such as Files.", files: [file] });
        } catch (error) {
          if (error?.name === "AbortError") throw error;
          downloadBackupBlob(blob, fileName);
        }
      } else {
        downloadBackupBlob(blob, fileName);
      }
      setBackupStatus("Backup prepared. Keep the downloaded file, or choose Save to Files in the share sheet.");
    } catch (error) {
      if (error?.name === "AbortError") setBackupStatus("Backup sharing was canceled. Your archive was not changed.");
      else {
        setBackupStatus();
        setBackupError(error.message || "The backup could not be prepared. Your archive was not changed.", true);
      }
    } finally {
      button.disabled = false;
      button.removeAttribute("aria-busy");
    }
  }

  function downloadBackupBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function renderRestorePreview(file, inspection) {
    const summary = inspection.summary;
    $("#restore-file-name").textContent = file.name || "What I Made backup";
    $("#restore-created-at").textContent = formatBackupDate(summary.createdAt);
    $("#restore-file-size").textContent = formatFileSize(summary.byteLength);
    $("#restore-schema").textContent = `Backup schema ${summary.schemaVersion}`;
    $("#restore-contents").textContent = `${pluralize(summary.cooks, "cook", "cooks")}, ${pluralize(summary.dishes, "dish", "dishes")}, ${pluralize(summary.ideas, "Idea", "Ideas")}, ${pluralize(summary.cookingPhotos + summary.ideaImages, "image", "images")}`;
    restorePreview.hidden = false;
    $("#view-restored-archive").hidden = true;
    refreshRestoreAvailability();
  }

  async function inspectSelectedBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    state.backupInspection = null;
    restorePreview.hidden = true;
    setBackupError();
    setBackupStatus("Inspecting the selected backup…");
    try {
      const inspection = await backup.inspectBackupBlob(file);
      state.backupInspection = inspection;
      renderRestorePreview(file, inspection);
      setBackupStatus(inspection.summary.mapLocationsReset
        ? `Backup inspected. ${pluralize(inspection.summary.mapLocationsReset, "custom map location")} will reset because the backup uses an older geography version.`
        : "Backup inspected. Review its contents before restoring.");
      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      window.requestAnimationFrame(() => restorePreview.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest" }));
    } catch (error) {
      setBackupStatus();
      setBackupError(error.message || "Choose a supported What I Made backup.", true);
    } finally {
      backupFileInput.value = "";
    }
  }

  async function restoreSelectedBackup() {
    if (!state.backupInspection || confirmRestoreButton.disabled) return;
    confirmRestoreButton.disabled = true;
    confirmRestoreButton.setAttribute("aria-busy", "true");
    setBackupError();
    setBackupStatus("Restoring your archive…");
    try {
      const counts = await backup.restoreValidatedBackup(state.backupInspection.payload, {
        onProgress(progress) { setBackupStatus(backupProgressMessage(progress, "Restoring")); },
      });
      restorePreview.hidden = true;
      $("#view-restored-archive").hidden = false;
      setBackupStatus(`Restored ${pluralize(counts.occasions, "cook", "cooks")}, ${pluralize(counts.ideas, "Idea", "Ideas")}, and ${pluralize(counts.photos + counts.ideaImages, "image", "images")}.`);
      state.backupInspection = null;
      await refreshBackupScreen();
      $("#view-restored-archive").hidden = false;
      window.requestAnimationFrame(() => $("#view-restored-archive").focus());
    } catch (error) {
      setBackupError(error.message || "The backup could not be restored. No records were changed.", true);
      refreshRestoreAvailability();
    } finally {
      confirmRestoreButton.removeAttribute("aria-busy");
    }
  }

  function openEraseArchiveDialog() {
    const summary = state.backupArchiveSummary;
    if (!summary || $("#open-erase-dialog").disabled) return;
    $("#erase-count-summary").textContent = [
      pluralize(summary.cooks, "cook", "cooks"),
      pluralize(summary.dishes, "dish", "dishes"),
      pluralize(summary.ideas, "Idea", "Ideas"),
      pluralize(summary.cookingPhotos, "cooking photograph", "cooking photographs"),
      pluralize(summary.ideaImages, "Idea image", "Idea images"),
      `and ${pluralize(summary.drafts, "unfinished draft", "unfinished drafts")}`,
    ].join(", ");
    eraseConfirmation.value = "";
    $("#erase-error").hidden = true;
    eraseConfirmation.removeAttribute("aria-invalid");
    $("#confirm-erase").disabled = true;
    state.eraseCompleted = false;
    eraseDialog.showModal();
    window.requestAnimationFrame(() => eraseConfirmation.focus());
  }

  function closeEraseArchiveDialog() {
    if (eraseDialog.open) eraseDialog.close();
  }

  async function eraseLocalArchive(event) {
    event.preventDefault();
    if (eraseConfirmation.value.trim() !== "ERASE") return;
    const button = $("#confirm-erase");
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    $("#erase-error").hidden = true;
    eraseConfirmation.removeAttribute("aria-invalid");
    try {
      await backup.clearArchive();
      state.eraseCompleted = true;
      eraseDialog.close();
      setBackupStatus("The local archive was erased. You can now restore a backup.");
      await refreshBackupScreen();
      const next = state.backupInspection ? confirmRestoreButton : backupFileInput;
      window.requestAnimationFrame(() => next.focus());
    } catch (error) {
      $("#erase-error").textContent = error.message || "The local archive could not be erased.";
      $("#erase-error").hidden = false;
      eraseConfirmation.setAttribute("aria-invalid", "true");
      eraseConfirmation.focus();
    } finally {
      button.removeAttribute("aria-busy");
      button.disabled = eraseConfirmation.value.trim() !== "ERASE";
    }
  }

  function makeMapCluster(className, x, y, label, dishes, overflowCount, onClick) {
    const button = document.createElement("button");
    const photos = document.createElement("span");
    const visibleLabel = document.createElement("span");
    button.type = "button";
    button.className = className;
    button.style.setProperty("--map-x", `${x}%`);
    button.style.setProperty("--map-y", `${y}%`);
    button.setAttribute("aria-label", label);
    photos.className = "cluster-photos";
    dishes.forEach((dish) => {
      const image = document.createElement("img");
      image.src = mapPhotoUrlForDish(dish);
      image.alt = "";
      photos.append(image);
    });
    visibleLabel.className = "cluster-label";
    visibleLabel.textContent = label.split(",")[0];
    button.append(photos, visibleLabel);
    if (overflowCount > 0) {
      const overflow = document.createElement("span");
      overflow.className = className === "country-map-cluster" ? "country-cluster-count" : "cluster-overflow";
      overflow.textContent = className === "country-map-cluster" ? String(overflowCount) : `+${overflowCount}`;
      button.append(overflow);
    }
    button.addEventListener("click", onClick);
    return button;
  }

  function makeDishMapMarker(dish) {
    const button = document.createElement("button");
    const count = document.createElement("span");
    button.type = "button";
    button.className = `dish-map-marker is-${state.mapMode}`;
    button.dataset.dishId = dish.dishId;
    button.style.setProperty("--map-x", `${dish.position.x}%`);
    button.style.setProperty("--map-y", `${dish.position.y}%`);
    button.dataset.band = String(mapGeometry.repeatBand(dish.attemptCount));
    button.setAttribute("aria-label", `${dish.dishName}, ${dish.countryName}, ${pluralize(dish.attemptCount, "cook")}, ${state.mapMode === "photo" ? "Photo Density" : "Needle Field"}`);
    count.className = "dish-map-marker-count";
    count.textContent = String(dish.attemptCount);
    if (state.mapMode === "photo") {
      const image = document.createElement("img");
      image.src = mapMarkerPhotoUrl(dish);
      image.alt = "";
      button.append(image, count);
    } else {
      const needle = document.createElement("span");
      needle.className = "needle-visual";
      button.append(needle, count);
    }
    button.addEventListener("click", () => void openDishHistory(dish.dishId, button));
    return button;
  }

  function makeCollisionControl(group, region) {
    const countries = [...new Set(group.members.map((dish) => dish.countryName))];
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dense-map-cluster";
    button.style.setProperty("--map-x", `${group.x}%`);
    button.style.setProperty("--map-y", `${group.y}%`);
    button.textContent = `+${group.members.length}`;
    if (group.kind === "country") {
      button.setAttribute("aria-label", `${group.members.length} dishes in ${countries[0]}, open close-up`);
      button.addEventListener("click", () => openCountryDetail(group.members[0].countryKey, button));
    } else {
      button.setAttribute("aria-label", `${group.members.length} nearby dishes across ${countries.join(" and ")}`);
      button.addEventListener("click", () => openNearbySheet(group.members, region, button));
    }
    return button;
  }

  function renderRegionDishes(region) {
    clearMapMarkerObjectUrls();
    fullMapCells.replaceChildren();
    const bounds = { width: fullMapCells.clientWidth, height: fullMapCells.clientHeight };
    const groups = mapGeometry.collisionGroups(region.countries.flatMap((country) => country.dishes), {
      width: bounds.width || 390,
      height: bounds.height || 252,
      scale: region.scale,
    });
    groups.forEach((group) => {
      fullMapCells.append(group.kind === "dish" ? makeDishMapMarker(group.members[0]) : makeCollisionControl(group, region));
    });
    $("#map-status").textContent = groups.some((group) => group.kind !== "dish")
      ? "Nearby dishes are grouped where full-size controls would overlap. Tap a group for a closer view."
      : `${pluralize(region.countryCount, "country", "countries")} represented in your cooking this year.`;
  }

  function setCountryViewport(countryKey) {
    const geometry = mapGeometry.countryGeometry(countryKey);
    if (!geometry) return 1;
    const width = Math.max(2, (geometry.bounds.maxX - geometry.bounds.minX) / 10);
    const height = Math.max(2, (geometry.bounds.maxY - geometry.bounds.minY) / 5);
    const scale = Math.min(9, Math.max(3.2, Math.min(70 / width, 62 / height)));
    const point = [(geometry.bounds.minX + geometry.bounds.maxX) / 20, (geometry.bounds.minY + geometry.bounds.maxY) / 10];
    setMapViewport({ point, scale });
    return scale;
  }

  function renderCountryDishShelf(country) {
    countryShelf.replaceChildren();
    country.dishes.forEach((dish) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      const image = document.createElement("img");
      const copy = document.createElement("span");
      button.type = "button";
      button.className = "country-card";
      button.dataset.dishId = dish.dishId;
      button.setAttribute("aria-label", `${dish.dishName}, ${pluralize(dish.attemptCount, "cook")}, open all-time history`);
      image.src = mapPhotoUrlForDish(dish); image.alt = ""; image.loading = "lazy";
      copy.className = "country-card-copy";
      copy.innerHTML = `<strong></strong><span></span>`;
      copy.querySelector("strong").textContent = dish.dishName;
      copy.querySelector("span").textContent = pluralize(dish.attemptCount, "cook");
      button.append(image, copy);
      button.addEventListener("click", () => void openDishHistory(dish.dishId, button));
      item.append(button); countryShelf.append(item);
    });
  }

  function renderCountryDetailMarkers(country) {
    clearMapMarkerObjectUrls();
    fullMapCells.replaceChildren();
    const scale = setCountryViewport(country.countryKey);
    const bounds = { width: fullMapCells.clientWidth, height: fullMapCells.clientHeight };
    const groups = mapGeometry.collisionGroups(country.dishes, {
      width: bounds.width || 390,
      height: bounds.height || 252,
      scale,
    });
    groups.forEach((group) => {
      if (group.kind === "dish") {
        fullMapCells.append(makeDishMapMarker(group.members[0]));
        return;
      }
      const button = document.createElement("button");
      button.type = "button";
      button.className = "dense-map-cluster";
      button.style.setProperty("--map-x", `${group.x}%`);
      button.style.setProperty("--map-y", `${group.y}%`);
      button.textContent = `+${group.members.length}`;
      button.setAttribute("aria-label", `${group.members.length} overlapping dishes in ${country.countryName}, browse the complete list`);
      button.addEventListener("click", () => openCountrySheet(country.countryKey, button));
      fullMapCells.append(button);
    });
  }

  function openCountryDetail(countryKey, trigger = null) {
    const country = countryForKey(countryKey);
    const region = country && state.dashboardModel?.regions.find((candidate) => candidate.id === country.regionId);
    if (!country || !region) return;
    state.mapRegionShelfScroll = countryShelf.scrollLeft;
    state.mapNavigation = { level: "country-detail", regionId: region.id, countryKey };
    state.mapReturnFocusElement = trigger;
    renderCountryDishShelf(country);
    $("#full-map").dataset.level = "region";
    $("#map-eyebrow").textContent = `${region.name} · ${pluralize(country.dishCount, "dish", "dishes")}`;
    $("#map-title").textContent = country.countryName;
    $("#map-summary").textContent = "Choose a dish on the close-up map or from the shelf below.";
    $("#map-status").textContent = "The close-up uses approximate culinary locations. Every dish remains available below.";
    $("#country-shelf-title").textContent = `Dishes from ${country.countryName}`;
    $("#map-back-label").textContent = region.name;
    renderCountryDetailMarkers(country);
    updateMapCountryStyles(region.id, countryKey);
    window.requestAnimationFrame(() => $("#map-title").focus({ preventScroll: true }));
  }

  function setMapViewport(region = null) {
    const scale = region?.scale || 1;
    const x = region?.point?.[0] || 50;
    const mapYWithinStage = region ? 11.25 + (region.point[1] * 0.775) : 50;
    atlasMapLayer.style.setProperty("--map-scale", String(scale));
    atlasMapLayer.style.setProperty("--map-tx", `${50 - (x * scale)}%`);
    atlasMapLayer.style.setProperty("--map-ty", `${50 - (mapYWithinStage * scale)}%`);
    atlasMapLayer.style.setProperty("--map-counter-scale", String(1 / scale));
  }

  function renderWorldMapLevel() {
    const model = state.dashboardModel;
    state.mapNavigation = { level: "world", regionId: "", countryKey: "" };
    clearMapMarkerObjectUrls();
    fullMapCells.replaceChildren();
    model.regions.filter((region) => region.dishCount > 0).forEach((region) => {
      const label = `${region.name}, ${pluralize(region.dishCount, "dish", "dishes")} across ${pluralize(region.countryCount, "country", "countries")}`;
      fullMapCells.append(makeMapCluster(
        "region-map-cluster",
        region.point[0],
        region.point[1],
        label,
        region.featuredDishes,
        region.hiddenDishCount,
        () => openMapRegion(region.id),
      ));
    });
    $("#full-map").dataset.level = "world";
    $("#map-eyebrow").textContent = `${model.year} · ${pluralize(model.mappedDishes.length, "mapped dish", "mapped dishes")}`;
    $("#map-title").textContent = "Your culinary atlas";
    $("#map-summary").textContent = "Choose a culinary region to explore the dishes you made there.";
    $("#map-status").textContent = model.regions.some((region) => region.dishCount)
      ? "Photo stacks show up to three frequently cooked dishes while mixing countries."
      : "Add a confirmed country to a cook to begin your map.";
    $("#country-shelf-section").hidden = true;
    $("#map-mode-control").hidden = true;
    $("#map-back").hidden = true;
    $("#map-back-label").textContent = "World";
    $("#map-header-spacer").hidden = false;
    setMapViewport();
    updateMapCountryStyles();
  }

  function renderCountryShelf(region) {
    countryShelf.replaceChildren();
    region.countries.forEach((country) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      const image = document.createElement("img");
      const copy = document.createElement("span");
      const name = document.createElement("strong");
      const meta = document.createElement("span");
      button.type = "button";
      button.className = "country-card";
      button.dataset.countryKey = country.countryKey;
      button.setAttribute("aria-label", `${country.countryName}, ${pluralize(country.dishCount, "dish", "dishes")}, ${pluralize(country.cookCount, "cook")}`);
      image.src = mapPhotoUrlForDish(country.topDish);
      image.alt = "";
      image.loading = "lazy";
      copy.className = "country-card-copy";
      name.textContent = country.countryName;
      meta.textContent = `${pluralize(country.dishCount, "dish", "dishes")} · ${pluralize(country.cookCount, "cook")}`;
      copy.append(name, meta);
      button.append(image, copy);
      button.addEventListener("click", () => openCountrySheet(country.countryKey, button));
      item.append(button);
      countryShelf.append(item);
    });
    $("#region-empty").hidden = region.countries.length > 0;
  }

  function openMapRegion(regionId) {
    const region = state.dashboardModel?.regions.find((candidate) => candidate.id === regionId);
    if (!region) return;
    state.mapNavigation = { level: "region", regionId, countryKey: "" };
    renderCountryShelf(region);
    countryShelf.scrollLeft = state.mapRegionShelfScroll || 0;
    $("#full-map").dataset.level = "region";
    $("#map-eyebrow").textContent = `${state.dashboardModel.year} · ${pluralize(region.dishCount, "dish", "dishes")}`;
    $("#map-title").textContent = region.name;
    $("#map-summary").textContent = "Choose a country on the map or browse the photo shelf below.";
    $("#map-mode-control").hidden = false;
    setMapMode(state.mapMode, { render: false });
    $("#country-shelf-title").textContent = `Countries in ${region.name}`;
    $("#country-shelf-section").hidden = false;
    $("#map-back").hidden = false;
    $("#map-back-label").textContent = "World";
    $("#map-header-spacer").hidden = true;
    setMapViewport(region);
    updateMapCountryStyles(region.id);
    window.requestAnimationFrame(() => {
      renderRegionDishes(region);
      $("#map-title").focus({ preventScroll: true });
    });
  }

  function handleMapCountryPath(countryKey, regionId) {
    if (!regionId) return;
    if (state.mapNavigation.level === "world") {
      openMapRegion(regionId);
      return;
    }
    if (state.mapNavigation.regionId !== regionId) return;
    const country = state.dashboardModel?.countries.find((candidate) => candidate.countryKey === countryKey);
    if (country) openCountrySheet(countryKey, countryShelf.querySelector(`[data-country-key="${countryKey}"]`));
    else $("#map-status").textContent = "No dishes saved in that country this year.";
  }

  function countryForKey(countryKey) {
    return state.dashboardModel?.countries.find((candidate) => candidate.countryKey === countryKey) || null;
  }

  function setMapBackgroundInert(inert) {
    $("#map-main").inert = inert;
    $("#map-screen > .app-bar").inert = inert;
    $("#map-screen > .bottom-nav").inert = inert;
  }

  function openCountrySheet(countryKey, trigger = null) {
    const country = countryForKey(countryKey);
    const region = country && state.dashboardModel?.regions.find((candidate) => candidate.id === country.regionId);
    if (!country || !region) return;
    state.mapSheetReturnState = { ...state.mapNavigation };
    state.mapNavigation = { level: "country", regionId: region.id, countryKey };
    state.mapReturnFocusElement = trigger instanceof HTMLElement ? trigger : null;
    $("#country-sheet-region").textContent = region.name;
    $("#country-sheet-title").textContent = country.countryName;
    $("#country-sheet-summary").removeAttribute("role");
    $("#country-sheet-summary").textContent = `${pluralize(country.dishCount, "dish", "dishes")} · ${pluralize(country.cookCount, "cook")} in ${state.dashboardModel.year}`;
    countrySheet.removeAttribute("aria-busy");
    countryDishGrid.replaceChildren();
    country.dishes.forEach((dish, index) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      const image = document.createElement("img");
      const copy = document.createElement("span");
      const name = document.createElement("strong");
      const meta = document.createElement("small");
      button.type = "button";
      button.className = "country-dish-card";
      button.dataset.dishId = dish.dishId;
      button.setAttribute("aria-label", `${dish.dishName}, ${pluralize(dish.attemptCount, "cook")}, open all-time dish history`);
      image.src = mapPhotoUrlForDish(dish);
      image.alt = "";
      if (index > 1) image.loading = "lazy";
      name.textContent = dish.dishName;
      meta.textContent = `${pluralize(dish.attemptCount, "cook")} · Latest ${formatCookedDate(dish.latestCookedAt)}`;
      copy.append(name, meta);
      button.append(image, copy);
      button.addEventListener("click", () => void openDishHistory(dish.dishId, button));
      item.append(button);
      countryDishGrid.append(item);
    });
    updateMapCountryStyles(region.id, countryKey);
    setMapBackgroundInert(true);
    countrySheetLayer.hidden = false;
    window.requestAnimationFrame(() => $("#close-country-sheet").focus({ preventScroll: true }));
  }

  function openNearbySheet(dishes, region, trigger = null) {
    if (!dishes.length || !region) return;
    state.mapSheetReturnState = { ...state.mapNavigation };
    state.mapNavigation = { level: "nearby", regionId: region.id, countryKey: "" };
    state.mapDetailDishIds = dishes.map((dish) => dish.dishId);
    state.mapReturnFocusElement = trigger instanceof HTMLElement ? trigger : null;
    $("#country-sheet-region").textContent = region.name;
    $("#country-sheet-title").textContent = "Nearby dishes";
    $("#country-sheet-summary").textContent = `${pluralize(dishes.length, "dish", "dishes")} share this part of the map.`;
    countryDishGrid.replaceChildren();
    dishes.slice().sort((left, right) => left.countryName.localeCompare(right.countryName) || left.dishName.localeCompare(right.dishName)).forEach((dish) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      const image = document.createElement("img");
      const copy = document.createElement("span");
      const name = document.createElement("strong");
      const meta = document.createElement("small");
      button.type = "button"; button.className = "country-dish-card";
      button.dataset.dishId = dish.dishId;
      button.setAttribute("aria-label", `${dish.dishName}, ${dish.countryName}, ${pluralize(dish.attemptCount, "cook")}`);
      image.src = mapPhotoUrlForDish(dish); image.alt = ""; image.loading = "lazy";
      name.textContent = dish.dishName; meta.textContent = `${dish.countryName} · ${pluralize(dish.attemptCount, "cook")}`;
      copy.append(name, meta); button.append(image, copy);
      button.addEventListener("click", () => void openDishHistory(dish.dishId, button));
      item.append(button); countryDishGrid.append(item);
    });
    setMapBackgroundInert(true);
    countrySheetLayer.hidden = false;
    window.requestAnimationFrame(() => $("#close-country-sheet").focus({ preventScroll: true }));
  }

  function closeCountrySheet(options = {}) {
    if (countrySheetLayer.hidden) return;
    state.dishHistoryRequestId += 1;
    const regionId = state.mapNavigation.regionId;
    const returnState = state.mapSheetReturnState || { level: "region", regionId, countryKey: "" };
    const returnFocus = state.mapReturnFocusElement;
    countrySheetLayer.hidden = true;
    setMapBackgroundInert(false);
    state.mapNavigation = returnState;
    state.mapSheetReturnState = null;
    state.mapReturnFocusElement = null;
    updateMapCountryStyles(regionId, returnState.level === "country-detail" ? returnState.countryKey : "");
    if (options.restoreFocus !== false && returnFocus?.isConnected) {
      window.requestAnimationFrame(() => returnFocus.focus({ preventScroll: true }));
    }
  }

  function trapCountrySheetFocus(event) {
    if (countrySheetLayer.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeCountrySheet();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = $$("button:not(:disabled), [href], [tabindex]:not([tabindex='-1'])", countrySheet);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function openDishHistory(dishId, trigger) {
    if (trigger?.getAttribute("aria-busy") === "true") return;
    const requestId = state.dishHistoryRequestId + 1;
    const returnState = { ...state.mapNavigation };
    returnState.regionShelfScroll = state.mapRegionShelfScroll;
    returnState.focusDishId = dishId;
    returnState.focusSurface = trigger?.closest("#country-dish-grid")
      ? "sheet"
      : trigger?.closest("#country-shelf") ? "shelf" : "map";
    if (returnState.level === "country" || returnState.level === "nearby") {
      returnState.sheetReturnState = state.mapSheetReturnState ? { ...state.mapSheetReturnState } : null;
    }
    const visibleLevel = returnState.level === "country" || returnState.level === "nearby"
      ? returnState.sheetReturnState?.level
      : returnState.level;
    if (visibleLevel === "country-detail") returnState.detailShelfScroll = countryShelf.scrollLeft;
    else if (visibleLevel === "region") returnState.regionShelfScroll = countryShelf.scrollLeft;
    if (returnState.level === "nearby") returnState.dishIds = state.mapDetailDishIds.slice();
    state.dishHistoryRequestId = requestId;
    trigger?.setAttribute("aria-disabled", "true");
    trigger?.setAttribute("aria-busy", "true");
    try {
      const cooks = (await archive.listDishAttempts()).filter((cook) => cook.dishId === dishId);
      if (requestId !== state.dishHistoryRequestId) return;
      if (!cooks.length) throw new Error("That dish is no longer available.");
      state.currentDishHistoryId = dishId;
      state.dishReturnCountryKey = cooks[0].countryCode || mapGeometry.resolvedPosition(cooks[0].country)?.countryKey || "";
      state.dishReturnMapState = returnState;
      state.dishReturnFocusElement = trigger || state.mapReturnFocusElement;
      $("#dish-history-country").textContent = cooks[0].country || "Country not added";
      $("#dish-history-title").textContent = cooks[0].dishName;
      $("#dish-history-summary").textContent = `${pluralize(cooks.length, "cook")} across your all-time history, newest first.`;
      const list = $("#dish-history-list");
      list.replaceChildren();
      cooks.forEach((cook, index) => {
        const item = document.createElement("li");
        const article = document.createElement("article");
        const image = document.createElement("img");
        const copy = document.createElement("div");
        const header = document.createElement("div");
        const date = document.createElement("time");
        const rating = document.createElement("span");
        article.className = "dish-history-card";
        image.src = photoUrlForCook(cook);
        image.alt = `${cook.dishName}, cooked ${formatCookedDate(cook.cookedAt)}`;
        if (index > 0) image.loading = "lazy";
        copy.className = "dish-history-card-copy";
        header.className = "dish-history-card-header";
        date.dateTime = cook.cookedAt;
        date.textContent = formatCookedDate(cook.cookedAt);
        rating.textContent = cook.rating ? `${cook.rating} out of 10` : "Not rated";
        header.append(date, rating);
        copy.append(
          header,
          makeDishHistoryField("Notes", cook.notes || "No notes saved."),
          makeDishHistoryField("Ingredients", cook.ingredients || "No ingredients saved."),
        );
        article.append(image, copy);
        item.append(article);
        list.append(item);
      });
      if (!countrySheetLayer.hidden) closeCountrySheet({ restoreFocus: false });
      showScreen("dish");
    } catch (error) {
      if (requestId !== state.dishHistoryRequestId) return;
      $("#map-error").textContent = error.message || "This dish history could not be opened.";
      $("#map-error").hidden = false;
    } finally {
      if (trigger?.isConnected) {
        trigger.removeAttribute("aria-disabled");
        trigger.removeAttribute("aria-busy");
      }
    }
  }

  function makeDishHistoryField(label, value) {
    const field = document.createElement("div");
    const heading = document.createElement("span");
    const copy = document.createElement("p");
    field.className = "dish-history-field";
    heading.textContent = label;
    copy.textContent = value;
    field.append(heading, copy);
    return field;
  }

  function clearMapCustomizeObjectUrls() {
    state.mapCustomizeObjectUrls.forEach((url) => URL.revokeObjectURL(url));
    state.mapCustomizeObjectUrls = [];
  }

  function mapCustomizePhotoUrl(blob) {
    const url = URL.createObjectURL(blob);
    state.mapCustomizeObjectUrls.push(url);
    return url;
  }

  function positionEditorMarker(position) {
    const draft = state.mapCustomize;
    if (!draft || !position) return;
    const { minX, minY, width, height } = draft.viewBox;
    mapEditorMarker.style.setProperty("--editor-x", `${((position.x * 10) - minX) / width * 100}%`);
    mapEditorMarker.style.setProperty("--editor-y", `${((position.y * 5) - minY) / height * 100}%`);
  }

  function updateMapCustomizePosition(x, y, options = {}) {
    const draft = state.mapCustomize;
    if (!draft) return false;
    if (!mapGeometry.isPointInCountry(draft.countryKey, x, y)) {
      if (!options.silent) {
        $("#map-customize-error").textContent = "Keep the approximate location inside the confirmed country.";
        $("#map-customize-error").hidden = false;
      }
      return false;
    }
    draft.mapLocation = { x, y, countryKey: draft.countryKey, mapDataVersion: mapGeometry.MAP_DATA_VERSION };
    draft.dirty = true;
    $("#map-customize-error").hidden = true;
    positionEditorMarker(draft.mapLocation);
    return true;
  }

  function editorEventPosition(event) {
    const svg = $("#map-location-stage svg");
    const point = svg.createSVGPoint();
    point.x = event.clientX; point.y = event.clientY;
    const transformed = point.matrixTransform(svg.getScreenCTM().inverse());
    return { x: transformed.x / 10, y: transformed.y / 5 };
  }

  function renderMapPhotoOptions(preferences) {
    const options = $("#map-photo-options");
    options.replaceChildren();
    preferences.eligiblePhotos.forEach((photo) => {
      const button = document.createElement("button");
      const image = document.createElement("img");
      const badge = document.createElement("span");
      const url = mapCustomizePhotoUrl(photo.thumbnailBlob || photo.blob);
      button.type = "button"; button.className = "map-photo-option";
      button.dataset.photoId = photo.id;
      button.setAttribute("aria-pressed", String(photo.id === state.mapCustomize.defaultPhotoId));
      button.setAttribute("aria-label", `${photo.id === state.mapCustomize.defaultPhotoId ? "Current default" : "Use"} map photograph`);
      image.src = url; image.alt = "";
      badge.textContent = photo.id === state.mapCustomize.defaultPhotoId ? "Default" : "Use photo";
      button.append(image, badge);
      button.addEventListener("click", () => {
        state.mapCustomize.defaultPhotoId = photo.id;
        state.mapCustomize.dirty = true;
        $$(".map-photo-option", options).forEach((candidate) => {
          const selected = candidate.dataset.photoId === photo.id;
          candidate.setAttribute("aria-pressed", String(selected));
          candidate.querySelector("span").textContent = selected ? "Default" : "Use photo";
        });
        $("#map-editor-photo").src = url;
      });
      options.append(button);
    });
  }

  async function openMapCustomize(trigger) {
    if (!state.currentDishHistoryId || trigger?.getAttribute("aria-busy") === "true") return;
    const dishId = state.currentDishHistoryId;
    const requestId = state.mapCustomizeRequestId + 1;
    state.mapCustomizeRequestId = requestId;
    trigger?.setAttribute("aria-busy", "true");
    trigger?.setAttribute("aria-disabled", "true");
    $("#map-customize-error").hidden = true;
    try {
      const preferences = await archive.getDishMapPreferences(dishId);
      const activeScreen = screens.find((screen) => !screen.hidden)?.dataset.screen;
      if (requestId !== state.mapCustomizeRequestId || activeScreen !== "dish" || state.currentDishHistoryId !== dishId) return;
      clearMapCustomizeObjectUrls();
      const country = worldMap.findCountry(preferences.dish.country);
      if (!country) throw new Error("Add a supported country before adjusting this dish's location.");
      const geometry = mapGeometry.countryGeometry(country.key);
      const padding = Math.max(3, Math.min(18, Math.max(geometry.bounds.maxX - geometry.bounds.minX, geometry.bounds.maxY - geometry.bounds.minY) * 0.18));
      const viewBox = {
        minX: geometry.bounds.minX - padding,
        minY: geometry.bounds.minY - padding,
        width: geometry.bounds.maxX - geometry.bounds.minX + padding * 2,
        height: geometry.bounds.maxY - geometry.bounds.minY + padding * 2,
      };
      const resolved = mapGeometry.resolvedPosition(preferences.dish.country, preferences.dish.mapLocation);
      state.mapCustomizeReturnFocus = trigger;
      state.mapCustomize = {
        dishId: preferences.dish.id,
        countryKey: country.key,
        defaultPhotoId: preferences.dish.defaultMapPhotoId || preferences.eligiblePhotos[0]?.id || "",
        mapLocation: preferences.dish.mapLocation || null,
        initialDefaultPhotoId: preferences.dish.defaultMapPhotoId || preferences.eligiblePhotos[0]?.id || "",
        initialMapLocation: preferences.dish.mapLocation || null,
        dirty: false,
        viewBox,
      };
      $("#map-customize-title").textContent = `Customize ${preferences.dish.canonicalName}`;
      $("#map-customize-country").textContent = `${country.name} · approximate culinary location`;
      const editorSvg = $("#map-location-stage svg");
      editorSvg.setAttribute("viewBox", `${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`);
      mapLocationStage.style.setProperty("--editor-aspect", String(viewBox.width / viewBox.height));
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", country.path); path.classList.add("editor-country-shape");
      $("#map-editor-country").replaceChildren(path);
      renderMapPhotoOptions(preferences);
      const selectedPhoto = preferences.eligiblePhotos.find((photo) => photo.id === state.mapCustomize.defaultPhotoId) || preferences.eligiblePhotos[0];
      $("#map-editor-photo").src = selectedPhoto ? mapCustomizePhotoUrl(selectedPhoto.thumbnailBlob || selectedPhoto.blob) : "";
      positionEditorMarker(resolved);
      mapCustomizeDialog.showModal();
      window.requestAnimationFrame(() => $("#close-map-customize").focus());
    } catch (error) {
      if (requestId !== state.mapCustomizeRequestId) return;
      $("#map-error").textContent = error.message || "Map customization is unavailable.";
      $("#map-error").hidden = false;
    } finally {
      if (trigger?.isConnected) {
        trigger.removeAttribute("aria-busy");
        trigger.removeAttribute("aria-disabled");
      }
    }
  }

  function closeMapCustomize(options = {}) {
    if (!mapCustomizeDialog.open) return;
    if (state.mapCustomize?.dirty && options.force !== true && !window.confirm("Discard your unsaved map changes?")) return;
    state.mapCustomizeRequestId += 1;
    mapCustomizeDialog.close();
    clearMapCustomizeObjectUrls();
    state.mapCustomize = null;
    window.requestAnimationFrame(() => state.mapCustomizeReturnFocus?.focus({ preventScroll: true }));
  }

  async function saveMapCustomize(event) {
    event.preventDefault();
    const draft = state.mapCustomize;
    if (!draft) return;
    const button = $("#save-map-customize");
    button.disabled = true; button.setAttribute("aria-busy", "true");
    try {
      await archive.updateDishMapPreferences(draft.dishId, { defaultMapPhotoId: draft.defaultPhotoId, mapLocation: draft.mapLocation });
      state.dashboardModel = dashboard.buildYearDashboard(await archive.listDishAttempts());
      draft.dirty = false;
      closeMapCustomize({ force: true });
      $("#dish-history-summary").textContent += " Map appearance updated.";
    } catch (error) {
      $("#map-customize-error").textContent = error.message || "The map changes could not be saved.";
      $("#map-customize-error").hidden = false;
      $("#map-customize-error").focus?.();
    } finally {
      button.disabled = false; button.removeAttribute("aria-busy");
    }
  }

  function renderMapFromCooks(cooks) {
    clearArchiveObjectUrls();
    const model = dashboard.buildYearDashboard(cooks);
    state.dashboardModel = model;
    $("#map-error").hidden = true;
    needsLocationList.replaceChildren();
    model.needsLocation.forEach((dish) => {
      const item = document.createElement("li");
      item.textContent = `${dish.dishName}${dish.country ? ` · ${dish.country}` : " · Country not added"}`;
      needsLocationList.append(item);
    });
    $("#needs-location-section").hidden = model.needsLocation.length === 0;
    renderWorldMapLevel();
  }

  async function openMap() {
    try {
      const cooks = await archive.listDishAttempts();
      if (!cooks.length) {
        resetCapture({ scenario: "blank" });
        return;
      }
      if (!countrySheetLayer.hidden) closeCountrySheet({ restoreFocus: false });
      renderMapFromCooks(cooks);
      showScreen("map");
    } catch (error) {
      await openJournal();
      journalError.textContent = error.message || "Your map could not be opened, so your journal is shown instead.";
      journalError.hidden = false;
    }
  }

  function clearIdeaObjectUrls() {
    state.ideaObjectUrls.forEach((url) => URL.revokeObjectURL(url));
    state.ideaObjectUrls = [];
  }

  function ideaImageUrl(blob) {
    if (!(blob instanceof Blob)) return "";
    const url = URL.createObjectURL(blob);
    state.ideaObjectUrls.push(url);
    return url;
  }

  function appendIdeaPhoto(container, idea, alt = "", preferThumbnail = false) {
    container.replaceChildren();
    const imageBlob = preferThumbnail ? (idea?.image?.thumbnailBlob || idea?.image?.blob) : (idea?.image?.displayBlob || idea?.image?.blob);
    const src = imageBlob ? ideaImageUrl(imageBlob) : "";
    if (src) {
      const image = document.createElement("img");
      image.src = src;
      image.alt = alt;
      image.loading = "lazy";
      container.append(image);
    } else {
      const placeholder = document.createElement("span");
      placeholder.className = "idea-photo-placeholder";
      placeholder.textContent = idea?.sourceKind === "generated" ? "AI draft · add your own photo" : (idea?.title || "Recipe idea");
      container.append(placeholder);
    }
  }

  async function renderIdeas() {
    const grid = $("#ideas-grid");
    const empty = $("#ideas-empty");
    const error = $("#ideas-error");
    clearIdeaObjectUrls();
    grid.replaceChildren();
    error.hidden = true;
    try {
      const allIdeas = await ideas.listIdeas({ query: state.ideaQuery, filter: state.ideaFilter });
      empty.hidden = allIdeas.length > 0;
      empty.querySelector("h3").textContent = state.ideaQuery || state.ideaFilter !== "all" ? "No ideas match this view." : "No ideas saved yet.";
      allIdeas.forEach((idea) => {
        const item = document.createElement("li");
        const button = document.createElement("button");
        const photo = document.createElement("span");
        const copy = document.createElement("span");
        const title = document.createElement("strong");
        const source = document.createElement("span");
        button.type = "button";
        button.className = "idea-card";
        button.setAttribute("aria-label", `${idea.title}, ${idea.made ? "made" : "not cooked yet"}${idea.sourceName ? `, from ${idea.sourceName}` : ""}`);
        photo.className = "idea-card-photo";
        appendIdeaPhoto(photo, idea, "", true);
        copy.className = "idea-card-copy";
        title.textContent = idea.title;
        source.textContent = idea.sourceName || (idea.sourceKind === "generated" ? "AI-generated draft" : "Personal recipe");
        copy.append(title, source);
        if (idea.made) {
          const made = document.createElement("span");
          made.className = "idea-made-label";
          made.textContent = "Made";
          copy.append(made);
        }
        button.append(photo, copy);
        button.addEventListener("click", () => {
          state.ideasScrollTop = $("#ideas-scroll").scrollTop;
          void openIdeaDetail(idea.id);
        });
        item.append(button);
        grid.append(item);
      });
    } catch (caught) {
      empty.hidden = true;
      error.textContent = caught.message || "Your Ideas collection could not be opened.";
      error.hidden = false;
    }
  }

  async function openIdeas(options = {}) {
    await renderIdeas();
    showScreen("ideas");
    if (options.restoreScroll !== false) {
      window.requestAnimationFrame(() => { $("#ideas-scroll").scrollTop = state.ideasScrollTop; });
    }
  }

  function setIdeaPath(path, options = {}) {
    const isLink = path === "link";
    $("#idea-link-tab").setAttribute("aria-selected", String(isLink));
    $("#idea-describe-tab").setAttribute("aria-selected", String(!isLink));
    $("#idea-link-tab").tabIndex = isLink ? 0 : -1;
    $("#idea-describe-tab").tabIndex = isLink ? -1 : 0;
    $("#idea-link-panel").hidden = !isLink;
    $("#idea-describe-panel").hidden = isLink;
    if (options.focusPanel !== false) window.requestAnimationFrame(() => (isLink ? $("#idea-url") : $("#idea-description")).focus());
  }

  async function openIdeaAdd() {
    const savedDraft = await ideas.getDraft().catch(() => null);
    if (savedDraft?.recipe) {
      await openIdeaReview(savedDraft.recipe, { mode: savedDraft.mode || "new", restored: true });
      return;
    }
    state.currentIdeaId = "";
    $("#idea-fetch-status").hidden = true;
    $("#idea-url-error").hidden = true;
    $("#idea-description-error").hidden = true;
    showScreen("idea-add");
  }

  function setIdeaBusy(form, busy, message) {
    const button = form.querySelector('button[type="submit"]');
    form.setAttribute("aria-busy", String(busy));
    button.disabled = busy;
    if (busy) {
      button.dataset.label = button.textContent;
      button.textContent = message;
    } else if (button.dataset.label) button.textContent = button.dataset.label;
  }

  async function prepareIdeaImage(recipe) {
    const imageReference = recipe.imageToken || recipe.imageUrl;
    if (!imageReference || !recipeClient?.fetchImage) return null;
    try {
      const source = await recipeClient.fetchImage(imageReference, state.ownerToken);
      if (!(source instanceof Blob)) return null;
      return photoProcessor?.processPhoto ? await photoProcessor.processPhoto(source) : { blob: source };
    } catch {
      return null;
    }
  }

  async function importIdeaUrl(url, options = {}) {
    const existing = await ideas.findBySourceUrl(url);
    if (existing && !options.refreshId) {
      await openIdeaDetail(existing.id, { message: "You already saved this source." });
      return;
    }
    const payload = await recipeClient.importRecipe(url, state.ownerToken);
    const recipe = { ...payload.recipe, imageToken: payload.imageToken || payload.recipe.imageToken, sourceKind: options.refreshId ? existing?.sourceKind || "url" : (payload.recipe.sourceKind || "url") };
    if (options.refreshId) {
      const current = await ideas.getIdea(options.refreshId);
      const fields = ["title", "description", "servings", "prepTime", "cookTime", "ingredients", "instructions"];
      const changed = fields.filter((field) => JSON.stringify(current?.[field] || null) !== JSON.stringify(recipe[field] || null)).length;
      Object.assign(recipe, { id: current.id, createdAt: current.createdAt, imageId: current.imageId, personalNotes: current.personalNotes, refreshChangeCount: changed });
    }
    await openIdeaReview(recipe, { mode: options.refreshId ? "refresh" : "new" });
  }

  async function submitIdeaUrl(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const field = $("#idea-url");
    const error = $("#idea-url-error");
    error.hidden = true;
    let canonical;
    try { canonical = ideas.canonicalizeSourceUrl(field.value); } catch (caught) {
      error.textContent = caught.message;
      error.hidden = false;
      field.setAttribute("aria-invalid", "true");
      field.focus();
      return;
    }
    field.removeAttribute("aria-invalid");
    setIdeaBusy(form, true, "Retrieving…");
    try { await importIdeaUrl(canonical); }
    catch (caught) {
      error.textContent = caught.message || "That recipe could not be retrieved. Try another public recipe page or add it manually.";
      error.hidden = false;
    } finally { setIdeaBusy(form, false); }
  }

  function renderIdeaResults(candidates) {
    const list = $("#idea-results-list");
    clearIdeaObjectUrls();
    list.replaceChildren();
    $("#idea-results-empty").hidden = candidates.length > 0;
    candidates.forEach((candidate) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      const photo = document.createElement("span");
      const copy = document.createElement("span");
      button.type = "button";
      button.className = "idea-result-card";
      button.setAttribute("aria-label", `${candidate.title}, from ${candidate.sourceName || "source"}`);
      photo.className = "idea-result-photo";
      if (candidate.imageUrl && !candidate.imageToken) {
        const image = document.createElement("img");
        image.src = candidate.imageUrl;
        image.alt = "";
        image.onerror = () => appendIdeaPhoto(photo, candidate);
        photo.append(image);
      } else {
        appendIdeaPhoto(photo, candidate);
        if (candidate.imageToken) {
          void recipeClient.fetchImage(candidate.imageToken, state.ownerToken).then((blob) => {
            if (!(blob instanceof Blob) || !photo.isConnected) return;
            photo.replaceChildren();
            const image = document.createElement("img");
            image.src = ideaImageUrl(blob);
            image.alt = "";
            photo.append(image);
          }).catch(() => {});
        }
      }
      copy.className = "idea-result-copy";
      const title = document.createElement("strong");
      const source = document.createElement("span");
      const description = document.createElement("p");
      title.textContent = candidate.title;
      source.textContent = candidate.sourceName || new URL(candidate.sourceUrl).hostname;
      description.textContent = candidate.description || "Open this result to review its recipe.";
      copy.append(title, source, description);
      button.append(photo, copy);
      button.addEventListener("click", async () => {
        button.disabled = true;
        button.setAttribute("aria-busy", "true");
        try { await importIdeaUrl(candidate.sourceUrl); }
        catch (caught) {
          $("#idea-results-error").textContent = caught.message || "This recipe could not be retrieved.";
          $("#idea-results-error").hidden = false;
        } finally { button.disabled = false; button.removeAttribute("aria-busy"); }
      });
      item.append(button);
      list.append(item);
    });
  }

  async function submitIdeaDescription(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const field = $("#idea-description");
    const error = $("#idea-description-error");
    const description = field.value.trim();
    if (!description) {
      error.textContent = "Describe the dish you want to find.";
      error.hidden = false;
      field.setAttribute("aria-invalid", "true");
      field.focus();
      return;
    }
    error.hidden = true;
    field.removeAttribute("aria-invalid");
    state.ideaSearchDescription = description;
    setIdeaBusy(form, true, "Searching…");
    try {
      const payload = await recipeClient.search(description, state.ownerToken);
      renderIdeaResults((payload.candidates || []).slice(0, 3));
      showScreen("idea-results");
    } catch (caught) {
      error.textContent = caught.message || "Recipe search is unavailable. Your description is still here.";
      error.hidden = false;
    } finally { setIdeaBusy(form, false); }
  }

  function setReviewImage(image, title) {
    clearIdeaObjectUrls();
    const container = $("#idea-review-image");
    if (image?.blob) appendIdeaPhoto(container, { image, title }, `${title || "Recipe"} source preview`);
    else appendIdeaPhoto(container, { title, sourceKind: state.ideaDraft?.sourceKind });
  }

  async function openIdeaReview(recipe, options = {}) {
    state.currentIdeaId = recipe.id || "";
    state.ideaDraft = { ...recipe, ingredients: [...(recipe.ingredients || [])], instructions: [...(recipe.instructions || [])] };
    state.ideaReviewMode = options.mode || "new";
    state.ideaDraftImage = recipe.draftImage?.blob
      ? recipe.draftImage
      : (recipe.image?.displayBlob || recipe.image?.blob)
        ? { blob: recipe.image.displayBlob || recipe.image.blob, thumbnailBlob: recipe.image.thumbnailBlob, width: recipe.image.width, height: recipe.image.height, thumbnailWidth: recipe.image.thumbnailWidth, thumbnailHeight: recipe.image.thumbnailHeight }
        : await prepareIdeaImage(recipe);
    $("#idea-title").value = recipe.title || "";
    $("#idea-summary").value = recipe.description || "";
    $("#idea-servings").value = recipe.servings || "";
    $("#idea-prep-time").value = recipe.prepTime || "";
    $("#idea-cook-time").value = recipe.cookTime || "";
    $("#idea-ingredients").value = (recipe.ingredients || []).join("\n");
    $("#idea-instructions").value = (recipe.instructions || []).join("\n");
    $("#idea-personal-notes").value = recipe.personalNotes || "";
    $("#idea-review-error").hidden = true;
    $("#idea-review-eyebrow").textContent = options.restored
      ? "Recovered editable draft"
      : options.mode === "refresh"
        ? `${recipe.refreshChangeCount || 0} source field${recipe.refreshChangeCount === 1 ? "" : "s"} changed · review before replacing`
        : recipe.sourceKind === "generated" ? "AI-generated · review every detail" : "Editable draft";
    const hasSource = Boolean(recipe.sourceUrl);
    $("#idea-source-review").hidden = !hasSource;
    if (hasSource) {
      $("#idea-source-name").textContent = recipe.sourceName || new URL(recipe.sourceUrl).hostname;
      $("#idea-source-author").textContent = recipe.sourceAuthor ? `By ${recipe.sourceAuthor}` : "Source attribution retained";
      $("#idea-source-link").href = recipe.sourceUrl;
    }
    setReviewImage(state.ideaDraftImage, recipe.title);
    await ideas.saveDraft({ recipe: { ...state.ideaDraft, draftImage: state.ideaDraftImage }, mode: state.ideaReviewMode }).catch(() => {});
    showScreen("idea-review");
  }

  async function handleIdeaPhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const error = $("#idea-review-error");
    error.hidden = true;
    try {
      state.ideaDraftImage = photoProcessor?.processPhoto ? await photoProcessor.processPhoto(file) : { blob: file };
      setReviewImage(state.ideaDraftImage, $("#idea-title").value);
      await ideas.saveDraft({ recipe: ideaDraftFromForm(), mode: state.ideaReviewMode });
    } catch (caught) {
      error.textContent = caught.message || "That image could not be prepared.";
      error.hidden = false;
      error.focus();
    }
  }

  async function submitIdeaReview(event) {
    event.preventDefault();
    const error = $("#idea-review-error");
    const button = $("#save-idea");
    const draft = state.ideaDraft || {};
    const input = {
      ...draft,
      title: $("#idea-title").value,
      description: $("#idea-summary").value,
      servings: $("#idea-servings").value,
      prepTime: $("#idea-prep-time").value,
      cookTime: $("#idea-cook-time").value,
      ingredients: $("#idea-ingredients").value,
      instructions: $("#idea-instructions").value,
      personalNotes: $("#idea-personal-notes").value,
    };
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.textContent = state.ideaReviewMode === "refresh" ? "Saving refreshed recipe…" : "Saving idea…";
    error.hidden = true;
    try {
      const id = await ideas.saveIdea(input, state.ideaDraftImage);
      await ideas.clearDraft();
      state.ideaDraft = null;
      state.ideaDraftImage = null;
      await openIdeaDetail(id, { message: state.ideaReviewMode === "refresh" ? "Source refresh saved." : "Idea saved on this device." });
    } catch (caught) {
      error.textContent = caught.message || "This idea could not be saved. Your draft is still here.";
      error.hidden = false;
      error.focus();
    } finally {
      button.disabled = false;
      button.removeAttribute("aria-busy");
      button.textContent = "Save idea";
    }
  }

  function ideaDraftFromForm() {
    return {
      ...(state.ideaDraft || {}),
      title: $("#idea-title").value,
      description: $("#idea-summary").value,
      servings: $("#idea-servings").value,
      prepTime: $("#idea-prep-time").value,
      cookTime: $("#idea-cook-time").value,
      ingredients: $("#idea-ingredients").value.split("\n").filter(Boolean),
      instructions: $("#idea-instructions").value.split("\n").filter(Boolean),
      personalNotes: $("#idea-personal-notes").value,
      draftImage: state.ideaDraftImage || null,
    };
  }

  async function openIdeaDetail(id, options = {}) {
    const idea = await ideas.getIdea(id);
    if (!idea) { await openIdeas(); return; }
    clearIdeaObjectUrls();
    state.currentIdeaId = id;
    appendIdeaPhoto($("#idea-detail-photo"), idea, `${idea.title} recipe preview`);
    $("#idea-detail-status").textContent = idea.made ? "Made from this idea" : "Not cooked yet";
    $("#idea-detail-title").textContent = idea.title;
    $("#idea-detail-summary").textContent = idea.description || "Your saved recipe snapshot.";
    const facts = $("#idea-detail-facts");
    facts.replaceChildren();
    [["Servings", idea.servings], ["Prep", idea.prepTime], ["Cook", idea.cookTime]].filter(([, value]) => value).forEach(([label, value]) => {
      const wrapper = document.createElement("div");
      const term = document.createElement("dt");
      const detail = document.createElement("dd");
      term.textContent = label;
      detail.textContent = value;
      wrapper.append(term, detail);
      facts.append(wrapper);
    });
    const renderLines = (selector, lines) => {
      const list = $(selector);
      list.replaceChildren();
      lines.forEach((line) => { const item = document.createElement("li"); item.textContent = line; list.append(item); });
    };
    renderLines("#idea-detail-ingredients", idea.ingredients);
    renderLines("#idea-detail-instructions", idea.instructions);
    $("#idea-notes-section").hidden = !idea.personalNotes;
    $("#idea-detail-notes").textContent = idea.personalNotes || "";
    const source = $("#idea-source-detail");
    source.replaceChildren();
    source.hidden = !idea.sourceUrl && idea.sourceKind !== "generated";
    if (idea.sourceKind === "generated") {
      const label = document.createElement("strong");
      const note = document.createElement("span");
      label.textContent = "AI-generated draft";
      note.textContent = "This recipe has no published source. Review it carefully before cooking.";
      source.append(label, note);
    } else if (idea.sourceUrl) {
      const label = document.createElement("strong");
      const author = document.createElement("span");
      const link = document.createElement("a");
      label.textContent = idea.sourceName || new URL(idea.sourceUrl).hostname;
      author.textContent = idea.sourceAuthor ? `By ${idea.sourceAuthor}` : "Saved source";
      link.href = idea.sourceUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Open original";
      source.append(label, author, link);
    }
    $("#refresh-idea").hidden = !idea.sourceUrl;
    const message = $("#idea-detail-message");
    message.textContent = options.message || "";
    message.hidden = !options.message;
    showScreen("idea-detail");
  }

  async function generateIdeaDraft() {
    const button = $("#generate-idea");
    const error = $("#idea-results-error");
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    error.hidden = true;
    try {
      const payload = await recipeClient.generate(state.ideaSearchDescription, state.ownerToken);
      await openIdeaReview({ ...payload.recipe, sourceKind: "generated", sourceUrl: null, imageUrl: null }, { mode: "new" });
    } catch (caught) {
      error.textContent = caught.message || "An AI draft could not be created. You can still add the recipe manually.";
      error.hidden = false;
    } finally { button.disabled = false; button.removeAttribute("aria-busy"); }
  }

  async function cancelIdeaReview() {
    if (!window.confirm("Discard this recipe draft?")) return;
    await ideas.clearDraft().catch(() => {});
    state.ideaDraft = null;
    state.ideaDraftImage = null;
    if (state.currentIdeaId) await openIdeaDetail(state.currentIdeaId);
    else await openIdeas();
  }

  async function startCookFromIdea() {
    const idea = await ideas.getIdea(state.currentIdeaId);
    if (!idea) return;
    resetCapture({ scenario: "blank", sourceIdeaId: idea.id });
    dishName.value = idea.title;
    ingredients.value = idea.ingredients.join(", ");
    revealOptionalFields();
    updateReadyState();
    $("#open-journal").lastChild.textContent = " Ideas";
    $("#capture-title").textContent = `Cook ${idea.title}`;
  }

  function monthName(month, style = "long") {
    return new Intl.DateTimeFormat(undefined, { month: style }).format(new Date(2020, Number(month) - 1, 1));
  }

  function replaceSelectOptions(select, options, selectedValue) {
    select.replaceChildren(...options.map(({ value, label }) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      return option;
    }));
    select.value = String(selectedValue ?? "");
  }

  function renderJournalFilterOptions(options, filters = state.journalFilters) {
    const countryOptions = [{ value: "all", label: "All countries" }]
      .concat(options.countries.map((country) => ({ value: country.key, label: country.label })));
    if (options.hasMissingCountry) countryOptions.push({ value: journalModel.MISSING_COUNTRY, label: "No country added" });
    replaceSelectOptions(journalCountryFilter, countryOptions, filters.country);
    replaceSelectOptions(journalYearFilter, [{ value: "", label: "All years" }].concat(options.years.map((year) => ({ value: String(year), label: String(year) }))), filters.year);
    replaceSelectOptions(journalMonthFilter, [{ value: "", label: "All months" }].concat(Array.from({ length: 12 }, (_, index) => ({ value: String(index + 1).padStart(2, "0"), label: monthName(index + 1) }))), filters.month);
    journalMonthFilter.disabled = !filters.year;
    journalRatingFilter.value = filters.rating;
  }

  function journalFilterCount(filters = state.journalFilters) {
    return Number(filters.country !== "all") + Number(Boolean(filters.year)) + Number(filters.rating !== "any");
  }

  function renderJournalFilterChips() {
    const chips = $("#active-filter-chips");
    chips.replaceChildren();
    const filters = state.journalFilters;
    const country = state.journalOptions.countries.find((option) => option.key === filters.country);
    const definitions = [];
    if (filters.country !== "all") definitions.push({ key: "country", label: country?.label || "No country added" });
    if (filters.year) definitions.push({ key: "date", label: filters.month ? `${monthName(filters.month, "short")} ${filters.year}` : filters.year });
    if (filters.rating !== "any") definitions.push({
      key: "rating",
      label: filters.rating === "unrated" ? "Unrated" : `${filters.rating.slice(4)}+ rating`,
    });
    definitions.forEach(({ key, label }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "filter-chip";
      button.textContent = label;
      button.setAttribute("aria-label", `Remove ${label} filter`);
      const removeMark = document.createElement("span");
      removeMark.className = "filter-chip-remove";
      removeMark.setAttribute("aria-hidden", "true");
      removeMark.textContent = "×";
      button.append(removeMark);
      button.addEventListener("click", () => {
        if (key === "country") state.journalFilters.country = "all";
        if (key === "date") {
          state.journalFilters.year = "";
          state.journalFilters.month = "";
        }
        if (key === "rating") state.journalFilters.rating = "any";
        state.journalScrollTop = 0;
        void renderJournal({ restoreScroll: false });
      });
      chips.append(button);
    });
    const count = definitions.length;
    $("#active-filter-shell").hidden = count === 0;
    $("#open-journal-filters").textContent = count ? `Filters (${count})` : "Filters";
  }

  async function renderJournal(options = {}) {
    const requestId = ++state.journalRenderRequestId;
    try {
      const cooks = await archive.listOccasions();
      if (requestId !== state.journalRenderRequestId) return [];
      clearArchiveObjectUrls();
      journalList.replaceChildren();
      journalError.hidden = true;
      state.journalCooks = cooks;
      const view = journalModel.buildOccasionJournalView(cooks, { ...state.journalFilters, query: state.journalQuery });
      state.journalOptions = view.options;
      if (journalSearch.value !== state.journalQuery) journalSearch.value = state.journalQuery;
      renderJournalFilterOptions(view.options);
      renderJournalFilterChips();
      journalEmpty.hidden = view.totalCount > 0;
      journalNoResults.hidden = view.totalCount === 0 || view.occasions.length > 0;
      $("#journal-result-count").textContent = view.totalCount ? `${view.occasions.length} of ${pluralize(view.totalCount, "occasion")}` : "No cooks yet";
      view.occasions.forEach((cook, index) => {
        const item = document.createElement("li");
        const button = document.createElement("button");
        const image = document.createElement("img");
        const copy = document.createElement("span");
        const name = document.createElement("strong");
        const meta = document.createElement("span");

        button.type = "button";
        button.className = "journal-card";
        button.dataset.cookId = cook.id;
        image.src = photoUrlForBlob(cook.mainPhoto.thumbnailBlob || cook.mainPhoto.blob);
        image.alt = "";
        if (index > 1) image.loading = "lazy";
        copy.className = "journal-card-copy";
        name.textContent = cook.dishNames.join(" and ");
        const ratings = cook.attempts.filter((attempt) => Number.isInteger(attempt.rating)).map((attempt) => `${attempt.dishName} ${attempt.rating}/10`);
        meta.textContent = `${formatCookedDate(cook.cookedAt)}${ratings.length ? ` · ${ratings.join(" · ")}` : ""}`;
        copy.append(name, meta);
        button.append(image, copy);
        button.addEventListener("click", () => {
          state.journalScrollTop = journalScroll.scrollTop;
          void openCook(cook.id, { returnTo: "journal" });
        });
        item.append(button);
        journalList.append(item);
      });
      if (options.restoreScroll !== false) window.requestAnimationFrame(() => { journalScroll.scrollTop = state.journalScrollTop; });
      return view.occasions;
    } catch (error) {
      if (requestId !== state.journalRenderRequestId) return [];
      journalEmpty.hidden = true;
      journalNoResults.hidden = true;
      journalError.textContent = error.message || "Your journal could not be opened.";
      journalError.hidden = false;
      return [];
    }
  }

  async function openJournal(options = {}) {
    await renderJournal({ restoreScroll: false });
    showScreen("journal");
    if (options.restoreScroll !== false) {
      window.requestAnimationFrame(() => {
        journalScroll.scrollTop = state.journalScrollTop;
        if (options.focusCookId) journalList.querySelector(`[data-cook-id="${CSS.escape(options.focusCookId)}"]`)?.focus({ preventScroll: true });
        else options.focusElement?.focus({ preventScroll: true });
      });
    }
  }

  function recapPhotoLabel(cook) {
    const date = new Date(`${cook.cookedAt}T12:00:00`);
    const spokenDate = Number.isNaN(date.getTime()) ? cook.cookedAt : new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric" }).format(date);
    return `${cook.dishName}, ${spokenDate}${Number.isInteger(cook.rating) ? `, rated ${cook.rating} out of 10` : ", not rated"}`;
  }

  async function renderRecap(options = {}) {
    const requestId = recapRenderGate.begin();
    const requestedYear = Number(state.recapYear);
    const cooks = await archive.listOccasions();
    if (!recapRenderGate.isCurrent(requestId)) return false;
    clearArchiveObjectUrls();
    recapGroups.replaceChildren();
    const filterOptions = journalModel.deriveFilterOptions(cooks);
    state.recapYear = filterOptions.years.includes(requestedYear) ? requestedYear : new Date().getFullYear();
    replaceSelectOptions($("#recap-year"), filterOptions.years.map((year) => ({ value: String(year), label: String(year) })), state.recapYear);
    const recap = journalModel.buildPhotoRecap(cooks, state.recapYear);
    $("#recap-summary").textContent = recap.photoCount
      ? `${pluralize(recap.photoCount, "photo")} across ${pluralize(recap.groups.length, "month")}.`
      : `No cooks saved in ${recap.year}.`;
    $("#recap-empty").hidden = recap.photoCount > 0;
    recap.groups.forEach((group) => {
      const section = document.createElement("section");
      const heading = document.createElement("h3");
      const list = document.createElement("ol");
      section.className = "recap-month";
      heading.textContent = monthName(group.month);
      list.className = "recap-grid";
      group.photos.forEach((cook, index) => {
        const item = document.createElement("li");
        const button = document.createElement("button");
        const image = document.createElement("img");
        const copy = document.createElement("span");
        const name = document.createElement("strong");
        const meta = document.createElement("small");
        button.type = "button";
        button.className = "recap-tile";
        button.dataset.cookId = cook.occasionId;
        button.dataset.photoId = cook.id;
        button.setAttribute("aria-label", recapPhotoLabel(cook));
        image.src = photoUrlForBlob(cook.photo.thumbnailBlob || cook.photo.blob);
        image.alt = "";
        if (index > 1 || recapGroups.children.length > 0) image.loading = "lazy";
        copy.className = "recap-tile-copy";
        name.textContent = cook.displayName || cook.dishName;
        meta.textContent = `${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(`${cook.cookedAt}T12:00:00`))}${Number.isInteger(cook.rating) ? ` · ${cook.rating}/10` : ""}`;
        copy.append(name, meta);
        button.append(image, copy);
        button.addEventListener("click", () => {
          state.recapScrollTop = recapScroll.scrollTop;
          state.entryReturnPhotoId = cook.id;
          void openCook(cook.occasionId, { returnTo: "recap", selectedPhotoId: cook.id });
        });
        item.append(button);
        list.append(item);
      });
      section.append(heading, list);
      recapGroups.append(section);
    });
    if (options.restoreScroll !== false) window.requestAnimationFrame(() => { recapScroll.scrollTop = state.recapScrollTop; });
    return true;
  }

  async function openRecap(origin = state.recapOrigin, options = {}) {
    if (!options.preserveOrigin) {
      state.recapOrigin = origin === "journal" ? "journal" : "year";
      state.recapScrollTop = 0;
    }
    $("#recap-back-label").textContent = state.recapOrigin === "journal" ? "Journal" : "Year";
    try {
      $("#recap-summary").setAttribute("role", "status");
      await renderRecap({ restoreScroll: false });
    } catch (error) {
      recapGroups.replaceChildren();
      $("#recap-empty").hidden = true;
      $("#recap-summary").textContent = error.message || "Your photo recap could not be opened.";
      $("#recap-summary").setAttribute("role", "alert");
    }
    showScreen("recap");
    if (options.restoreScroll !== false) {
      window.requestAnimationFrame(() => {
        recapScroll.scrollTop = state.recapScrollTop;
        if (options.focusPhotoId) recapGroups.querySelector(`[data-photo-id="${CSS.escape(options.focusPhotoId)}"]`)?.focus({ preventScroll: true });
        else if (options.focusCookId) recapGroups.querySelector(`[data-cook-id="${CSS.escape(options.focusCookId)}"]`)?.focus({ preventScroll: true });
      });
    }
  }

  function resetJournalFilters({ includeSearch = false } = {}) {
    state.journalFilters = { country: "all", year: "", month: "", rating: "any" };
    if (includeSearch) {
      state.journalQuery = "";
      journalSearch.value = "";
    }
    state.journalScrollTop = 0;
  }

  function closeJournalFilters({ restoreFocus = true } = {}) {
    if (!journalFilterDialog.open) return;
    journalFilterDialog.close();
    if (restoreFocus) window.requestAnimationFrame(() => (state.journalFilterReturnFocus || $("#open-journal-filters"))?.focus({ preventScroll: true }));
  }

  function openJournalFilters(trigger) {
    state.journalFilterReturnFocus = trigger || $("#open-journal-filters");
    renderJournalFilterOptions(state.journalOptions, state.journalFilters);
    journalFilterDialog.showModal();
    window.requestAnimationFrame(() => $("#close-journal-filters").focus({ preventScroll: true }));
  }

  function applyJournalFiltersFromSheet() {
    state.journalFilters = {
      country: journalCountryFilter.value,
      year: journalYearFilter.value,
      month: journalYearFilter.value ? journalMonthFilter.value : "",
      rating: journalRatingFilter.value,
    };
    state.journalScrollTop = 0;
    closeJournalFilters({ restoreFocus: false });
    void renderJournal({ restoreScroll: false }).then(() => $("#open-journal-filters").focus({ preventScroll: true }));
  }

  async function backFromRecap() {
    state.recapScrollTop = recapScroll.scrollTop;
    if (state.recapOrigin === "journal") {
      await openJournal({ restoreScroll: true, focusElement: $("#journal-photo-recap") });
      return;
    }
    await openYear({ restoreScroll: true, focusElement: $("#year-photo-recap") });
  }

  async function openJournalFromCapture() {
    const returnIdeaId = state.pendingIdeaId;
    const hasDraft = captureDraft.hasCaptureDraft({
      photoReady: state.photoReady,
      recordingActive: Boolean(state.activeAdapter || state.activeTranscript),
      dishName: dishName.value,
      transcript: transcript.value,
      rating: rating.value,
      notes: notes.value,
      ingredients: ingredients.value,
      liveTranscript: liveTranscript.textContent,
    });
    if (hasDraft && !window.confirm("Leave this unsaved cook? Your photo and details will be discarded.")) return;
    if (hasDraft) {
      await captureDraft.discardActiveVoice(state);
      resetCapture({ scenario: "blank" });
    }
    if (returnIdeaId) {
      state.pendingIdeaId = "";
      await openIdeaDetail(returnIdeaId);
    }
    else await openJournal();
  }

  async function openCook(id, options = {}) {
    const cook = await archive.getCook(id);
    if (!cook) {
      journalError.textContent = "That cook is no longer available.";
      journalError.hidden = false;
      showScreen("journal");
      return;
    }
    const occasion = await archive.getOccasion(cook.occasionId);
    if (!occasion) throw new Error("That cooking occasion is no longer available.");
    clearArchiveObjectUrls();
    const activeScreen = $(".app-screen.is-active")?.dataset.screen;
    const returnScreen = options.returnTo || (["journal", "recap", "year"].includes(activeScreen) ? activeScreen : state.entryReturnScreen || "journal");
    if (returnScreen === "journal") state.journalScrollTop = journalScroll.scrollTop;
    if (returnScreen === "recap") state.recapScrollTop = recapScroll.scrollTop;
    if (returnScreen === "year") state.yearScrollTop = yearScroll.scrollTop;
    state.entryReturnScreen = returnScreen;
    state.entryReturnCookId = occasion.id;
    $("#entry-back-label").textContent = returnScreen === "recap" ? "Photo recap" : returnScreen === "year" ? "Year" : "Journal";
    state.currentCookId = cook.id;
    state.currentAttemptId = cook.id;
    state.currentOccasionId = occasion.id;
    const selectedPhoto = occasion.photos.find((photo) => photo.id === options.selectedPhotoId) || occasion.mainPhoto;
    const photoUrl = photoUrlForBlob(selectedPhoto.blob);
    $("#entry-photo").src = photoUrl;
    $("#entry-photo").alt = `${occasion.dishNames.join(" and ")}${selectedPhoto.id === occasion.mainPhotoId ? ", main photograph" : ", photograph"}`;
    $("#entry-title").textContent = occasion.dishNames.join(" and ");
    $("#entry-date").textContent = formatCookedDate(occasion.cookedAt);
    entryPhotoGrid.replaceChildren();
    occasion.photos.forEach((photo, index) => {
      const button = document.createElement("button");
      const image = document.createElement("img");
      const assigned = occasion.attempts.find((attempt) => attempt.id === photo.dishAttemptId);
      button.type = "button";
      button.className = "occasion-photo-tile";
      button.dataset.photoId = photo.id;
      button.setAttribute("aria-label", `${assigned?.dishName || occasion.dishNames.join(" and ")} photo${photo.id === occasion.mainPhotoId ? ", main photo" : ""}`);
      image.src = photoUrlForBlob(photo.thumbnailBlob || photo.blob);
      image.alt = "";
      if (index > 3) image.loading = "lazy";
      const badge = document.createElement("span");
      badge.textContent = photo.id === occasion.mainPhotoId ? "Main" : assigned?.dishName || "Occasion";
      button.append(image, badge);
      button.addEventListener("click", () => openPhotoActions(photo.id, button));
      entryPhotoGrid.append(button);
    });
    entryDishList.replaceChildren();
    occasion.attempts.forEach((attempt) => {
      const section = document.createElement("article");
      const heading = document.createElement("h3");
      const meta = document.createElement("p");
      const notesCopy = document.createElement("p");
      const ingredientsCopy = document.createElement("p");
      const actions = document.createElement("div");
      const edit = document.createElement("button");
      const remove = document.createElement("button");
      section.className = "occasion-dish-card";
      section.dataset.attemptId = attempt.id;
      heading.textContent = attempt.dishName;
      meta.textContent = `${attempt.country || "No country added"} · ${Number.isInteger(attempt.rating) ? `${attempt.rating}/10` : "Not rated"}`;
      notesCopy.textContent = attempt.notes || "No notes yet.";
      ingredientsCopy.textContent = attempt.ingredients ? `Ingredients: ${attempt.ingredients}` : "No ingredients added.";
      actions.className = "occasion-dish-actions";
      edit.type = "button"; edit.className = "button button-secondary"; edit.textContent = "Edit dish";
      edit.addEventListener("click", () => { state.currentCookId = attempt.id; state.currentAttemptId = attempt.id; void openEditCook(); });
      remove.type = "button"; remove.className = "text-button danger-text"; remove.textContent = "Remove dish"; remove.disabled = occasion.attempts.length <= 1;
      remove.addEventListener("click", async () => {
        if (!window.confirm(`Remove ${attempt.dishName} from this occasion? Its non-main assigned photos will also be removed.`)) return;
        try { await archive.removeDishAttempt(occasion.id, attempt.id); await openCook(occasion.id, { returnTo: state.entryReturnScreen, status: `${attempt.dishName} removed.` }); }
        catch (error) { entryStatus.textContent = error.message; entryStatus.hidden = false; }
      });
      actions.append(edit, remove);
      section.append(heading, meta, notesCopy, ingredientsCopy, actions);
      entryDishList.append(section);
    });
    entryStatus.textContent = options.status || "";
    entryStatus.hidden = !options.status;
    showScreen("entry");
  }

  async function openPhotoActions(photoId, trigger) {
    const occasion = await archive.getOccasion(state.currentOccasionId);
    const photo = occasion?.photos.find((candidate) => candidate.id === photoId);
    if (!photo) return;
    state.selectedEntryPhotoId = photoId;
    state.photoActionReturnFocus = trigger;
    $("#photo-actions-preview").src = trigger.querySelector("img").src;
    $("#photo-actions-preview").alt = `${occasion.dishNames.join(" and ")} photograph`;
    const assignment = $("#photo-dish-assignment");
    assignment.replaceChildren(new Option("The whole occasion", ""), ...occasion.attempts.map((attempt) => new Option(attempt.dishName, attempt.id)));
    assignment.value = photo.dishAttemptId || "";
    $("#make-main-photo").disabled = photo.id === occasion.mainPhotoId;
    $("#delete-entry-photo").disabled = photo.id === occasion.mainPhotoId;
    $("#photo-actions-message").textContent = photo.id === occasion.mainPhotoId ? "Choose another main photo before deleting this one." : "";
    photoActionsDialog.showModal();
    window.requestAnimationFrame(() => assignment.focus());
  }

  function closePhotoActions() {
    photoActionsDialog.close();
    window.requestAnimationFrame(() => state.photoActionReturnFocus?.focus({ preventScroll: true }));
  }

  async function refreshEntry(status = "") {
    const returnTo = state.entryReturnScreen;
    await openCook(state.currentOccasionId, { returnTo, status });
  }

  async function handleEntryPhotos(event) {
    const files = [...(event.target.files || [])];
    event.target.value = "";
    if (!files.length || state.entryPhotoProcessing) return;
    state.entryPhotoProcessing = true;
    $("#add-entry-photos").disabled = true;
    $("#take-entry-photo").disabled = true;
    entryStatus.hidden = false;
    const processed = [];
    try {
      for (let index = 0; index < files.length; index += 1) {
        entryStatus.textContent = `Preparing photo ${index + 1} of ${files.length}…`;
        processed.push(photoProcessor?.processPhoto ? await photoProcessor.processPhoto(files[index]) : { blob: files[index] });
      }
      await archive.addPhotosToOccasion(state.currentOccasionId, processed);
      await refreshEntry(`${files.length} ${files.length === 1 ? "photo" : "photos"} added.`);
    } catch (error) {
      entryStatus.textContent = error.message || "The photographs could not be added. Nothing was changed.";
    } finally {
      state.entryPhotoProcessing = false;
      $("#add-entry-photos").disabled = false;
      $("#take-entry-photo").disabled = false;
    }
  }

  function openAddDish() {
    $("#add-dish-form").reset();
    $("#add-dish-error").hidden = true;
    showScreen("add-dish");
  }

  async function submitAddedDish(event) {
    event.preventDefault();
    const button = $("#save-added-dish");
    const input = { dishName: $("#add-dish-name").value.trim(), country: $("#add-dish-country").value.trim(), rating: $("#add-dish-rating").value, notes: $("#add-dish-notes").value.trim(), ingredients: $("#add-dish-ingredients").value.trim(), forceNewDish: $("#add-dish-force-new").checked };
    if (!input.dishName) { $("#add-dish-error").textContent = "Enter a dish name."; $("#add-dish-error").hidden = false; $("#add-dish-name").focus(); return; }
    button.disabled = true; button.setAttribute("aria-busy", "true");
    try {
      const photoFile = $("#add-dish-photo").files?.[0];
      if (photoFile) input.photo = photoProcessor?.processPhoto ? await photoProcessor.processPhoto(photoFile) : { blob: photoFile };
      await archive.addDishToOccasion(state.currentOccasionId, input);
      await refreshEntry(`${input.dishName} added.`);
    } catch (error) { $("#add-dish-error").textContent = error.message || "The dish could not be added."; $("#add-dish-error").hidden = false; }
    finally { button.disabled = false; button.removeAttribute("aria-busy"); }
  }

  async function returnFromCook() {
    if (state.entryReturnScreen === "recap") {
      await openRecap(state.recapOrigin, { preserveOrigin: true, restoreScroll: true, focusCookId: state.entryReturnCookId, focusPhotoId: state.entryReturnPhotoId });
      return;
    }
    if (state.entryReturnScreen === "year") {
      await openYear({ restoreScroll: true, focusCookId: state.entryReturnCookId });
      return;
    }
    await openJournal({ restoreScroll: true, focusCookId: state.entryReturnCookId });
  }

  function clearEditPhoto() {
    if (state.editObjectUrl) URL.revokeObjectURL(state.editObjectUrl);
    state.editObjectUrl = "";
    state.editPhotoBlob = null;
  }

  function cancelEditPhotoProcessing() {
    state.editPhotoRequestId += 1;
    state.editPhotoProcessing = false;
    $("#edit-save").disabled = false;
  }

  function setEditSaving(saving) {
    state.editSaving = saving;
    $("#cancel-edit").disabled = saving;
    $("#edit-camera-input").disabled = saving;
    $("#edit-library-input").disabled = saving;
  }

  function editValues() {
    return {
      dishName: editDish.value.trim(),
      cookedAt: editDate.value,
      country: editCountry.value.trim(),
      rating: editRating.value,
      notes: editNotes.value.trim(),
      ingredients: editIngredients.value.trim(),
    };
  }

  function hasEditChanges() {
    if (!state.editOriginal) return false;
    const current = editValues();
    return Boolean(state.editPhotoBlob)
      || Object.keys(current).some((key) => current[key] !== state.editOriginal[key]);
  }

  async function openEditCook() {
    const cook = await archive.getCook(state.currentCookId);
    if (!cook) {
      await openJournal();
      journalError.textContent = "That cook is no longer available.";
      journalError.hidden = false;
      return;
    }
    cancelEditPhotoProcessing();
    setEditSaving(false);
    clearEditPhoto();
    state.editOriginal = {
      dishName: cook.dishName,
      cookedAt: cook.cookedAt,
      country: cook.country || "",
      rating: cook.rating ? String(cook.rating) : "",
      notes: cook.notes || "",
      ingredients: cook.ingredients || "",
    };
    editDish.value = state.editOriginal.dishName;
    editDate.value = state.editOriginal.cookedAt;
    editCountry.value = state.editOriginal.country;
    editRating.value = state.editOriginal.rating;
    editNotes.value = state.editOriginal.notes;
    editIngredients.value = state.editOriginal.ingredients;
    $("#edit-photo").src = $("#entry-photo").src;
    $("#edit-photo").alt = `${cook.dishName}, current photo`;
    $("#edit-dish-error").hidden = true;
    editDish.removeAttribute("aria-invalid");
    editError.hidden = true;
    editPhotoError.hidden = true;
    editPhotoError.classList.remove("is-error");
    editForm.scrollTop = 0;
    showScreen("edit");
  }

  async function handleEditPhoto(event) {
    if (state.editSaving) return;
    const file = event.target.files?.[0];
    if (!file) return;
    const requestId = ++state.editPhotoRequestId;
    if (!file.type.startsWith("image/")) {
      state.editPhotoProcessing = false;
      $("#edit-save").disabled = false;
      editPhotoError.textContent = "Choose an image from the camera or photo library.";
      editPhotoError.classList.add("is-error");
      editPhotoError.hidden = false;
      event.target.value = "";
      return;
    }
    state.editPhotoProcessing = true;
    $("#edit-save").disabled = true;
    editPhotoError.textContent = "Preparing your replacement photo on this device…";
    editPhotoError.classList.remove("is-error");
    editPhotoError.hidden = false;
    try {
      const processed = photoProcessor?.processPhoto ? await photoProcessor.processPhoto(file) : { blob: file };
      if (requestId !== state.editPhotoRequestId) return;
      clearEditPhoto();
      state.editPhotoBlob = processed.blob;
      state.editObjectUrl = URL.createObjectURL(processed.blob);
      $("#edit-photo").src = state.editObjectUrl;
      $("#edit-photo").alt = `${editDish.value.trim() || "Cook"}, replacement photo`;
      editPhotoError.hidden = true;
    } catch (error) {
      if (requestId !== state.editPhotoRequestId) return;
      editPhotoError.textContent = error.message || "This photo could not be prepared. Try another image.";
      editPhotoError.classList.add("is-error");
    } finally {
      if (requestId === state.editPhotoRequestId) {
        state.editPhotoProcessing = false;
        $("#edit-save").disabled = false;
      }
      event.target.value = "";
    }
  }

  function cancelEdit() {
    if (state.editSaving) return;
    if (hasEditChanges() && !window.confirm("Discard your unsaved changes?")) return;
    cancelEditPhotoProcessing();
    clearEditPhoto();
    state.editOriginal = null;
    showScreen("entry");
  }

  async function submitEdit(event) {
    event.preventDefault();
    if (state.editPhotoProcessing) {
      editPhotoError.textContent = "Wait for the replacement photo to finish preparing.";
      editPhotoError.classList.remove("is-error");
      editPhotoError.hidden = false;
      return;
    }
    const values = editValues();
    if (!values.dishName) {
      editDish.setAttribute("aria-invalid", "true");
      $("#edit-dish-error").hidden = false;
      editDish.focus();
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(values.cookedAt)) {
      editError.textContent = "Choose a valid cooked date.";
      editError.hidden = false;
      editDate.focus();
      return;
    }
    if (values.rating && (!Number.isInteger(Number(values.rating)) || Number(values.rating) < 1 || Number(values.rating) > 10)) {
      editError.textContent = "Rating must be a whole number from 1 through 10.";
      editError.hidden = false;
      editRating.focus();
      return;
    }

    const saveButton = $("#edit-save");
    setEditSaving(true);
    saveButton.disabled = true;
    saveButton.setAttribute("aria-busy", "true");
    saveButton.textContent = "Saving changes…";
    editError.hidden = true;
    let saved = false;
    try {
      await archive.updateCook(state.currentCookId, {
        ...values,
        ...(state.editPhotoBlob ? { photoBlob: state.editPhotoBlob } : {}),
      });
      saved = true;
    } catch (error) {
      editError.textContent = error.message || "Your changes could not be saved. Nothing was lost.";
      editError.hidden = false;
    } finally {
      setEditSaving(false);
      saveButton.disabled = state.editPhotoProcessing;
      saveButton.removeAttribute("aria-busy");
      saveButton.textContent = "Save changes";
    }
    if (!saved) return;

    const cookId = state.currentCookId;
    clearEditPhoto();
    state.editOriginal = null;
    try {
      await openCook(cookId, { status: "Changes saved." });
    } catch (error) {
      editError.textContent = "Changes were saved, but this cook could not be reopened. Return to Journal and try again.";
      editError.hidden = false;
    }
  }

  async function submitCapture(event) {
    event.preventDefault();
    beginTiming();
    captureError.hidden = true;

    if (!state.photoReady) {
      captureError.textContent = "Add a main photo to continue.";
      captureError.hidden = false;
      photoPicker.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    reviewButton.disabled = true;
    reviewButton.setAttribute("aria-busy", "true");
    reviewButton.firstChild.textContent = state.simulateFailure ? "Keeping draft…" : "Preparing…";

    try {
      if (!state.simulateFailure && transcript.value.trim() && transcript.value !== state.lastAssistanceAttemptedTranscript) {
        await organizeCaptureText({ existingText: transcript.value, voiceSegment: "", appendVoice: false });
      }
      if (!dishName.value.trim()) {
        dishName.setAttribute("aria-invalid", "true");
        dishError.hidden = false;
        dishError.textContent = "Smart assistance could not identify a dish. Enter the dish name to continue.";
        dishName.focus();
        return;
      }
      await updateConfirmation();
      showScreen("confirm");
    } catch (error) {
      captureError.textContent = error.message || "Your cook could not be prepared. Your draft is still here.";
      captureError.hidden = false;
    } finally {
      reviewButton.removeAttribute("aria-busy");
      reviewButton.textContent = "Review cook";
      updateReadyState();
    }
  }

  function clearConfirmationDishes() {
    state.confirmationDishes.forEach((dish) => { if (dish.objectUrl) URL.revokeObjectURL(dish.objectUrl); });
    state.confirmationDishes = [];
    $("#additional-dishes").replaceChildren();
  }

  function addConfirmationDish(initial = {}, options = {}) {
    const record = {
      id: crypto.randomUUID?.() || `dish-${Date.now()}`,
      processed: options.processed || null,
      objectUrl: "",
      matchedDishId: options.matchedDishId || "",
      forceNewDish: options.forceNewDish ?? !options.matchedDishId,
      fromAssistance: Boolean(options.fromAssistance),
    };
    const card = document.createElement("fieldset");
    const legend = document.createElement("legend");
    const remove = document.createElement("button");
    const initialCountry = initial.country ? { auto: initial.country, optional: null, provenance: "" } : countryFromSuggestion(initial);
    const accepted = record.fromAssistance ? captureAssistance?.acceptedDishFields?.(initial) || {} : initial;
    const confident = (key) => !record.fromAssistance || accepted[key] !== null && accepted[key] !== undefined;
    card.className = "additional-dish-card";
    card.dataset.draftDishId = record.id;
    legend.textContent = `Additional dish ${state.confirmationDishes.length + 1}`;
    remove.type = "button"; remove.className = "text-button danger-text additional-dish-remove"; remove.textContent = "Remove";
    card.append(legend, remove);
    const fields = [
      ["name", "Dish name", "input", true], ["country", "Country", "input", false], ["rating", "Rating out of 10", "input", false],
      ["notes", "Notes", "textarea", false], ["ingredients", "Ingredients", "textarea", false],
    ];
    fields.forEach(([key, labelText, tag, required]) => {
      const group = document.createElement("div"); const label = document.createElement("label"); const control = document.createElement(tag);
      const id = `confirm-extra-${record.id}-${key}`;
      group.className = "field-group"; label.htmlFor = id; label.textContent = `${labelText}${required ? " · Required" : " · Optional"}`;
      if (record.fromAssistance && key === "country" && initialCountry.auto) {
        label.textContent += initialCountry.provenance === "from-note" ? " · From your note" : " · Suggested";
      } else if (record.fromAssistance && key !== "country") {
        const confidenceKey = key === "name" ? "dishName" : key === "ingredients" ? "ingredientsText" : key;
        if (initial[key === "name" ? "dishName" : key === "ingredients" ? "ingredientsText" : key] != null && confident(confidenceKey)) {
          label.textContent += " · From your note";
        }
      }
      control.id = id; control.dataset.field = key;
      if (key === "rating") { control.type = "number"; control.min = "1"; control.max = "10"; control.inputMode = "numeric"; }
      if (tag === "textarea") control.rows = 2;
      if (required) control.required = true;
      group.append(label, control); card.append(group);
    });
    const countryAction = document.createElement("button");
    countryAction.type = "button"; countryAction.className = "inline-button country-suggestion-action";
    countryAction.hidden = !initialCountry.optional;
    if (initialCountry.optional) {
      countryAction.textContent = `Use ${initialCountry.optional.name}`;
      countryAction.setAttribute("aria-label", `Use suggested country ${initialCountry.optional.name} for additional dish ${state.confirmationDishes.length + 1}`);
    }
    card.append(countryAction);
    const matchGroup = document.createElement("fieldset"); matchGroup.className = "match-group additional-match-group"; card.append(matchGroup);
    const photoLabel = document.createElement("label"); const photoInput = document.createElement("input"); const photoStatus = document.createElement("span");
    photoLabel.className = "button button-secondary file-button"; photoLabel.textContent = "Add dish photo";
    photoInput.type = "file"; photoInput.accept = "image/*"; photoStatus.className = "field-helper"; photoStatus.textContent = "Optional";
    photoLabel.append(photoInput); card.append(photoLabel, photoStatus);
    remove.addEventListener("click", () => {
      if ([...card.querySelectorAll("input, textarea")].some((control) => control.value) && !window.confirm("Remove this unsaved dish?")) return;
      if (record.objectUrl) URL.revokeObjectURL(record.objectUrl);
      state.confirmationDishes = state.confirmationDishes.filter((dish) => dish !== record);
      card.remove();
    });
    photoInput.addEventListener("change", async () => {
      const file = photoInput.files?.[0]; if (!file) return;
      photoStatus.textContent = "Preparing photo…";
      try {
        record.processed = photoProcessor?.processPhoto ? await photoProcessor.processPhoto(file) : { blob: file };
        photoStatus.textContent = "Dish photo ready.";
      } catch (error) { record.processed = null; photoStatus.textContent = error.message || "This photo could not be prepared."; }
      photoInput.value = "";
    });
    record.element = card;
    state.confirmationDishes.push(record);
    $("#additional-dishes").append(card);
    record.element.querySelector('[data-field="name"]').value = confident("dishName") ? initial.dishName || "" : "";
    record.element.querySelector('[data-field="country"]').value = initialCountry.auto || "";
    record.element.querySelector('[data-field="rating"]').value = confident("rating") ? initial.rating || "" : "";
    record.element.querySelector('[data-field="notes"]').value = confident("notes") ? initial.notes || "" : "";
    record.element.querySelector('[data-field="ingredients"]').value = confident("ingredientsText") ? initial.ingredientsText || initial.ingredients || "" : "";
    renderDishMatches(matchGroup, {
      dishName: record.element.querySelector('[data-field="name"]').value, country: initialCountry.auto || "", groupName: `dishMatch-${record.id}`,
      onSelect: (id, forceNew) => { record.matchedDishId = id; record.forceNewDish = forceNew; },
    });
    if (options.matchedDishId) {
      const selected = [...matchGroup.querySelectorAll('input[type="radio"]')].find((input) => input.value === options.matchedDishId);
      if (selected) { selected.checked = true; record.matchedDishId = options.matchedDishId; record.forceNewDish = false; }
    } else if (options.forceNewDish) {
      const selected = [...matchGroup.querySelectorAll('input[type="radio"]')].find((input) => input.value === "new");
      if (selected) { selected.checked = true; record.matchedDishId = ""; record.forceNewDish = true; }
    }
    countryAction.addEventListener("click", () => {
      const control = record.element.querySelector('[data-field="country"]');
      control.value = initialCountry.optional?.name || "";
      countryAction.hidden = true;
      refreshMatch();
      control.focus();
    });
    const refreshMatch = () => renderDishMatches(matchGroup, {
      dishName: record.element.querySelector('[data-field="name"]').value.trim(),
      country: record.element.querySelector('[data-field="country"]').value.trim(), groupName: `dishMatch-${record.id}`,
      onSelect: (id, forceNew) => { record.matchedDishId = id; record.forceNewDish = forceNew; },
    });
    record.element.querySelector('[data-field="name"]').addEventListener("change", refreshMatch);
    record.element.querySelector('[data-field="country"]').addEventListener("change", refreshMatch);
    if (record.processed) photoStatus.textContent = "Dish photo ready.";
    record.initialValues = confirmationDishValuesForRecord(record);
    if (options.focus !== false) card.querySelector("input")?.focus();
    return record;
  }

  function confirmationDishValuesForRecord(record) {
    return {
      dishName: record.element.querySelector('[data-field="name"]').value.trim(),
      country: record.element.querySelector('[data-field="country"]').value.trim(),
      rating: record.element.querySelector('[data-field="rating"]').value,
      notes: record.element.querySelector('[data-field="notes"]').value.trim(),
      ingredients: record.element.querySelector('[data-field="ingredients"]').value.trim(),
      matchedDishId: record.matchedDishId || null,
      forceNewDish: record.forceNewDish,
      processed: record.processed,
    };
  }

  function confirmationDishValues() {
    return state.confirmationDishes.map(confirmationDishValuesForRecord);
  }

  function captureConfirmationSnapshot() {
    return {
      baseline: { ...(state.confirmationBaseline || {}) },
      primary: {
        dishName: $("#confirm-dish").value,
        cookedAt: $("#confirm-date").value,
        country: $("#confirm-country").value,
        rating: $("#confirm-rating").value,
        notes: $("#confirm-notes").value,
        ingredients: $("#confirm-ingredients").value,
        matchedDishId: state.primaryMatchedDishId,
        forceNewDish: state.primaryForceNewDish,
      },
      extras: state.confirmationDishes.map((record) => ({ ...confirmationDishValuesForRecord(record), fromAssistance: record.fromAssistance })),
    };
  }

  function restoreConfirmationSnapshot(snapshot) {
    const controls = {
      dishName: $("#confirm-dish"), cookedAt: $("#confirm-date"), country: $("#confirm-country"),
      rating: $("#confirm-rating"), notes: $("#confirm-notes"), ingredients: $("#confirm-ingredients"),
    };
    Object.entries(controls).forEach(([key, control]) => {
      if (snapshot.primary[key] !== snapshot.baseline[key]) control.value = snapshot.primary[key];
    });
    if (snapshot.extras.length) {
      clearConfirmationDishes();
      snapshot.extras.forEach((dish) => addConfirmationDish(dish, {
        focus: false, fromAssistance: false, processed: dish.processed, matchedDishId: dish.matchedDishId, forceNewDish: dish.forceNewDish,
      }));
    }
    renderDishMatches($("#match-group"), {
      dishName: $("#confirm-dish").value.trim(), country: $("#confirm-country").value.trim(), groupName: "dishMatch-primary",
      onSelect: (id, forceNew) => { state.primaryMatchedDishId = id; state.primaryForceNewDish = forceNew; },
    });
    if (snapshot.primary.matchedDishId) {
      const selected = [...$("#match-group").querySelectorAll('input[type="radio"]')].find((input) => input.value === snapshot.primary.matchedDishId);
      if (selected) { selected.checked = true; state.primaryMatchedDishId = snapshot.primary.matchedDishId; state.primaryForceNewDish = false; }
    } else if (snapshot.primary.forceNewDish) {
      const selected = [...$("#match-group").querySelectorAll('input[type="radio"]')].find((input) => input.value === "new");
      if (selected) { selected.checked = true; state.primaryMatchedDishId = ""; state.primaryForceNewDish = true; }
    }
  }

  async function submitConfirmation(event) {
    event.preventDefault();
    const confirmedName = $("#confirm-dish").value.trim();
    if (!confirmedName) {
      $("#confirm-dish").setAttribute("aria-invalid", "true");
      $("#confirm-dish").focus();
      return;
    }

    const saveButton = $("#save-button");
    saveButton.disabled = true;
    saveButton.setAttribute("aria-busy", "true");
    saveButton.firstChild.textContent = "Saving…";
    saveError.hidden = true;

    try {
      const photoBlob = await resolvePhotoBlob();
      const extraDishes = confirmationDishValues();
      const missing = extraDishes.find((dish) => !dish.dishName);
      if (missing) throw new Error("Enter a name for every additional dish or remove its section.");
      const dishes = [{ dishName: confirmedName, rating: $("#confirm-rating").value, notes: $("#confirm-notes").value, ingredients: $("#confirm-ingredients").value, country: $("#confirm-country").value, transcript: transcript.value, sourceIdeaId: state.pendingIdeaId, matchedDishId: state.primaryMatchedDishId || null, forceNewDish: state.primaryForceNewDish }, ...extraDishes];
      const photos = [{ blob: photoBlob, dishIndex: 0 }, ...extraDishes.flatMap((dish, index) => dish.processed ? [{ ...dish.processed, dishIndex: index + 1 }] : [])];
      state.currentOccasionId = await archive.saveOccasion({ cookedAt: $("#confirm-date").value, dishes, photos });
      state.currentCookId = state.currentOccasionId;
      const seconds = state.startedAt === null ? null : Math.max(1, Math.round((performance.now() - state.startedAt) / 1000));
      const confirmedRating = $("#confirm-rating").value || "—";
      const confirmedNotes = $("#confirm-notes").value.trim();

      $("#success-dish").textContent = dishes.map((dish) => dish.dishName).join(" and ");
      $("#success-verb").textContent = dishes.length === 1 ? " is" : " are";
      if (dishes.length > 1) $("#history-preview-title").textContent = `${dishes.length} dishes saved`;
      $("#success-photo").src = state.photoSrc;
      $("#success-photo").alt = `Saved ${confirmedName}`;
      $("#success-rating").textContent = confirmedRating;
      $("#success-note").textContent = confirmedNotes || "No notes yet. You can add them later.";
      $("#success-time").textContent = seconds === null
        ? "Capture completed."
        : `Capture completed in ${seconds} second${seconds === 1 ? "" : "s"}${seconds <= 20 ? " — within target." : "."}`;

      state.pendingIdeaId = "";

      showScreen("success");
    } catch (error) {
      saveError.textContent = error.message || "This cook could not be saved. Your draft is still here.";
      saveError.hidden = false;
    } finally {
      saveButton.disabled = false;
      saveButton.removeAttribute("aria-busy");
      saveButton.textContent = "Save cook";
    }
  }

  function resetCapture(options = {}) {
    state.assistanceController?.abort();
    state.assistanceController = null;
    state.assistanceBusy = false;
    state.assistanceRequestId += 1;
    const activeAdapter = state.activeAdapter;
    state.activeAdapter = null;
    state.activeTranscript = null;
    if (activeAdapter) void activeAdapter.cancel("Voice stopped");
    stopRecordingClock();
    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
    state.photoReady = false;
    state.photoSrc = "";
    state.photoBlob = null;
    state.objectUrl = "";
    state.startedAt = null;
    state.suggestedCountry = "";
    state.countrySuggestion = null;
    state.countryProvenance = "";
    state.confirmationBaseline = null;
    state.assistedDishes = [];
    state.assistanceWarnings = [];
    state.assistanceFailed = false;
    state.lastAssistedTranscript = "";
    state.lastAssistanceAttemptedTranscript = "";
    state.lastAssistanceInput = null;
    state.primaryMatchedDishId = "";
    state.primaryForceNewDish = true;
    state.matchingCooks = [];
    state.touchedFields = new Set();
    state.simulateFailure = Boolean(options.failure);
    state.scenario = options.scenario || "blank";
    state.pendingIdeaId = options.sourceIdeaId || "";
    clearConfirmationDishes();

    captureForm.reset();
    confirmForm.reset();
    liveTranscript.textContent = "";
    liveTranscriptShell.hidden = true;
    recordingStatus.textContent = "Ready";
    renderVoiceButton("idle");
    photoPreview.hidden = true;
    photoPreview.removeAttribute("src");
    photoEmpty.hidden = false;
    photoPicker.dataset.ready = "false";
    optionalFields.hidden = true;
    optionalToggle.setAttribute("aria-expanded", "false");
    captureError.hidden = true;
    assistProgress.hidden = true;
    assistRecovery.hidden = true;
    $("#retry-assistance").hidden = false;
    dishError.hidden = true;
    dishName.removeAttribute("aria-invalid");
    $("#open-journal").lastChild.textContent = " Journal";
    $("#capture-title").textContent = "What did you cook?";

    if (options.sample) {
      setPhoto(sample.photo, "Sample bowl of Oyakodon");
      applyParsedSample();
    } else if (options.failure) {
      setPhoto(sample.photo, "Sample bowl of Oyakodon");
      transcript.value = "I made Oyakodon, eight out of ten. The egg was better; use less soy next time.";
      dishName.value = sample.dishName;
      rating.value = sample.rating;
      notes.value = sample.notes;
      state.suggestedCountry = sample.country;
      revealOptionalFields();
      updateReadyState();
    } else {
      updateReadyState();
    }

    $$("[data-scenario]").forEach((button) => {
      const active = button.dataset.scenario === state.scenario;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    showScreen("capture");
  }

  function switchScenario(event) {
    const scenario = event.currentTarget.dataset.scenario;
    if (scenario === "assisted") resetCapture({ scenario, sample: true });
    else if (scenario === "failure") resetCapture({ scenario, failure: true });
    else resetCapture({ scenario: "blank" });
  }

  async function initializeApp() {
    renderWorldMaps();
    resetCapture({ scenario: "blank" });
    if (!archive?.listCooks) return;
    try {
      const [cooks, occasions] = await Promise.all([archive.listDishAttempts(), archive.listOccasions()]);
      if (cooks.length > 0) {
        renderYearFromCooks(cooks, occasions);
        showScreen("year");
      }
    } catch (error) {
      await openJournal();
    }
  }

  cameraInput.addEventListener("change", handleFile);
  libraryInput.addEventListener("change", handleFile);
  $("#edit-camera-input").addEventListener("change", handleEditPhoto);
  $("#edit-library-input").addEventListener("change", handleEditPhoto);
  $("#sample-photo").addEventListener("click", () => setPhoto(sample.photo, "Sample bowl of Oyakodon"));
  $("#sample-voice").addEventListener("click", applyParsedSample);
  micButton.addEventListener("click", toggleRecording);
  $("#save-owner-token").addEventListener("click", saveOwnerToken);
  $("#remove-owner-token").addEventListener("click", removeOwnerToken);
  optionalToggle.addEventListener("click", toggleOptionalFields);
  dishName.addEventListener("input", () => {
    beginTiming();
    state.touchedFields.add("dishName");
    updateReadyState();
  });
  transcript.addEventListener("input", () => {
    beginTiming();
    if (state.assistanceController) {
      state.assistanceController.abort();
      state.assistanceRequestId += 1;
      state.assistanceController = null;
      setAssistanceBusy(false);
      recordingStatus.textContent = "Note edited";
    }
    state.lastAssistedTranscript = "";
    state.lastAssistanceAttemptedTranscript = "";
    applyTranscriptSuggestions(transcript.value);
  });
  [rating, notes, ingredients].forEach((field) => {
    field.addEventListener("input", () => state.touchedFields.add(field.name));
  });
  captureForm.addEventListener("submit", submitCapture);
  confirmForm.addEventListener("submit", submitConfirmation);
  $("#back-to-capture").addEventListener("click", () => showScreen("capture"));
  $("#view-year").addEventListener("click", () => void openYear());
  $("#open-journal").addEventListener("click", () => void openJournalFromCapture());
  $("#back-to-journal").addEventListener("click", () => void returnFromCook());
  $("#edit-cook").addEventListener("click", () => void openEditCook());
  $("#cancel-edit").addEventListener("click", cancelEdit);
  editForm.addEventListener("submit", submitEdit);
  $("#new-cook").addEventListener("click", () => resetCapture({ scenario: "blank" }));
  $("#year-new-cook").addEventListener("click", () => resetCapture({ scenario: "blank" }));
  $("#map-new-cook").addEventListener("click", () => resetCapture({ scenario: "blank" }));
  $("#empty-new-cook").addEventListener("click", () => resetCapture({ scenario: "blank" }));
  $("#year-open-journal").addEventListener("click", () => void openJournal());
  $("#open-backup-storage").addEventListener("click", (event) => void openBackupStorage(event.currentTarget));
  $("#backup-back").addEventListener("click", closeBackupStorage);
  $("#protect-storage").addEventListener("click", () => void protectLocalStorage());
  $("#create-backup").addEventListener("click", () => void createPortableBackup());
  backupFileInput.addEventListener("change", (event) => void inspectSelectedBackup(event));
  $("#choose-another-backup").addEventListener("click", () => {
    state.backupInspection = null;
    restorePreview.hidden = true;
    backupFileInput.click();
  });
  confirmRestoreButton.addEventListener("click", () => void restoreSelectedBackup());
  $("#view-restored-archive").addEventListener("click", () => window.location.reload());
  $("#open-erase-dialog").addEventListener("click", openEraseArchiveDialog);
  $("#cancel-erase").addEventListener("click", closeEraseArchiveDialog);
  eraseConfirmation.addEventListener("input", () => {
    $("#confirm-erase").disabled = eraseConfirmation.value.trim() !== "ERASE";
    $("#erase-error").hidden = true;
    eraseConfirmation.removeAttribute("aria-invalid");
  });
  $("#erase-form").addEventListener("submit", (event) => void eraseLocalArchive(event));
  eraseDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeEraseArchiveDialog();
  });
  eraseDialog.addEventListener("close", () => {
    if (!state.eraseCompleted) window.requestAnimationFrame(() => $("#open-erase-dialog").focus());
    state.eraseCompleted = false;
  });
  $("#open-map-preview").addEventListener("click", () => void openMap());
  $("#year-map-preview").addEventListener("click", () => void openMap());
  $("#year-photo-recap").addEventListener("click", () => {
    state.yearScrollTop = yearScroll.scrollTop;
    void openRecap("year");
  });
  $("#add-confirm-dish").addEventListener("click", () => addConfirmationDish());
  $("#retry-assistance").addEventListener("click", () => {
    if (state.lastAssistanceInput) void organizeCaptureText({ ...state.lastAssistanceInput, retry: true });
  });
  $("#retry-assistance-confirm").addEventListener("click", async () => {
    if (!state.lastAssistanceInput) return;
    const button = $("#retry-assistance-confirm");
    const snapshot = captureConfirmationSnapshot();
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    try {
      await organizeCaptureText({ ...state.lastAssistanceInput, retry: true });
      await updateConfirmation();
      restoreConfirmationSnapshot(snapshot);
    } finally {
      button.disabled = false;
      button.removeAttribute("aria-busy");
    }
  });
  $("#country-suggestion-action").addEventListener("click", () => {
    if (!state.countrySuggestion?.name) return;
    $("#confirm-country").value = state.countrySuggestion.name;
    state.suggestedCountry = state.countrySuggestion.name;
    state.countryProvenance = "suggested";
    state.countrySuggestion = null;
    renderCountrySuggestion();
    renderDishMatches($("#match-group"), { dishName: $("#confirm-dish").value.trim(), country: $("#confirm-country").value.trim(), groupName: "dishMatch-primary", onSelect: (id, forceNew) => { state.primaryMatchedDishId = id; state.primaryForceNewDish = forceNew; } });
  });
  [$("#confirm-dish"), $("#confirm-country")].forEach((field) => field.addEventListener("change", () => {
    renderDishMatches($("#match-group"), { dishName: $("#confirm-dish").value.trim(), country: $("#confirm-country").value.trim(), groupName: "dishMatch-primary", onSelect: (id, forceNew) => { state.primaryMatchedDishId = id; state.primaryForceNewDish = forceNew; } });
  }));
  $("#confirm-country").addEventListener("input", () => {
    state.countryProvenance = "";
    state.countrySuggestion = null;
    $("#country-suggestion").hidden = true;
    renderCountrySuggestion();
  });
  $("#add-entry-dish").addEventListener("click", openAddDish);
  $("#cancel-add-dish").addEventListener("click", () => showScreen("entry"));
  $("#add-dish-form").addEventListener("submit", submitAddedDish);
  $("#add-entry-photos").addEventListener("click", () => $("#entry-photo-input").click());
  $("#take-entry-photo").addEventListener("click", () => $("#entry-camera-input").click());
  $("#entry-photo-input").addEventListener("change", handleEntryPhotos);
  $("#entry-camera-input").addEventListener("change", handleEntryPhotos);
  $("#close-photo-actions").addEventListener("click", closePhotoActions);
  photoActionsDialog.addEventListener("cancel", (event) => { event.preventDefault(); closePhotoActions(); });
  $("#photo-dish-assignment").addEventListener("change", async (event) => {
    try { await archive.updatePhoto(state.currentOccasionId, state.selectedEntryPhotoId, { dishAttemptId: event.target.value || null }); closePhotoActions(); await refreshEntry("Photo assignment updated."); }
    catch (error) { $("#photo-actions-message").textContent = error.message; }
  });
  $("#make-main-photo").addEventListener("click", async () => {
    try { await archive.updatePhoto(state.currentOccasionId, state.selectedEntryPhotoId, { makeMain: true }); closePhotoActions(); await refreshEntry("Main photo updated."); }
    catch (error) { $("#photo-actions-message").textContent = error.message; }
  });
  $("#delete-entry-photo").addEventListener("click", async () => {
    if (!window.confirm("Delete this photograph?")) return;
    try { await archive.deletePhoto(state.currentOccasionId, state.selectedEntryPhotoId); closePhotoActions(); await refreshEntry("Photo deleted."); }
    catch (error) { $("#photo-actions-message").textContent = error.message; }
  });
  $("#journal-photo-recap").addEventListener("click", () => {
    state.journalScrollTop = journalScroll.scrollTop;
    void openRecap("journal");
  });
  $("#back-from-recap").addEventListener("click", () => void backFromRecap());
  $("#recap-year").addEventListener("change", (event) => {
    state.recapYear = Number(event.target.value);
    state.recapScrollTop = 0;
    void renderRecap({ restoreScroll: false });
  });
  journalSearch.addEventListener("input", (event) => {
    state.journalQuery = event.target.value;
    state.journalScrollTop = 0;
    window.clearTimeout(journalSearchTimer);
    journalSearchTimer = window.setTimeout(() => void renderJournal({ restoreScroll: false }), 180);
  });
  $("#open-journal-filters").addEventListener("click", (event) => openJournalFilters(event.currentTarget));
  $("#close-journal-filters").addEventListener("click", () => closeJournalFilters());
  journalFilterDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeJournalFilters();
  });
  $("#journal-filter-form").addEventListener("submit", (event) => {
    event.preventDefault();
    applyJournalFiltersFromSheet();
  });
  journalYearFilter.addEventListener("change", () => {
    journalMonthFilter.disabled = !journalYearFilter.value;
    if (!journalYearFilter.value) journalMonthFilter.value = "";
  });
  $("#reset-filter-sheet").addEventListener("click", () => renderJournalFilterOptions(state.journalOptions, { country: "all", year: "", month: "", rating: "any" }));
  $("#clear-journal-filters").addEventListener("click", () => {
    resetJournalFilters();
    void renderJournal({ restoreScroll: false });
  });
  $("#reset-journal-results").addEventListener("click", () => {
    resetJournalFilters({ includeSearch: true });
    void renderJournal({ restoreScroll: false }).then(() => journalSearch.focus({ preventScroll: true }));
  });
  $("#map-back").addEventListener("click", () => {
    if (state.mapNavigation.level === "country" || state.mapNavigation.level === "nearby") closeCountrySheet();
    else if (state.mapNavigation.level === "country-detail") {
      openMapRegion(state.mapNavigation.regionId);
      window.requestAnimationFrame(() => { countryShelf.scrollLeft = state.mapRegionShelfScroll; });
    } else {
      renderWorldMapLevel();
      window.requestAnimationFrame(() => $("#map-title").focus({ preventScroll: true }));
    }
  });
  $("#close-country-sheet").addEventListener("click", () => closeCountrySheet());
  $("#country-sheet-scrim").addEventListener("click", () => closeCountrySheet());
  countrySheet.addEventListener("keydown", trapCountrySheetFocus);
  $("#back-to-map-country").addEventListener("click", () => {
    const returnState = state.dishReturnMapState || { level: "region", regionId: "", countryKey: state.dishReturnCountryKey };
    showScreen("map");
    if (returnState.level === "world") renderWorldMapLevel();
    else if (returnState.regionId) {
      state.mapRegionShelfScroll = returnState.regionShelfScroll ?? 0;
      openMapRegion(returnState.regionId);
      if (returnState.level === "country-detail") {
        openCountryDetail(returnState.countryKey);
        countryShelf.scrollLeft = returnState.detailShelfScroll ?? 0;
      }
      else if (returnState.level === "country") {
        if (returnState.sheetReturnState?.level === "country-detail") {
          openCountryDetail(returnState.sheetReturnState.countryKey);
          countryShelf.scrollLeft = returnState.detailShelfScroll ?? 0;
        }
        openCountrySheet(returnState.countryKey, countryShelf.querySelector(`[data-country-key="${returnState.countryKey}"]`));
      }
      else if (returnState.level === "nearby") {
        const dishes = state.dashboardModel.mappedDishes.filter((dish) => returnState.dishIds?.includes(dish.dishId));
        const region = state.dashboardModel.regions.find((candidate) => candidate.id === returnState.regionId);
        openNearbySheet(dishes, region);
      }
      window.requestAnimationFrame(() => {
        const focusRoot = returnState.focusSurface === "sheet"
          ? countryDishGrid
          : returnState.focusSurface === "shelf" ? countryShelf : fullMapCells;
        focusRoot.querySelector(`[data-dish-id="${CSS.escape(returnState.focusDishId || "")}"]`)?.focus({ preventScroll: true });
      });
    }
    state.dishReturnFocusElement = null;
    state.dishReturnMapState = null;
  });
  $("#map-mode-photo").addEventListener("click", () => setMapMode("photo"));
  $("#map-mode-needle").addEventListener("click", () => setMapMode("needle"));
  $("#customize-map").addEventListener("click", (event) => void openMapCustomize(event.currentTarget));
  $("#close-map-customize").addEventListener("click", () => closeMapCustomize());
  $("#cancel-map-customize").addEventListener("click", () => closeMapCustomize());
  mapCustomizeDialog.addEventListener("cancel", (event) => { event.preventDefault(); closeMapCustomize(); });
  $("#map-customize-form").addEventListener("submit", saveMapCustomize);
  mapLocationStage.addEventListener("click", (event) => {
    if (event.target.closest("#map-editor-marker")) return;
    const position = editorEventPosition(event);
    updateMapCustomizePosition(position.x, position.y);
  });
  let draggingMapMarker = false;
  mapEditorMarker.addEventListener("pointerdown", (event) => {
    draggingMapMarker = true;
    mapEditorMarker.setPointerCapture(event.pointerId);
  });
  mapEditorMarker.addEventListener("pointermove", (event) => {
    if (!draggingMapMarker) return;
    const position = editorEventPosition(event);
    updateMapCustomizePosition(position.x, position.y, { silent: true });
  });
  mapEditorMarker.addEventListener("pointerup", (event) => {
    draggingMapMarker = false;
    if (mapEditorMarker.hasPointerCapture(event.pointerId)) mapEditorMarker.releasePointerCapture(event.pointerId);
  });
  $$('[data-map-nudge]').forEach((button) => button.addEventListener("click", () => {
    const draft = state.mapCustomize;
    if (!draft) return;
    const current = draft.mapLocation || mapGeometry.countryGeometry(draft.countryKey).anchor;
    const step = 0.12;
    const deltas = { up: [0, -step], down: [0, step], left: [-step, 0], right: [step, 0] };
    const delta = deltas[button.dataset.mapNudge];
    updateMapCustomizePosition(current.x + delta[0], current.y + delta[1]);
  }));
  $("#reset-map-location").addEventListener("click", () => {
    const draft = state.mapCustomize;
    if (!draft) return;
    draft.mapLocation = null; draft.dirty = true;
    positionEditorMarker(mapGeometry.countryGeometry(draft.countryKey).anchor);
    $("#map-customize-error").hidden = true;
  });
  let mapResizeTimer = null;
  window.addEventListener("resize", () => {
    window.clearTimeout(mapResizeTimer);
    mapResizeTimer = window.setTimeout(() => {
      if (state.mapNavigation.level === "region") {
        const region = state.dashboardModel?.regions.find((candidate) => candidate.id === state.mapNavigation.regionId);
        if (region) renderRegionDishes(region);
      } else if (state.mapNavigation.level === "country-detail") {
        const country = countryForKey(state.mapNavigation.countryKey);
        if (country) renderCountryDetailMarkers(country);
      }
    }, 120);
  });
  $("#add-idea").addEventListener("click", () => void openIdeaAdd());
  $("#empty-add-idea").addEventListener("click", () => void openIdeaAdd());
  $$('[data-back-to-ideas]').forEach((button) => button.addEventListener("click", () => void openIdeas()));
  $("#idea-link-tab").addEventListener("click", () => setIdeaPath("link"));
  $("#idea-describe-tab").addEventListener("click", () => setIdeaPath("describe"));
  $(".idea-paths").addEventListener("keydown", (event) => {
    const tabs = [$("#idea-link-tab"), $("#idea-describe-tab")];
    const current = tabs.indexOf(document.activeElement);
    if (current < 0 || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    setIdeaPath(next === 0 ? "link" : "describe", { focusPanel: false });
    tabs[next].focus();
  });
  $("#idea-link-panel").addEventListener("submit", submitIdeaUrl);
  $("#idea-describe-panel").addEventListener("submit", submitIdeaDescription);
  $("#back-to-idea-add").addEventListener("click", () => { showScreen("idea-add"); $("#idea-description").focus(); });
  $("#idea-add-manually").addEventListener("click", () => void openIdeaReview({ sourceKind: "manual", ingredients: [], instructions: [] }, { mode: "new" }));
  $("#manual-idea-from-results").addEventListener("click", () => void openIdeaReview({ title: state.ideaSearchDescription, sourceKind: "manual", ingredients: [], instructions: [] }, { mode: "new" }));
  $("#generate-idea").addEventListener("click", () => void generateIdeaDraft());
  $("#idea-photo-input").addEventListener("change", handleIdeaPhoto);
  $("#idea-review-form").addEventListener("submit", submitIdeaReview);
  $("#cancel-idea-review").addEventListener("click", () => void cancelIdeaReview());
  $("#idea-detail-back").addEventListener("click", () => void openIdeas());
  $("#edit-idea").addEventListener("click", async () => {
    const idea = await ideas.getIdea(state.currentIdeaId);
    if (idea) await openIdeaReview(idea, { mode: "edit" });
  });
  $("#refresh-idea").addEventListener("click", async () => {
    const idea = await ideas.getIdea(state.currentIdeaId);
    const message = $("#idea-detail-message");
    if (!idea?.sourceUrl) return;
    message.textContent = "Checking the source…";
    message.hidden = false;
    try { await importIdeaUrl(idea.sourceUrl, { refreshId: idea.id }); }
    catch (caught) { message.textContent = caught.message || "The source could not be refreshed. Your saved copy is unchanged."; }
  });
  $("#delete-idea").addEventListener("click", async () => {
    const idea = await ideas.getIdea(state.currentIdeaId);
    if (!idea || !window.confirm(`Delete ${idea.title}? Your cooked history will stay intact.`)) return;
    await ideas.deleteIdea(idea.id);
    state.currentIdeaId = "";
    await openIdeas({ restoreScroll: false });
  });
  $("#start-idea-cook").addEventListener("click", () => void startCookFromIdea());
  let ideaSearchTimer = null;
  $("#ideas-search").addEventListener("input", (event) => {
    state.ideaQuery = event.target.value;
    window.clearTimeout(ideaSearchTimer);
    ideaSearchTimer = window.setTimeout(() => void renderIdeas(), 180);
  });
  $$('[data-idea-filter]').forEach((button) => button.addEventListener("click", () => {
    state.ideaFilter = button.dataset.ideaFilter;
    $$('[data-idea-filter]').forEach((candidate) => candidate.setAttribute("aria-pressed", String(candidate === button)));
    void renderIdeas();
  }));
  let ideaDraftTimer = null;
  $("#idea-review-form").addEventListener("input", () => {
    window.clearTimeout(ideaDraftTimer);
    ideaDraftTimer = window.setTimeout(() => ideas.saveDraft({ recipe: ideaDraftFromForm(), mode: state.ideaReviewMode }).catch(() => {}), 250);
  });
  $$('[data-nav]').forEach((button) => button.addEventListener("click", () => {
    if (button.dataset.nav === "year") void openYear();
    else if (button.dataset.nav === "map") void openMap();
    else if (button.dataset.nav === "journal") void openJournal();
    else void openIdeas();
  }));
  $("#restart-prototype").addEventListener("click", () => resetCapture({ scenario: state.scenario }));
  $$("[data-scenario]").forEach((button) => button.addEventListener("click", switchScenario));
  window.addEventListener("pagehide", () => {
    state.assistanceController?.abort();
    state.assistanceRequestId += 1;
    const adapter = state.activeAdapter;
    state.activeAdapter = null;
    if (adapter) void adapter.cancel("Page closed");
  });

  void initializeApp();
  void restoreOwnerToken();

  if ("serviceWorker" in navigator && window.isSecureContext) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js?v=30").catch(() => {
        // Capture remains usable when installation support is unavailable.
      });
    });
  }
})();
