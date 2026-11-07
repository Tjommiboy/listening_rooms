import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canEditPayoutDetails,
  effectiveOrderStatus,
  formatBankAccount,
  formatOrgNumber,
  isValidBankAccount,
  isValidOrgNumber,
  maskBankAccount,
  namesMatch,
  orgProblem,
  payoutSteps,
  shouldRefreshOrder,
  VIPPS_REFRESH_MS,
  type PayoutSetup,
} from "../lib/payout-rules.ts";

const DAY = 86_400_000;

describe("isValidOrgNumber", () => {
  it("accepts a real organisation number, with or without spaces", () => {
    assert.equal(isValidOrgNumber("923609016"), true);
    assert.equal(isValidOrgNumber("923 609 016"), true);
  });
  it("refuses a wrong check digit, wrong length and junk", () => {
    assert.equal(isValidOrgNumber("923609017"), false);
    assert.equal(isValidOrgNumber("92360901"), false);
    assert.equal(isValidOrgNumber("abc"), false);
    assert.equal(isValidOrgNumber(923609016), false);
  });
});

describe("isValidBankAccount", () => {
  it("accepts a valid account number, with dots or spaces", () => {
    assert.equal(isValidBankAccount("86011117947"), true);
    assert.equal(isValidBankAccount("8601.11.17947"), true);
  });
  it("refuses a wrong check digit and wrong length", () => {
    assert.equal(isValidBankAccount("86011117948"), false);
    assert.equal(isValidBankAccount("8601111794"), false);
  });
});

describe("formatting", () => {
  it("groups the digits the Norwegian way", () => {
    assert.equal(formatOrgNumber("923609016"), "923 609 016");
    assert.equal(formatBankAccount("86011117947"), "8601 11 17947");
  });
  it("shows only the last five digits of an account", () => {
    assert.equal(maskBankAccount("86011117947"), "•••• •• 17947");
    assert.equal(maskBankAccount("123"), "");
  });
});

describe("orgProblem", () => {
  const org = {
    name: "Kari Nordmann",
    form: "ENK",
    ownerName: "Kari Nordmann",
    deleted: false,
    bankrupt: false,
    windingUp: false,
  };
  it("is fine for an active organisation", () => {
    assert.equal(orgProblem(org), null);
  });
  it("names the problem for a deleted, bankrupt or closing one", () => {
    assert.equal(orgProblem({ ...org, deleted: true }), "deleted");
    assert.equal(orgProblem({ ...org, bankrupt: true }), "bankrupt");
    assert.equal(orgProblem({ ...org, windingUp: true }), "winding_up");
  });
});

describe("namesMatch", () => {
  it("matches first and last name, ignoring case and middle names", () => {
    assert.equal(namesMatch("Kari Nordmann", "KARI SOFIE NORDMANN"), true);
  });
  it("warns when the names differ", () => {
    assert.equal(namesMatch("Ola Hansen", "Kari Nordmann"), false);
  });
  it("doesn't warn when a name is missing", () => {
    assert.equal(namesMatch(null, "Kari Nordmann"), true);
    assert.equal(namesMatch("Kari", null), true);
  });
});

describe("Vipps order status", () => {
  it("counts an untouched order as expired after 14 days", () => {
    assert.equal(effectiveOrderStatus("RECEIVED", 0, 15 * DAY), "EXPIRED");
    assert.equal(effectiveOrderStatus("RECEIVED", 0, 13 * DAY), "RECEIVED");
  });
  it("never expires a submitted order on its own", () => {
    assert.equal(
      effectiveOrderStatus("ORDER_SUBMITTED", 0, 40 * DAY),
      "ORDER_SUBMITTED",
    );
  });
  it("asks Vipps again only for open orders, at most every few minutes", () => {
    assert.equal(shouldRefreshOrder("RECEIVED", null, 0), true);
    assert.equal(shouldRefreshOrder("RECEIVED", 0, VIPPS_REFRESH_MS - 1), false);
    assert.equal(shouldRefreshOrder("ORDER_SUBMITTED", 0, VIPPS_REFRESH_MS), true);
    assert.equal(shouldRefreshOrder("COMPLETED", null, 0), false);
  });
  it("locks org number and bank account once Vipps has the application", () => {
    assert.equal(canEditPayoutDetails(null), true);
    assert.equal(canEditPayoutDetails("MERCHANT_VIEWED"), true);
    assert.equal(canEditPayoutDetails("ORDER_SUBMITTED"), false);
    assert.equal(canEditPayoutDetails("COMPLETED"), false);
  });
});

describe("payoutSteps", () => {
  const empty: PayoutSetup = {
    orgNumber: null,
    orgOk: false,
    payoutAccount: null,
    orderStatus: null,
    msn: null,
    liveApproved: false,
  };
  it("starts at the org number", () => {
    assert.deepEqual(payoutSteps(empty), {
      org: "todo",
      bank: "todo",
      vipps: "todo",
      live: "todo",
      current: 1,
    });
  });
  it("flags an org number Brønnøysund won't accept", () => {
    assert.equal(payoutSteps({ ...empty, orgNumber: "923609016" }).org, "problem");
  });
  it("waits while Vipps handles the application", () => {
    const s = payoutSteps({
      ...empty,
      orgNumber: "923609016",
      orgOk: true,
      payoutAccount: "86011117947",
      orderStatus: "ORDER_SUBMITTED",
    });
    assert.equal(s.vipps, "waiting");
    assert.equal(s.current, 3);
  });
  it("lets the band start again after a rejected or expired application", () => {
    const base = { ...empty, orgNumber: "1", orgOk: true, payoutAccount: "1" };
    assert.equal(payoutSteps({ ...base, orderStatus: "REJECTED" }).vipps, "problem");
    assert.equal(payoutSteps({ ...base, orderStatus: "EXPIRED" }).vipps, "todo");
  });
  it("waits for approval once Vipps is done, then is complete", () => {
    const base = {
      ...empty,
      orgNumber: "1",
      orgOk: true,
      payoutAccount: "1",
      orderStatus: "COMPLETED" as const,
      msn: "123456",
    };
    assert.equal(payoutSteps(base).live, "waiting");
    assert.equal(payoutSteps(base).current, 4);
    assert.equal(payoutSteps({ ...base, liveApproved: true }).current, 5);
  });
});
