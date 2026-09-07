(function (root, factory) {
  const api = factory(root, root?.WhatIMadeTranscribeCodec);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.WhatIMadeTranscribe = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root, codec) {
  "use strict";

  const TARGET_SAMPLE_RATE = 16000;
  const INPUT_BLOCK_SIZE = 4096;

  class TranscriptAccumulator {
    constructor() {
      this.finalSegments = [];
      this.partialById = new Map();
    }

    apply(results) {
      results.forEach((result) => {
        const key = result.id || "current";
        if (result.isPartial) {
          this.partialById.set(key, result.text);
        } else {
          this.partialById.delete(key);
          if (result.text) this.finalSegments.push(result.text);
        }
      });
      return this.value();
    }

    value() {
      return [...this.finalSegments, ...this.partialById.values()].join(" ").trim();
    }

    hasFinalText() {
      return this.finalSegments.join(" ").trim().length > 0;
    }
  }

  class AwsTranscribeAdapter {
    constructor(options = {}) {
      if (!codec) throw new Error("Transcribe codec is unavailable.");
      this.endpoint = options.endpoint || "";
      this.maxCaptureSeconds = options.maxCaptureSeconds || 45;
      this.fetchImpl = options.fetchImpl || root.fetch.bind(root);
      this.WebSocketImpl = options.WebSocketImpl || root.WebSocket;
      this.AudioContextImpl = options.AudioContextImpl || root.AudioContext || root.webkitAudioContext;
      this.mediaDevices = options.mediaDevices || root.navigator?.mediaDevices;
      this.AbortControllerImpl = options.AbortControllerImpl || root.AbortController;
      this.connectionTimeoutMs = options.connectionTimeoutMs || 8000;
      this.startupTimeoutMs = options.startupTimeoutMs || 15000;
      this.onState = options.onState || (() => {});
      this.onText = options.onText || (() => {});
      this.state = "idle";
      this.accumulator = new TranscriptAccumulator();
      this.context = null;
      this.stream = null;
      this.source = null;
      this.processor = null;
      this.silentGain = null;
      this.socket = null;
      this.captureTimer = null;
      this.finalizeTimer = null;
      this.startupTimer = null;
      this.pendingSamples = new Float32Array(0);
      this.inputSampleRate = 0;
      this.cleaningUp = false;
      this.cleanupPromise = null;
      this.activeRun = null;
      this.socketHandlers = null;
    }

    setState(next, detail = "") {
      this.state = next;
      this.onState(next, detail);
    }

    async start(token) {
      if (!["idle", "complete", "failed"].includes(this.state)) {
        const error = new Error("A transcription is already active.");
        error.code = "already_active";
        throw error;
      }
      if (!this.endpoint) throw this.makeError("not_configured", "AWS transcription is not configured.");
      if (!token) throw this.makeError("missing_token", "Save the owner token before starting.");
      if (!this.AudioContextImpl || !this.mediaDevices?.getUserMedia || !this.WebSocketImpl) {
        throw this.makeError("unsupported", "This browser does not expose the required audio APIs.");
      }
      if (!this.AbortControllerImpl) throw this.makeError("unsupported", "This browser cannot cancel a transcription request safely.");

      this.cleaningUp = false;
      this.accumulator = new TranscriptAccumulator();
      this.pendingSamples = new Float32Array(0);
      const run = { id: Symbol("transcription-run"), controller: new this.AbortControllerImpl() };
      this.activeRun = run;
      this.setState("authorizing", "Preparing microphone");
      this.startupTimer = root.setTimeout(() => {
        if (this.isActive(run)) this.failFromInterruption("The transcription setup timed out. Try again when your connection is stable.", run);
      }, this.startupTimeoutMs);

      try {
        const context = new this.AudioContextImpl({ latencyHint: "interactive" });
        this.context = context;
        await context.resume();
        this.ensureActive(run);
        if (context.state !== "running") throw this.makeError("audio_suspended", "iPhone audio could not start.");
        context.addEventListener?.("statechange", () => this.handleContextState(run));

        const stream = await this.mediaDevices.getUserMedia({
          audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false,
        });
        if (!this.isActive(run)) {
          stream.getTracks?.().forEach((item) => item.stop());
          return;
        }
        this.stream = stream;
        this.ensureContextRunning(run, context);
        const track = stream.getAudioTracks()[0];
        if (!track) throw this.makeError("no_audio_track", "No microphone track was returned.");
        track.addEventListener?.("mute", () => this.failFromInterruption("The microphone was interrupted.", run));
        track.addEventListener?.("ended", () => this.failFromInterruption("The microphone stopped.", run));

        this.setState("connecting", "Opening secure AWS session");
        const session = await this.requestSession(token, run.controller.signal);
        this.ensureActive(run);
        this.ensureContextRunning(run, context);
        await this.openSocket(session.websocketUrl, run);
        this.ensureActive(run);
        this.ensureContextRunning(run, context);
        await this.connectAudioGraph(run);
        this.ensureActive(run);
        this.ensureContextRunning(run, context);
        root.clearTimeout(this.startupTimer);
        this.startupTimer = null;
        this.setState("listening", "Listening");
        this.captureTimer = root.setTimeout(() => {
          if (this.isActive(run)) this.stop("45-second limit");
        }, this.maxCaptureSeconds * 1000);
      } catch (error) {
        if (!this.isActive(run)) return;
        await this.cleanup(run);
        this.setState("failed", error.message || "Transcription could not start.");
        throw error;
      }
    }

    async requestSession(token, signal) {
      const response = await this.fetchImpl(this.endpoint, {
        method: "POST",
        mode: "cors",
        cache: "no-store",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        signal,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ languageCode: "en-US", sampleRateHertz: TARGET_SAMPLE_RATE }),
      });
      let body = {};
      try {
        body = await response.json();
      } catch {
        // The status-specific message below is safe and sufficient.
      }
      if (!response.ok) {
        const messages = {
          401: "The owner token was not accepted.",
          413: "The transcription request was too large.",
          503: "AWS transcription is temporarily disabled.",
        };
        throw this.makeError(body.error || `http_${response.status}`, messages[response.status] || "The AWS session could not start.");
      }
      const websocketPattern = /^wss:\/\/transcribestreaming\.[a-z]{2}-[a-z]+-\d\.amazonaws\.com:8443\/stream-transcription-websocket\?/;
      if (typeof body.websocketUrl !== "string" || !websocketPattern.test(body.websocketUrl)) {
        throw this.makeError("invalid_session", "The AWS session response was invalid.");
      }
      return body;
    }

    openSocket(url, run) {
      return new Promise((resolve, reject) => {
        this.ensureActive(run);
        const socket = new this.WebSocketImpl(url);
        this.socket = socket;
        socket.binaryType = "arraybuffer";
        let settled = false;
        const finish = (callback, value) => {
          if (settled) return;
          settled = true;
          root.clearTimeout(connectionTimer);
          run.controller.signal.removeEventListener?.("abort", handleAbort);
          socket.removeEventListener?.("open", handleOpen);
          socket.removeEventListener?.("error", handleInitialError);
          callback(value);
        };
        const handleOpen = () => {
          if (!this.isActive(run)) return finish(reject, this.makeError("cancelled", "Transcription was cancelled."));
          finish(resolve);
        };
        const handleInitialError = () => finish(reject, this.makeError("socket_open", "The secure transcription connection failed."));
        const handleAbort = () => {
          if (socket.readyState < 2) socket.close(1000, "client cancelled");
          finish(reject, this.makeError("cancelled", "Transcription was cancelled."));
        };
        const connectionTimer = root.setTimeout(() => {
          if (socket.readyState < 2) socket.close(1000, "connection timeout");
          finish(reject, this.makeError("socket_timeout", "The secure transcription connection timed out."));
        }, this.connectionTimeoutMs);
        socket.addEventListener?.("open", handleOpen, { once: true });
        socket.addEventListener?.("error", handleInitialError, { once: true });
        run.controller.signal.addEventListener?.("abort", handleAbort, { once: true });
        socket.onmessage = (event) => {
          if (this.isActive(run)) this.handleMessage(event.data, run);
        };
        socket.onerror = () => {
          if (this.isActive(run) && !["finishing", "complete", "failed"].includes(this.state)) {
            this.failFromInterruption("The transcription connection was interrupted.", run);
          }
        };
        socket.onclose = () => {
          if (!this.isActive(run)) return;
          if (this.state === "finishing") this.finishComplete(run);
          else if (this.state === "listening" || this.state === "connecting") {
            this.failFromInterruption("The transcription connection closed early.", run);
          }
        };
        this.socketHandlers = { socket, handleOpen, handleInitialError, handleAbort, connectionTimer, signal: run.controller.signal };
      });
    }

    async connectAudioGraph(run) {
      this.ensureActive(run);
      this.inputSampleRate = this.context.sampleRate;
      this.source = this.context.createMediaStreamSource(this.stream);
      if (this.context.audioWorklet && root.AudioWorkletNode) {
        try {
          await this.context.audioWorklet.addModule("./audio-worklet.js");
          this.ensureActive(run);
          this.processor = new root.AudioWorkletNode(this.context, "what-i-made-pcm", { numberOfInputs: 1, numberOfOutputs: 1 });
          this.processor.port.onmessage = (event) => this.handleSamples(event.data);
        } catch {
          this.processor = null;
        }
      }
      this.ensureActive(run);
      if (!this.processor) {
        this.processor = this.context.createScriptProcessor(4096, 1, 1);
        this.processor.onaudioprocess = (event) => this.handleSamples(event.inputBuffer.getChannelData(0));
      }
      this.silentGain = this.context.createGain();
      this.silentGain.gain.value = 0;
      this.source.connect(this.processor);
      this.processor.connect(this.silentGain);
      this.silentGain.connect(this.context.destination);
    }

    handleSamples(input) {
      if (this.state !== "listening" || !input?.length) return;
      const combined = new Float32Array(this.pendingSamples.length + input.length);
      combined.set(this.pendingSamples);
      combined.set(input, this.pendingSamples.length);
      let offset = 0;
      while (combined.length - offset >= INPUT_BLOCK_SIZE) {
        this.sendSamples(combined.subarray(offset, offset + INPUT_BLOCK_SIZE));
        offset += INPUT_BLOCK_SIZE;
      }
      this.pendingSamples = combined.slice(offset);
    }

    sendSamples(samples) {
      if (this.socket?.readyState !== 1 || !samples.length) return;
      const downsampled = codec.downsampleBuffer(samples, this.inputSampleRate, TARGET_SAMPLE_RATE);
      this.socket.send(codec.encodeAudioEvent(codec.pcmEncode(downsampled)));
    }

    handleMessage(data, run) {
      if (!this.isActive(run)) return;
      try {
        const results = codec.extractTranscriptEvent(data);
        if (!results.length) return;
        const text = this.accumulator.apply(results);
        this.onText(text, { hasFinalText: this.accumulator.hasFinalText() });
      } catch (error) {
        this.failFromInterruption(error.message || "Amazon Transcribe returned an invalid response.", run);
      }
    }

    async stop(detail = "Finishing") {
      if (this.state !== "listening") return;
      const run = this.activeRun;
      if (!run) return;
      this.setState("finishing", detail);
      root.clearTimeout(this.captureTimer);
      this.captureTimer = null;
      if (this.pendingSamples.length) this.sendSamples(this.pendingSamples);
      this.pendingSamples = new Float32Array(0);
      this.disconnectAudioGraph();
      if (this.socket?.readyState === 1) this.socket.send(codec.encodeAudioEvent(new Uint8Array(0)));
      this.finalizeTimer = root.setTimeout(() => this.finishComplete(run), 3000);
    }

    async cancel(detail = "Cancelled") {
      if (["idle", "complete", "failed"].includes(this.state)) return;
      const run = this.activeRun;
      await this.cleanup(run);
      this.setState("failed", detail);
    }

    async finishComplete(run = this.activeRun) {
      if (!run || !this.isActive(run) || this.state === "complete") return;
      const hasFinal = this.accumulator.hasFinalText();
      await this.cleanup(run);
      this.setState(hasFinal ? "complete" : "failed", hasFinal ? "Transcript ready" : "No final words were returned. You can type or use Dictation.");
    }

    failFromInterruption(message, run = this.activeRun) {
      if (!run || !this.isActive(run) || this.cleaningUp || !["authorizing", "connecting", "listening"].includes(this.state)) return;
      this.cleanup(run).finally(() => this.setState("failed", message));
    }

    handleContextState(run) {
      if (!this.isActive(run) || this.cleaningUp || !this.context || !["authorizing", "connecting", "listening"].includes(this.state)) return;
      if (["suspended", "interrupted", "closed"].includes(this.context.state)) {
        this.failFromInterruption("iPhone audio was interrupted. Your visible text is still editable.", run);
      }
    }

    disconnectAudioGraph() {
      try { this.source?.disconnect(); } catch {}
      try { this.processor?.disconnect(); } catch {}
      try { this.silentGain?.disconnect(); } catch {}
      if (this.processor?.port) this.processor.port.onmessage = null;
      if (this.processor) this.processor.onaudioprocess = null;
      this.stream?.getTracks?.().forEach((track) => track.stop());
      this.source = null;
      this.processor = null;
      this.silentGain = null;
      this.stream = null;
    }

    cleanup(run = this.activeRun) {
      if (this.cleanupPromise) return this.cleanupPromise;
      if (run?.controller && !run.controller.signal.aborted) run.controller.abort();
      if (this.activeRun === run) this.activeRun = null;
      this.cleaningUp = true;
      this.cleanupPromise = (async () => {
        root.clearTimeout(this.captureTimer);
        root.clearTimeout(this.finalizeTimer);
        root.clearTimeout(this.startupTimer);
        this.captureTimer = null;
        this.finalizeTimer = null;
        this.startupTimer = null;
        this.disconnectAudioGraph();
        this.detachSocketHandlers();
        if (this.socket && this.socket.readyState < 2) this.socket.close(1000, "client cleanup");
        this.socket = null;
        const context = this.context;
        this.context = null;
        if (context && context.state !== "closed") {
          try { await context.close(); } catch {}
        }
        this.pendingSamples = new Float32Array(0);
      })().finally(() => {
        this.cleaningUp = false;
        this.cleanupPromise = null;
      });
      return this.cleanupPromise;
    }

    detachSocketHandlers() {
      const handlers = this.socketHandlers;
      if (!handlers) return;
      root.clearTimeout(handlers.connectionTimer);
      handlers.signal?.removeEventListener?.("abort", handlers.handleAbort);
      handlers.socket.removeEventListener?.("open", handlers.handleOpen);
      handlers.socket.removeEventListener?.("error", handlers.handleInitialError);
      handlers.socket.onmessage = null;
      handlers.socket.onerror = null;
      handlers.socket.onclose = null;
      this.socketHandlers = null;
    }

    isActive(run) {
      return Boolean(run && this.activeRun === run && !run.controller.signal.aborted);
    }

    ensureActive(run) {
      if (!this.isActive(run)) throw this.makeError("cancelled", "Transcription was cancelled.");
    }

    ensureContextRunning(run, context = this.context) {
      this.ensureActive(run);
      if (!context || context.state !== "running") {
        throw this.makeError("audio_suspended", "iPhone audio was interrupted before transcription started.");
      }
    }

    makeError(code, message) {
      const error = new Error(message);
      error.code = code;
      return error;
    }
  }

  class FakeTranscribeAdapter {
    constructor(options = {}) {
      this.onState = options.onState || (() => {});
      this.onText = options.onText || (() => {});
      this.failure = options.failure || "";
      this.state = "idle";
      this.timer = null;
      this.runId = 0;
    }
    async start(token) {
      if (!token) throw new Error("Save the owner token before starting.");
      const runId = ++this.runId;
      this.state = "connecting";
      this.onState("connecting", "Opening test session");
      await new Promise((resolve) => root.setTimeout(resolve, 80));
      if (runId !== this.runId) return;
      if (this.failure === "connect") {
        this.state = "failed";
        this.onState("failed", "The test connection failed. Typing remains available.");
        throw new Error("The test connection failed.");
      }
      this.state = "listening";
      this.onState("listening", "Listening");
      this.timer = root.setTimeout(() => {
        if (runId === this.runId) this.onText("I made Oyakodon, eight out of ten.", { hasFinalText: false });
      }, 120);
    }
    async stop() {
      if (this.state !== "listening") return;
      const runId = this.runId;
      root.clearTimeout(this.timer);
      this.state = "finishing";
      this.onState("finishing", "Finishing");
      await new Promise((resolve) => root.setTimeout(resolve, 80));
      if (runId !== this.runId) return;
      this.onText("I made Oyakodon, eight out of ten. Use less soy next time.", { hasFinalText: true });
      this.state = "complete";
      this.onState("complete", "Transcript ready");
    }
    async cancel(detail = "Cancelled") {
      this.runId += 1;
      root.clearTimeout(this.timer);
      this.state = "failed";
      this.onState("failed", detail);
    }
  }

  return { AwsTranscribeAdapter, FakeTranscribeAdapter, TranscriptAccumulator };
});
