import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseReport, slugFromRoomText } from "../lib/report-rules.ts";

const valid = {
  category: "rights",
  room: "fjorden",
  song: "Natt",
  description: "Dette er min låt, og den er lastet opp uten tillatelse.",
  name: "Kari",
  email: "kari@example.no",
};

describe("parseReport", () => {
  it("accepts a complete report and trims it", () => {
    const result = parseReport({ ...valid, name: "  Kari  " });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.value.name, "Kari");
  });

  it("needs a known category", () => {
    assert.deepEqual(parseReport({ ...valid, category: "spam" }), {
      ok: false,
      error: "category",
    });
    assert.deepEqual(parseReport({ ...valid, category: undefined }), {
      ok: false,
      error: "category",
    });
  });

  it("needs a description of at least 10 characters", () => {
    assert.deepEqual(parseReport({ ...valid, description: "kort" }), {
      ok: false,
      error: "description",
    });
    assert.deepEqual(parseReport({ ...valid, description: "   " }), {
      ok: false,
      error: "description",
    });
  });

  it("makes name and email optional, but rejects a broken email", () => {
    assert.equal(parseReport({ ...valid, name: "", email: "" }).ok, true);
    assert.deepEqual(parseReport({ ...valid, email: "kari@" }), {
      ok: false,
      error: "email",
    });
  });

  it("cuts overlong text instead of storing it", () => {
    const result = parseReport({ ...valid, description: "x".repeat(5000) });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.value.description.length, 2000);
  });

  it("survives junk input", () => {
    assert.equal(parseReport(null).ok, false);
    assert.equal(parseReport("hei").ok, false);
    assert.equal(parseReport({ category: 5, description: {} }).ok, false);
  });
});

describe("slugFromRoomText", () => {
  it("takes a plain address", () => {
    assert.equal(slugFromRoomText("fjorden"), "fjorden");
    assert.equal(slugFromRoomText("  Fjorden "), "fjorden");
  });

  it("takes the address out of a link", () => {
    assert.equal(
      slugFromRoomText("https://listeningrooms.no/room/fjorden?track=trk_1"),
      "fjorden",
    );
    assert.equal(slugFromRoomText("/room/fjorden"), "fjorden");
  });

  it("returns null when it does not look like an address", () => {
    assert.equal(slugFromRoomText(""), null);
    assert.equal(slugFromRoomText("Fjorden og venner"), null);
    assert.equal(slugFromRoomText("ab"), null);
  });
});
