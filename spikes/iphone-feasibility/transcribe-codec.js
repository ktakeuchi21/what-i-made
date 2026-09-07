(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.WhatIMadeTranscribeCodec = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const CRC_TABLE = buildCrcTable();

  function buildCrcTable() {
    const table = new Uint32Array(256);
    for (let index = 0; index < table.length; index += 1) {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) {
        value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      }
      table[index] = value >>> 0;
    }
    return table;
  }

  function crc32(bytes) {
    const view = toUint8Array(bytes);
    let crc = 0xffffffff;
    for (let index = 0; index < view.length; index += 1) {
      crc = CRC_TABLE[(crc ^ view[index]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function toUint8Array(value) {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    return new Uint8Array(value || 0);
  }

  function encodeHeader(name, value) {
    const nameBytes = encoder.encode(name);
    const valueBytes = encoder.encode(value);
    if (nameBytes.length > 255 || valueBytes.length > 65535) throw new RangeError("Event-stream header is too long.");
    const bytes = new Uint8Array(1 + nameBytes.length + 1 + 2 + valueBytes.length);
    const view = new DataView(bytes.buffer);
    bytes[0] = nameBytes.length;
    bytes.set(nameBytes, 1);
    bytes[1 + nameBytes.length] = 7;
    view.setUint16(2 + nameBytes.length, valueBytes.length, false);
    bytes.set(valueBytes, 4 + nameBytes.length);
    return bytes;
  }

  function concatBytes(parts) {
    const normalized = parts.map(toUint8Array);
    const total = normalized.reduce((sum, part) => sum + part.length, 0);
    const output = new Uint8Array(total);
    let offset = 0;
    normalized.forEach((part) => {
      output.set(part, offset);
      offset += part.length;
    });
    return output;
  }

  function encodeEventMessage(headerValues, payload) {
    const body = typeof payload === "string" ? encoder.encode(payload) : toUint8Array(payload);
    const headers = concatBytes(Object.entries(headerValues).map(([name, value]) => encodeHeader(name, value)));
    const totalLength = 16 + headers.length + body.length;
    const message = new Uint8Array(totalLength);
    const view = new DataView(message.buffer);
    view.setUint32(0, totalLength, false);
    view.setUint32(4, headers.length, false);
    view.setUint32(8, crc32(message.subarray(0, 8)), false);
    message.set(headers, 12);
    message.set(body, 12 + headers.length);
    view.setUint32(totalLength - 4, crc32(message.subarray(0, totalLength - 4)), false);
    return message.buffer;
  }

  function encodeAudioEvent(payload) {
    return encodeEventMessage({
      ":content-type": "application/octet-stream",
      ":event-type": "AudioEvent",
      ":message-type": "event",
    }, payload);
  }

  function decodeHeaders(bytes) {
    const headers = {};
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 0;
    while (offset < bytes.length) {
      const nameLength = bytes[offset];
      offset += 1;
      if (offset + nameLength + 1 > bytes.length) throw new Error("Malformed event-stream header name.");
      const name = decoder.decode(bytes.subarray(offset, offset + nameLength));
      offset += nameLength;
      const type = bytes[offset];
      offset += 1;
      if (type !== 7 || offset + 2 > bytes.length) throw new Error("Unsupported event-stream header type.");
      const valueLength = view.getUint16(offset, false);
      offset += 2;
      if (offset + valueLength > bytes.length) throw new Error("Malformed event-stream header value.");
      headers[name] = decoder.decode(bytes.subarray(offset, offset + valueLength));
      offset += valueLength;
    }
    return headers;
  }

  function decodeEventMessage(input) {
    const bytes = toUint8Array(input);
    if (bytes.length < 16) throw new Error("Event-stream message is too short.");
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const totalLength = view.getUint32(0, false);
    const headersLength = view.getUint32(4, false);
    if (totalLength !== bytes.length || headersLength > totalLength - 16) throw new Error("Invalid event-stream lengths.");
    if (view.getUint32(8, false) !== crc32(bytes.subarray(0, 8))) throw new Error("Event-stream prelude CRC failed.");
    if (view.getUint32(totalLength - 4, false) !== crc32(bytes.subarray(0, totalLength - 4))) {
      throw new Error("Event-stream message CRC failed.");
    }
    const headers = decodeHeaders(bytes.subarray(12, 12 + headersLength));
    const body = bytes.subarray(12 + headersLength, totalLength - 4);
    return { headers, body, text: decoder.decode(body) };
  }

  function downsampleBuffer(input, inputSampleRate, outputSampleRate) {
    if (!(input instanceof Float32Array)) input = new Float32Array(input || 0);
    if (!Number.isFinite(inputSampleRate) || !Number.isFinite(outputSampleRate) || outputSampleRate <= 0) {
      throw new RangeError("Sample rates must be positive numbers.");
    }
    if (outputSampleRate > inputSampleRate) throw new RangeError("Upsampling is not supported.");
    if (outputSampleRate === inputSampleRate) return input.slice();
    const ratio = inputSampleRate / outputSampleRate;
    const output = new Float32Array(Math.round(input.length / ratio));
    let inputOffset = 0;
    for (let outputOffset = 0; outputOffset < output.length; outputOffset += 1) {
      const nextInputOffset = Math.min(input.length, Math.round((outputOffset + 1) * ratio));
      let total = 0;
      let count = 0;
      for (; inputOffset < nextInputOffset; inputOffset += 1) {
        total += input[inputOffset];
        count += 1;
      }
      output[outputOffset] = count ? total / count : 0;
    }
    return output;
  }

  function pcmEncode(input) {
    const samples = input instanceof Float32Array ? input : new Float32Array(input || 0);
    const buffer = new ArrayBuffer(samples.length * 2);
    const view = new DataView(buffer);
    for (let index = 0; index < samples.length; index += 1) {
      const sample = Math.max(-1, Math.min(1, samples[index]));
      view.setInt16(index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    }
    return new Uint8Array(buffer);
  }

  function extractTranscriptEvent(input) {
    const message = decodeEventMessage(input);
    if (message.headers[":message-type"] !== "event") {
      let detail = "Amazon Transcribe ended the stream.";
      try {
        detail = JSON.parse(message.text).Message || detail;
      } catch {
        if (message.text.trim()) detail = message.text.trim();
      }
      const error = new Error(detail);
      error.code = message.headers[":exception-type"] || "transcribe_exception";
      throw error;
    }
    if (message.headers[":event-type"] !== "TranscriptEvent") return [];
    const payload = JSON.parse(message.text || "{}");
    return (payload.Transcript?.Results || []).flatMap((result) => {
      const text = result.Alternatives?.[0]?.Transcript?.trim();
      return text ? [{ id: result.ResultId || "", text, isPartial: Boolean(result.IsPartial) }] : [];
    });
  }

  return { crc32, encodeEventMessage, encodeAudioEvent, decodeEventMessage, downsampleBuffer, pcmEncode, extractTranscriptEvent };
});
