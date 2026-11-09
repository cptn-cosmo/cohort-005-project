export const REFUND_WINDOW_DAYS = 14;
export const REFUND_WATCH_LIMIT_SECONDS = 2 * 60 * 60;
export const REFUND_COMPLETION_LIMIT = 0.5;

export type RefundIneligibility =
  | "already_refunded"
  | "pending_request"
  | "claimed_team_seat"
  | "window_closed"
  | "completed_too_much"
  | "watched_too_much";

export type RefundEligibility =
  | { eligible: true; maxRefund: number; lastDayInWindow: string }
  | { eligible: false; reason: RefundIneligibility };

/** Everything about a purchase that decides whether a Refund Request may be made. */
export interface RefundFacts {
  purchasedAt: string;
  amountPaid: number;
  hasRefund: boolean;
  hasPendingRequest: boolean;
  hasClaimedTeamSeat: boolean;
  lessonCount: number;
  completedLessonCount: number;
  secondsWatched: number;
}

// Compare whole days, not hours — a purchase at 23:00 should still get its
// full fourteenth day.
export function asDayString(when: Date): string {
  const year = when.getFullYear();
  const month = String(when.getMonth() + 1).padStart(2, "0");
  const day = String(when.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function lastDayOfRefundWindow(purchasedAt: string): string {
  const windowEnd = new Date(purchasedAt);
  windowEnd.setDate(windowEnd.getDate() + REFUND_WINDOW_DAYS);
  return asDayString(windowEnd);
}

/**
 * Whether a Learner may make a Refund Request on this purchase right now.
 * Judged when the Learner submits — an Admin does not re-check it later.
 * The Refund itself can be any amount up to `maxRefund`.
 */
export function assessRefundEligibility(
  facts: RefundFacts,
  now: Date
): RefundEligibility {
  if (facts.hasRefund) return { eligible: false, reason: "already_refunded" };
  if (facts.hasPendingRequest) {
    return { eligible: false, reason: "pending_request" };
  }
  if (facts.hasClaimedTeamSeat) {
    return { eligible: false, reason: "claimed_team_seat" };
  }

  const today = asDayString(now);
  const purchasedDay = asDayString(new Date(facts.purchasedAt));
  const lastDayInWindow = lastDayOfRefundWindow(facts.purchasedAt);

  if (today < purchasedDay || today > lastDayInWindow) {
    return { eligible: false, reason: "window_closed" };
  }

  if (
    facts.lessonCount > 0 &&
    facts.completedLessonCount / facts.lessonCount >= REFUND_COMPLETION_LIMIT
  ) {
    return { eligible: false, reason: "completed_too_much" };
  }

  if (facts.secondsWatched >= REFUND_WATCH_LIMIT_SECONDS) {
    return { eligible: false, reason: "watched_too_much" };
  }

  return { eligible: true, maxRefund: facts.amountPaid, lastDayInWindow };
}
