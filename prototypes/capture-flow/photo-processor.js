(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WhatIMadePhotoProcessor = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  function canvasToJpeg(canvas, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error("Safari could not create the optimized JPEG.")),
        "image/jpeg",
        quality,
      );
    });
  }

  async function decodeImage(file) {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    try {
      if (image.decode) await image.decode();
      else await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error("Safari could not decode this image."));
      });
    } catch {
      URL.revokeObjectURL(url);
      throw new Error("This photo could not be processed. Try a different image.");
    }
    return { image, url, width: image.naturalWidth, height: image.naturalHeight };
  }

  function drawScaledImage(decoded, maximumLongEdge) {
    const scale = Math.min(1, maximumLongEdge / Math.max(decoded.width, decoded.height));
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false, colorSpace: "srgb" }) || canvas.getContext("2d");
    if (!context) throw new Error("Photo processing is unavailable in this browser.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(decoded.image, 0, 0, width, height);
    return canvas;
  }

  async function processPhoto(file) {
    if (!(file instanceof Blob) || file.size === 0) throw new Error("Choose a photo to continue.");
    const decoded = await decodeImage(file);
    try {
      let canvas = drawScaledImage(decoded, 2048);
      let quality = 0.82;
      let blob = await canvasToJpeg(canvas, quality);
      if (blob.size > 1_200_000) {
        quality = 0.72;
        blob = await canvasToJpeg(canvas, quality);
      }
      if (blob.size > 1_200_000 && Math.max(canvas.width, canvas.height) > 1600) {
        canvas = drawScaledImage(decoded, 1600);
        blob = await canvasToJpeg(canvas, 0.72);
      }
      if (blob.size > 1_200_000) blob = await canvasToJpeg(canvas, 0.62);
      if (blob.size > 1_200_000) throw new Error("This photo is still too large after local optimization.");
      const thumbnailCanvas = drawScaledImage(decoded, 512);
      const thumbnailBlob = await canvasToJpeg(thumbnailCanvas, 0.74);
      return { blob, thumbnailBlob, width: canvas.width, height: canvas.height, thumbnailWidth: thumbnailCanvas.width, thumbnailHeight: thumbnailCanvas.height };
    } finally {
      URL.revokeObjectURL(decoded.url);
    }
  }

  return { processPhoto };
});
