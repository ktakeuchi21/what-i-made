const test = require("node:test");
const assert = require("node:assert/strict");
const codec = require("../transcribe-codec.js");

test("INV-13: PCM encoding clamps samples and writes little-endian signed 16-bit values", () => {
  const encoded = codec.pcmEncode(new Float32Array([-2, -1, -0.5, 0, 0.5, 1, 2]));
  const view = new DataView(encoded.buffer);
  assert.deepEqual(Array.from({ length: 7 }, (_, index) => view.getInt16(index * 2, true)), [
    -32768, -32768, -16384, 0, 16383, 32767, 32767,
  ]);
});

test("INV-13: downsampling preserves bounds and expected duration", () => {
  const input = new Float32Array(4800).map((_, index) => Math.sin(index / 12));
  const output = codec.downsampleBuffer(input, 48000, 16000);
  assert.equal(output.length, 1600);
  assert.ok(output.every((value) => value >= -1 && value <= 1));
});

test("AC-20: AudioEvent contains required headers, payload, and valid CRCs", () => {
  const payload = new Uint8Array([1, 2, 3, 4]);
  const encoded = codec.encodeAudioEvent(payload);
  const decoded = codec.decodeEventMessage(encoded);
  assert.equal(decoded.headers[":content-type"], "application/octet-stream");
  assert.equal(decoded.headers[":event-type"], "AudioEvent");
  assert.equal(decoded.headers[":message-type"], "event");
  assert.deepEqual(Array.from(decoded.body), Array.from(payload));
});

test("AC-20: corrupted event-stream frames are rejected", () => {
  const encoded = new Uint8Array(codec.encodeAudioEvent(new Uint8Array([1, 2, 3])));
  encoded[encoded.length - 5] ^= 0xff;
  assert.throws(() => codec.decodeEventMessage(encoded), /CRC failed/);
});

test("AC-16: transcript events expose partial and final alternatives", () => {
  const payload = JSON.stringify({
    Transcript: {
      Results: [
        { ResultId: "one", IsPartial: true, Alternatives: [{ Transcript: "I made Oyakodon" }] },
        { ResultId: "two", IsPartial: false, Alternatives: [{ Transcript: "eight out of ten" }] },
      ],
    },
  });
  const event = codec.encodeEventMessage({
    ":content-type": "application/json",
    ":event-type": "TranscriptEvent",
    ":message-type": "event",
  }, payload);
  assert.deepEqual(codec.extractTranscriptEvent(event), [
    { id: "one", text: "I made Oyakodon", isPartial: true },
    { id: "two", text: "eight out of ten", isPartial: false },
  ]);
});
