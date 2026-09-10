const test = require("node:test");
const assert = require("node:assert/strict");
const codec = require("../transcribe-codec.js");
const { TranscriptAccumulator, AwsTranscribeAdapter } = require("../transcribe-adapter.js");

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function waitFor(predicate, timeoutMs = 250) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      if (predicate()) return resolve();
      if (Date.now() - startedAt > timeoutMs) return reject(new Error("Condition was not reached."));
      setTimeout(check, 1);
    };
    check();
  });
}

function createAudioHarness() {
  let trackStops = 0;
  let contextCloses = 0;
  const trackListeners = {};
  const track = {
    addEventListener: (name, callback) => { trackListeners[name] = callback; },
    stop: () => { trackStops += 1; },
  };
  const stream = { getAudioTracks: () => [track], getTracks: () => [track] };
  class AudioContext {
    constructor() {
      this.state = "running";
      this.sampleRate = 48000;
      this.listeners = {};
      this.destination = {};
    }
    async resume() {}
    async close() { this.state = "closed"; contextCloses += 1; }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
    createScriptProcessor() { return { connect() {}, disconnect() {}, onaudioprocess: null }; }
    createGain() { return { gain: { value: 1 }, connect() {}, disconnect() {} }; }
  }
  return {
    AudioContext,
    mediaDevices: { getUserMedia: async () => stream },
    stream,
    trackListeners,
    counts: () => ({ trackStops, contextCloses }),
  };
}

function createSocketClass(options = {}) {
  return class Socket {
    static instances = [];
    constructor(url) {
      this.url = url;
      this.readyState = 0;
      this.listeners = new Map();
      this.sent = [];
      this.constructor.instances.push(this);
      if (options.autoOpen) queueMicrotask(() => { this.readyState = 1; this.emit("open"); });
    }
    addEventListener(name, callback) {
      if (!this.listeners.has(name)) this.listeners.set(name, new Set());
      this.listeners.get(name).add(callback);
    }
    removeEventListener(name, callback) { this.listeners.get(name)?.delete(callback); }
    emit(name, event = {}) { [...(this.listeners.get(name) || [])].forEach((callback) => callback(event)); }
    send(value) { this.sent.push(value); }
    close() { this.readyState = 3; }
  };
}

const validSession = { websocketUrl: "wss://transcribestreaming.us-east-2.amazonaws.com:8443/stream-transcription-websocket?test=1" };

test("AC-16: partial text is replaced while final text is retained", () => {
  const transcript = new TranscriptAccumulator();
  assert.equal(transcript.apply([{ id: "a", text: "I made", isPartial: true }]), "I made");
  assert.equal(transcript.apply([{ id: "a", text: "I made Oyakodon", isPartial: true }]), "I made Oyakodon");
  assert.equal(transcript.apply([{ id: "a", text: "I made Oyakodon", isPartial: false }]), "I made Oyakodon");
  assert.equal(transcript.apply([{ id: "b", text: "eight out of ten", isPartial: true }]), "I made Oyakodon eight out of ten");
  assert.equal(transcript.apply([{ id: "b", text: "eight out of ten", isPartial: false }]), "I made Oyakodon eight out of ten");
  assert.equal(transcript.hasFinalText(), true);
});

test("INV-16 and AC-18: cleanup is idempotent and releases every resource", async () => {
  let trackStops = 0;
  let contextCloses = 0;
  let socketCloses = 0;
  const adapter = new AwsTranscribeAdapter({
    endpoint: "https://example.invalid/session",
    fetchImpl: async () => ({ ok: true, json: async () => ({ websocketUrl: "wss://transcribestreaming.us-east-2.amazonaws.com:8443/test" }) }),
    WebSocketImpl: class {},
    AudioContextImpl: class {},
    mediaDevices: { getUserMedia: async () => ({}) },
  });
  adapter.stream = { getTracks: () => [{ stop: () => { trackStops += 1; } }] };
  adapter.context = { state: "running", close: async () => { contextCloses += 1; } };
  adapter.socket = { readyState: 1, close: () => { socketCloses += 1; } };
  adapter.captureTimer = setTimeout(() => assert.fail("capture timer was not cleared"), 10_000);
  adapter.finalizeTimer = setTimeout(() => assert.fail("finalize timer was not cleared"), 10_000);
  adapter.startupTimer = setTimeout(() => assert.fail("startup timer was not cleared"), 10_000);
  adapter.pendingSamples = new Float32Array([1, 2, 3]);
  const firstCleanup = adapter.cleanup();
  const concurrentCleanup = adapter.cleanup();
  assert.equal(firstCleanup, concurrentCleanup);
  await Promise.all([firstCleanup, concurrentCleanup]);
  await adapter.cleanup();
  assert.equal(trackStops, 1);
  assert.equal(contextCloses, 1);
  assert.equal(socketCloses, 1);
  assert.equal(adapter.pendingSamples.length, 0);
  assert.equal(adapter.stream, null);
  assert.equal(adapter.context, null);
  assert.equal(adapter.socket, null);
  assert.equal(adapter.captureTimer, null);
  assert.equal(adapter.finalizeTimer, null);
  assert.equal(adapter.startupTimer, null);
});

test("AC-21: session response must be a Transcribe WebSocket", async () => {
  const adapter = new AwsTranscribeAdapter({
    endpoint: "https://example.invalid/session",
    fetchImpl: async () => ({ ok: true, json: async () => ({ websocketUrl: "wss://evil.example/socket" }) }),
    WebSocketImpl: class {},
    AudioContextImpl: class {},
    mediaDevices: { getUserMedia: async () => ({}) },
  });
  await assert.rejects(adapter.requestSession("token"), /invalid/);
});

test("AC-21: session response must use the exact regional Transcribe path", async () => {
  const adapter = new AwsTranscribeAdapter({
    endpoint: "https://example.invalid/session",
    fetchImpl: async () => ({ ok: true, json: async () => ({ websocketUrl: "wss://transcribestreaming.us-east-2.amazonaws.com:8443/not-transcribe?x=1" }) }),
    WebSocketImpl: class {},
    AudioContextImpl: class {},
    mediaDevices: { getUserMedia: async () => ({}) },
  });
  await assert.rejects(adapter.requestSession("token"), /invalid/);
});

test("requests culinary vocabulary first and retries once without it when the socket cannot open", async () => {
  const audio = createAudioHarness();
  const bodies = [];
  class Socket {
    static instances = [];
    constructor(url) {
      this.url = url; this.readyState = 0; this.listeners = new Map(); this.sent = [];
      Socket.instances.push(this);
      queueMicrotask(() => {
        if (Socket.instances.length === 1) this.emit("error");
        else { this.readyState = 1; this.emit("open"); }
      });
    }
    addEventListener(name, callback) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name).add(callback); }
    removeEventListener(name, callback) { this.listeners.get(name)?.delete(callback); }
    emit(name, event = {}) { [...(this.listeners.get(name) || [])].forEach((callback) => callback(event)); }
    send(value) { this.sent.push(value); }
    close() { this.readyState = 3; }
  }
  const adapter = new AwsTranscribeAdapter({
    endpoint: "https://example.invalid/session",
    fetchImpl: async (_url, options) => {
      const body = JSON.parse(options.body); bodies.push(body);
      return { ok: true, json: async () => ({ ...validSession, vocabularyApplied: body.useVocabulary }) };
    },
    WebSocketImpl: Socket,
    AudioContextImpl: audio.AudioContext,
    mediaDevices: audio.mediaDevices,
  });
  await adapter.start("access-token");
  assert.deepEqual(bodies.map((body) => body.useVocabulary), [true, false]);
  assert.equal(adapter.state, "listening");
  await adapter.cancel("Finished test");
});

test("INV-16 and AC-18: cancellation while the session request is pending cannot open a late socket", async () => {
  const audio = createAudioHarness();
  const pendingFetch = deferred();
  const Socket = createSocketClass();
  let requestSignal;
  const states = [];
  const adapter = new AwsTranscribeAdapter({
    endpoint: "https://example.invalid/session",
    fetchImpl: async (_url, options) => { requestSignal = options.signal; return pendingFetch.promise; },
    WebSocketImpl: Socket,
    AudioContextImpl: audio.AudioContext,
    mediaDevices: audio.mediaDevices,
    onState: (state) => states.push(state),
  });
  const starting = adapter.start("owner-token");
  await waitFor(() => states.includes("connecting"));
  await adapter.cancel("Cancelled in test");
  assert.equal(requestSignal.aborted, true);
  pendingFetch.resolve({ ok: true, json: async () => validSession });
  await starting;
  assert.equal(Socket.instances.length, 0);
  assert.deepEqual(states, ["authorizing", "connecting", "failed"]);
  assert.deepEqual(audio.counts(), { trackStops: 1, contextCloses: 1 });
});

test("INV-16 and AC-18: cancellation during microphone permission stops a late stream", async () => {
  const audio = createAudioHarness();
  const pendingMicrophone = deferred();
  const Socket = createSocketClass();
  const states = [];
  const adapter = new AwsTranscribeAdapter({
    endpoint: "https://example.invalid/session",
    fetchImpl: async () => assert.fail("A cancelled microphone attempt must not request a session."),
    WebSocketImpl: Socket,
    AudioContextImpl: audio.AudioContext,
    mediaDevices: { getUserMedia: async () => pendingMicrophone.promise },
    onState: (state) => states.push(state),
  });
  const starting = adapter.start("owner-token");
  await waitFor(() => states.includes("authorizing"));
  await adapter.cancel("Cancelled during permission");
  pendingMicrophone.resolve(audio.stream);
  await starting;
  assert.equal(Socket.instances.length, 0);
  assert.deepEqual(states, ["authorizing", "failed"]);
  assert.deepEqual(audio.counts(), { trackStops: 1, contextCloses: 1 });
});

test("INV-16 and AC-18: a suspended context before microphone permission resolves cannot leak the late stream", async () => {
  const audio = createAudioHarness();
  const pendingMicrophone = deferred();
  const Socket = createSocketClass();
  const adapter = new AwsTranscribeAdapter({
    endpoint: "https://example.invalid/session",
    fetchImpl: async () => assert.fail("An interrupted microphone attempt must not request a session."),
    WebSocketImpl: Socket,
    AudioContextImpl: audio.AudioContext,
    mediaDevices: { getUserMedia: async () => pendingMicrophone.promise },
  });
  const starting = adapter.start("owner-token");
  await waitFor(() => Boolean(adapter.context));
  adapter.context.state = "suspended";
  pendingMicrophone.resolve(audio.stream);
  await assert.rejects(starting, /interrupted/);
  assert.equal(Socket.instances.length, 0);
  assert.deepEqual(audio.counts(), { trackStops: 1, contextCloses: 1 });
});

test("INV-16 and AC-18: cancellation while the socket opens closes it and ignores late events", async () => {
  const audio = createAudioHarness();
  const Socket = createSocketClass();
  let textCallbacks = 0;
  const adapter = new AwsTranscribeAdapter({
    endpoint: "https://example.invalid/session",
    fetchImpl: async () => ({ ok: true, json: async () => validSession }),
    WebSocketImpl: Socket,
    AudioContextImpl: audio.AudioContext,
    mediaDevices: audio.mediaDevices,
    onText: () => { textCallbacks += 1; },
  });
  const starting = adapter.start("owner-token");
  await waitFor(() => Socket.instances.length === 1);
  const socket = Socket.instances[0];
  const lateMessage = socket.onmessage;
  await adapter.cancel("Cancelled in test");
  await starting;
  assert.equal(socket.readyState, 3);
  assert.equal(socket.onmessage, null);
  lateMessage({ data: new ArrayBuffer(0) });
  assert.equal(textCallbacks, 0);
});

test("AC-18: a socket that never opens reaches a recoverable timeout", async () => {
  const audio = createAudioHarness();
  const Socket = createSocketClass();
  const states = [];
  const adapter = new AwsTranscribeAdapter({
    endpoint: "https://example.invalid/session",
    fetchImpl: async () => ({ ok: true, json: async () => validSession }),
    WebSocketImpl: Socket,
    AudioContextImpl: audio.AudioContext,
    mediaDevices: audio.mediaDevices,
    connectionTimeoutMs: 5,
    onState: (state) => states.push(state),
  });
  await assert.rejects(adapter.start("owner-token"), /timed out/);
  assert.equal(states.at(-1), "failed");
  assert.equal(Socket.instances[0].readyState, 3);
  assert.deepEqual(audio.counts(), { trackStops: 1, contextCloses: 1 });
});

test("AC-18: a session request that never settles is aborted by the startup deadline", async () => {
  const audio = createAudioHarness();
  const Socket = createSocketClass();
  const states = [];
  let requestAborted = false;
  const adapter = new AwsTranscribeAdapter({
    endpoint: "https://example.invalid/session",
    fetchImpl: async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => {
        requestAborted = true;
        reject(new Error("aborted"));
      }, { once: true });
    }),
    WebSocketImpl: Socket,
    AudioContextImpl: audio.AudioContext,
    mediaDevices: audio.mediaDevices,
    startupTimeoutMs: 5,
    onState: (state) => states.push(state),
  });
  await adapter.start("owner-token");
  await waitFor(() => states.at(-1) === "failed");
  assert.equal(requestAborted, true);
  assert.equal(Socket.instances.length, 0);
  assert.deepEqual(audio.counts(), { trackStops: 1, contextCloses: 1 });
});

test("AC-18 and AC-24: an audio-context interruption during startup aborts the session", async () => {
  const audio = createAudioHarness();
  const Socket = createSocketClass();
  const states = [];
  const adapter = new AwsTranscribeAdapter({
    endpoint: "https://example.invalid/session",
    fetchImpl: async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    }),
    WebSocketImpl: Socket,
    AudioContextImpl: audio.AudioContext,
    mediaDevices: audio.mediaDevices,
    onState: (state) => states.push(state),
  });
  const starting = adapter.start("owner-token");
  await waitFor(() => states.includes("connecting"));
  adapter.context.state = "suspended";
  adapter.context.listeners.statechange();
  await starting;
  await waitFor(() => states.at(-1) === "failed");
  assert.equal(Socket.instances.length, 0);
  assert.deepEqual(audio.counts(), { trackStops: 1, contextCloses: 1 });
});

test("AC-16 and AC-18: stop sends an empty event, retains final text, and clears resources", async () => {
  const audio = createAudioHarness();
  const Socket = createSocketClass({ autoOpen: true });
  const texts = [];
  const states = [];
  const adapter = new AwsTranscribeAdapter({
    endpoint: "https://example.invalid/session",
    fetchImpl: async () => ({ ok: true, json: async () => validSession }),
    WebSocketImpl: Socket,
    AudioContextImpl: audio.AudioContext,
    mediaDevices: audio.mediaDevices,
    onText: (text) => texts.push(text),
    onState: (state) => states.push(state),
  });
  await adapter.start("owner-token");
  const socket = Socket.instances[0];
  const finalEvent = codec.encodeEventMessage({
    ":content-type": "application/json",
    ":event-type": "TranscriptEvent",
    ":message-type": "event",
  }, JSON.stringify({ Transcript: { Results: [{ ResultId: "final", IsPartial: false, Alternatives: [{ Transcript: "Oyakodon eight out of ten" }] }] } }));
  socket.onmessage({ data: finalEvent });
  const run = adapter.activeRun;
  await adapter.stop();
  assert.equal(adapter.finalizeTimer !== null, true);
  const endFrame = codec.decodeEventMessage(socket.sent.at(-1));
  assert.equal(endFrame.body.length, 0);
  await adapter.finishComplete(run);
  assert.equal(texts.at(-1), "Oyakodon eight out of ten");
  assert.equal(states.at(-1), "complete");
  assert.equal(adapter.captureTimer, null);
  assert.equal(adapter.finalizeTimer, null);
  assert.equal(adapter.socket, null);
  assert.deepEqual(audio.counts(), { trackStops: 1, contextCloses: 1 });
});
