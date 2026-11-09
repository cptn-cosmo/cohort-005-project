import { describe, it, expect } from "vitest";
import {
  assessRefundEligibility,
  REFUND_WATCH_LIMIT_SECONDS,
  type RefundFacts,
} from "./refund-requests";

const purchasedAt = new Date(2026, 10, 1, 23, 0).toISOString();

function facts(overrides: Partial<RefundFacts> = {}): RefundFacts {
  return {
    purchasedAt,
    amountPaid: 2000,
    hasRefund: false,
    hasPendingRequest: false,
    hasClaimedTeamSeat: false,
    lessonCount: 10,
    completedLessonCount: 0,
    secondsWatched: 0,
    ...overrides,
  };
}

const dayAfterPurchase = new Date(2026, 10, 2, 12, 0);

describe("assessRefundEligibility", () => {
  it("offers up to the amount actually paid", () => {
    expect(assessRefundEligibility(facts(), dayAfterPurchase)).toEqual({
      eligible: true,
      maxRefund: 2000,
      lastDayInWindow: "2026-11-15",
    });
  });

  it("counts the window in whole days, including the fourteenth", () => {
    const lateOnLastDay = new Date(2026, 10, 15, 23, 59);
    expect(assessRefundEligibility(facts(), lateOnLastDay).eligible).toBe(true);

    const dayAfterWindow = new Date(2026, 10, 16, 0, 1);
    expect(assessRefundEligibility(facts(), dayAfterWindow)).toEqual({
      eligible: false,
      reason: "window_closed",
    });
  });

  it("refuses once half the lessons are completed", () => {
    expect(
      assessRefundEligibility(
        facts({ completedLessonCount: 5 }),
        dayAfterPurchase
      )
    ).toEqual({ eligible: false, reason: "completed_too_much" });

    expect(
      assessRefundEligibility(
        facts({ completedLessonCount: 4 }),
        dayAfterPurchase
      ).eligible
    ).toBe(true);
  });

  it("refuses once the watch limit is reached", () => {
    expect(
      assessRefundEligibility(
        facts({ secondsWatched: REFUND_WATCH_LIMIT_SECONDS }),
        dayAfterPurchase
      )
    ).toEqual({ eligible: false, reason: "watched_too_much" });
  });

  it("refuses while another request is pending", () => {
    expect(
      assessRefundEligibility(
        facts({ hasPendingRequest: true }),
        dayAfterPurchase
      )
    ).toEqual({ eligible: false, reason: "pending_request" });
  });

  it("refuses a purchase that has already been refunded", () => {
    expect(
      assessRefundEligibility(facts({ hasRefund: true }), dayAfterPurchase)
    ).toEqual({ eligible: false, reason: "already_refunded" });
  });

  it("refuses a claimed team seat", () => {
    expect(
      assessRefundEligibility(
        facts({ hasClaimedTeamSeat: true }),
        dayAfterPurchase
      )
    ).toEqual({ eligible: false, reason: "claimed_team_seat" });
  });

  it("does not apply the completion limit to a course with no lessons", () => {
    expect(
      assessRefundEligibility(facts({ lessonCount: 0 }), dayAfterPurchase)
        .eligible
    ).toBe(true);
  });
});
