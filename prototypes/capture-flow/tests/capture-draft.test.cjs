const test = require("node:test");
const assert = require("node:assert/strict");

const { discardActiveVoice, hasCaptureDraft } = require("../capture-draft.js");

test("an untouched capture is not a draft", () => {
  assert.equal(hasCaptureDraft(), false);
  assert.equal(hasCaptureDraft({ dishName: "  ", notes: "" }), false);
});

test("required inputs and transcript each make a capture dirty", () => {
  assert.equal(hasCaptureDraft({ photoReady: true }), true);
  assert.equal(hasCaptureDraft({ dishName: "Oyakodon" }), true);
  assert.equal(hasCaptureDraft({ transcript: "I made Oyakodon" }), true);
});

test("every optional detail is protected as draft content", () => {
  assert.equal(hasCaptureDraft({ rating: "8" }), true);
  assert.equal(hasCaptureDraft({ notes: "Use less soy" }), true);
  assert.equal(hasCaptureDraft({ ingredients: "Egg and chicken" }), true);
});

test("active voice and uncommitted live text are protected", () => {
  assert.equal(hasCaptureDraft({ recordingActive: true }), true);
  assert.equal(hasCaptureDraft({ liveTranscript: "Oyakodon" }), true);
});

test("confirmed discard clears voice ownership before cancelling the adapter", async () => {
  const calls = [];
  const session = {
    activeTranscript: { text: "Oyakodon" },
    activeAdapter: {
      async cancel(message) {
        calls.push({ message, adapterAtCancel: session.activeAdapter, transcriptAtCancel: session.activeTranscript });
      },
    },
  };

  await discardActiveVoice(session);
  assert.equal(session.activeAdapter, null);
  assert.equal(session.activeTranscript, null);
  assert.deepEqual(calls, [{
    message: "Unsaved voice note discarded",
    adapterAtCancel: null,
    transcriptAtCancel: null,
  }]);
});
