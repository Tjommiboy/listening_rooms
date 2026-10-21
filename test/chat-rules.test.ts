import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CHAT_MAX_LENGTH,
  CHAT_THREADS_MAX,
  chatDisplayName,
  chatLimit,
  parseChatMessage,
} from "../lib/chat-rules.ts";

describe("parseChatMessage", () => {
  it("accepts and trims a normal message", () => {
    assert.deepEqual(parseChatMessage("  Hei! Digger nye låta.  "), {
      ok: true,
      text: "Hei! Digger nye låta.",
    });
  });

  it("refuses empty or non-text input", () => {
    for (const input of ["", "   \n  ", undefined, null, 5, {}])
      assert.deepEqual(parseChatMessage(input), { ok: false, error: "empty" });
  });

  it("refuses a message that is too long instead of cutting it", () => {
    assert.equal(parseChatMessage("x".repeat(CHAT_MAX_LENGTH)).ok, true);
    assert.deepEqual(parseChatMessage("x".repeat(CHAT_MAX_LENGTH + 1)), {
      ok: false,
      error: "too_long",
    });
  });

  it("keeps new lines but squeezes long runs of them", () => {
    const result = parseChatMessage("a\r\nb\n\n\n\n\nc");
    assert.deepEqual(result, { ok: true, text: "a\nb\n\nc" });
  });

  it("removes hidden and direction-changing characters", () => {
    const result = parseChatMessage("he​i ‮abc\u0007\u0000 ok");
    assert.deepEqual(result, { ok: true, text: "hei abc ok" });
  });

  it("keeps ordinary letters and emoji", () => {
    const result = parseChatMessage("Æ Ø Å 🎸 – bra!");
    assert.deepEqual(result, { ok: true, text: "Æ Ø Å 🎸 – bra!" });
  });

  it("is empty when only hidden characters remain", () => {
    assert.deepEqual(parseChatMessage("​​"), {
      ok: false,
      error: "empty",
    });
  });
});

describe("chatDisplayName", () => {
  it("uses the first name only", () => {
    assert.equal(chatDisplayName("Kari Nordmann", "Fan"), "Kari");
    assert.equal(chatDisplayName("  Ola  ", "Fan"), "Ola");
  });

  it("falls back when there is no name", () => {
    assert.equal(chatDisplayName(null, "Fan"), "Fan");
    assert.equal(chatDisplayName("   ", "Fan"), "Fan");
  });

  it("cuts a very long name", () => {
    assert.equal(chatDisplayName("A".repeat(80), "Fan").length, 30);
  });
});

describe("chatLimit", () => {
  it("defaults to one page of 50", () => {
    for (const raw of [undefined, "", "abc", "-5", "0", "50", "NaN"])
      assert.equal(chatLimit(raw), 50);
  });
  it("rounds up to whole pages", () => {
    assert.equal(chatLimit("51"), 100);
    assert.equal(chatLimit("100"), 100);
    assert.equal(chatLimit("120"), 150);
  });
  it("never goes past the maximum", () => {
    assert.equal(chatLimit("999999"), CHAT_THREADS_MAX);
    assert.equal(chatLimit("Infinity"), 50);
  });
});
