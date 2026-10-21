import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addMonth,
  BAND_GRACE_DAYS,
  BAND_LOCKED_DAYS,
  bandStateFrom,
  DAY,
  dueDateFor,
  fanSubscriptionState,
  nextPaidUntil,
  osloDate,
} from "../lib/billing-rules.ts";

const at = (iso: string) => Date.parse(iso);

describe("bandStateFrom", () => {
  const paidUntil = at("2026-11-20T10:00:00Z");

  it("is trial for a band that has never paid", () => {
    assert.equal(bandStateFrom(null, at("2026-11-01T00:00:00Z")), "trial");
  });

  it("is active while paid and during the 3 days of grace", () => {
    assert.equal(bandStateFrom(paidUntil, paidUntil - 1), "active");
    assert.equal(bandStateFrom(paidUntil, paidUntil), "active");
    assert.equal(
      bandStateFrom(paidUntil, paidUntil + BAND_GRACE_DAYS * DAY - 1),
      "active",
    );
  });

  it("locks the studio when the grace has run out", () => {
    assert.equal(
      bandStateFrom(paidUntil, paidUntil + BAND_GRACE_DAYS * DAY),
      "locked",
    );
  });

  it("stays locked for 30 more days, then closes the room", () => {
    const closesAt = paidUntil + (BAND_GRACE_DAYS + BAND_LOCKED_DAYS) * DAY;
    assert.equal(bandStateFrom(paidUntil, closesAt - 1), "locked");
    assert.equal(bandStateFrom(paidUntil, closesAt), "closed");
  });

  it("opens again when a late payment moves paid_until forward", () => {
    const now = paidUntil + 10 * DAY;
    assert.equal(bandStateFrom(paidUntil, now), "locked");
    assert.equal(bandStateFrom(addMonth(now), now), "active");
  });
});

describe("osloDate", () => {
  it("uses the Norwegian calendar day, not the UTC one", () => {
    // 23:30 UTC is 00:30 the next day in Oslo (CET, winter).
    assert.equal(osloDate(at("2026-11-18T23:30:00Z")), "2026-11-19");
    assert.equal(osloDate(at("2026-11-18T22:30:00Z")), "2026-11-18");
  });

  it("handles summer time", () => {
    // 22:30 UTC is 00:30 the next day in Oslo (CEST, summer).
    assert.equal(osloDate(at("2026-07-10T22:30:00Z")), "2026-07-11");
    assert.equal(osloDate(at("2026-07-10T21:30:00Z")), "2026-07-10");
  });
});

describe("dueDateFor", () => {
  it("is the day before the period ends", () => {
    assert.equal(
      dueDateFor(at("2026-11-20T10:00:00Z"), at("2026-11-16T04:00:00Z")),
      "2026-11-19",
    );
  });

  it("counts the day in Norwegian time", () => {
    // The period ends 00:30 on 20 Nov in Oslo, so the day before is the 19th.
    assert.equal(
      dueDateFor(at("2026-11-19T23:30:00Z"), at("2026-11-16T04:00:00Z")),
      "2026-11-19",
    );
  });

  it("is never earlier than tomorrow (Vipps rejects today and the past)", () => {
    const now = at("2026-11-20T04:00:00Z");
    assert.equal(dueDateFor(at("2026-11-20T10:00:00Z"), now), "2026-11-21");
    assert.equal(dueDateFor(at("2026-11-01T10:00:00Z"), now), "2026-11-21");
  });

  it("works across the autumn clock change", () => {
    assert.equal(
      dueDateFor(at("2026-10-26T00:00:00Z"), at("2026-10-22T04:00:00Z")),
      "2026-10-25",
    );
  });
});

describe("addMonth", () => {
  it("adds a calendar month", () => {
    assert.equal(
      addMonth(at("2026-10-20T10:00:00Z")),
      at("2026-11-20T10:00:00Z"),
    );
  });

  it("clamps to the end of a shorter month", () => {
    assert.equal(
      addMonth(at("2026-01-31T10:00:00Z")),
      at("2026-02-28T10:00:00Z"),
    );
    assert.equal(
      addMonth(at("2028-01-31T10:00:00Z")),
      at("2028-02-29T10:00:00Z"),
    );
    assert.equal(
      addMonth(at("2026-03-31T10:00:00Z")),
      at("2026-04-30T10:00:00Z"),
    );
  });

  it("rolls over the year", () => {
    assert.equal(
      addMonth(at("2026-12-15T10:00:00Z")),
      at("2027-01-15T10:00:00Z"),
    );
  });
});

describe("nextPaidUntil", () => {
  const periodStart = at("2026-11-20T10:00:00Z");

  it("starts the month at the payment for a first payment", () => {
    const paid = at("2026-10-20T12:00:00Z");
    assert.equal(nextPaidUntil(paid), at("2026-11-20T12:00:00Z"));
  });

  it("continues seamlessly when a renewal arrives before the period ends", () => {
    const paid = periodStart - DAY;
    assert.equal(nextPaidUntil(paid, periodStart), addMonth(periodStart));
  });

  it("still counts as on time up to a day after the period start", () => {
    assert.equal(
      nextPaidUntil(periodStart + DAY, periodStart),
      addMonth(periodStart),
    );
  });

  it("starts a fresh month from the payment when it is late", () => {
    const paid = periodStart + DAY + 1;
    assert.equal(nextPaidUntil(paid, periodStart), addMonth(paid));
  });
});

describe("fanSubscriptionState", () => {
  const now = at("2026-11-10T12:00:00Z");
  const future = now + 5 * DAY;
  const past = now - 5 * DAY;

  it("is pending before the first payment", () => {
    assert.equal(
      fanSubscriptionState(
        { status: "PENDING", paidUntil: null, bandState: "active" },
        now,
      ),
      "pending",
    );
  });

  it("is ended if an agreement never got paid", () => {
    assert.equal(
      fanSubscriptionState(
        { status: "EXPIRED", paidUntil: null, bandState: "active" },
        now,
      ),
      "ended",
    );
  });

  it("is active when paid and renewing", () => {
    assert.equal(
      fanSubscriptionState(
        { status: "ACTIVE", paidUntil: future, bandState: "active" },
        now,
      ),
      "active",
    );
  });

  it("is cancelling when stopped but still paid", () => {
    assert.equal(
      fanSubscriptionState(
        { status: "STOPPED", paidUntil: future, bandState: "active" },
        now,
      ),
      "cancelling",
    );
  });

  it("is payment_failed when it should have renewed but did not", () => {
    assert.equal(
      fanSubscriptionState(
        { status: "ACTIVE", paidUntil: past, bandState: "active" },
        now,
      ),
      "payment_failed",
    );
  });

  it("is ended when a cancelled month has run out", () => {
    assert.equal(
      fanSubscriptionState(
        { status: "STOPPED", paidUntil: past, bandState: "active" },
        now,
      ),
      "ended",
    );
  });

  it("is room_closed when the band has stopped paying", () => {
    assert.equal(
      fanSubscriptionState(
        { status: "ACTIVE", paidUntil: future, bandState: "closed" },
        now,
      ),
      "room_closed",
    );
  });

  it("keeps listening while the band is only locked", () => {
    assert.equal(
      fanSubscriptionState(
        { status: "ACTIVE", paidUntil: future, bandState: "locked" },
        now,
      ),
      "active",
    );
  });
});
