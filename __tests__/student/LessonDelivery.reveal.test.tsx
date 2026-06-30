import { describe, expect, it } from "vitest";
import {
  initialRevealState,
  revealReducer,
  type RevealState,
} from "@/components/student/ProblemRevealSection";

/**
 * Item 2 — reveal-answer is now toggleable, with a confirmation step before
 * the first reveal and a Hide control afterwards. The behaviour lives in a
 * pure reducer so it can be exercised in the node test environment (this repo
 * has no jsdom / @testing-library/react).
 */
describe("revealReducer", () => {
  it("starts hidden, unconfirmed and not revealed", () => {
    expect(initialRevealState).toEqual<RevealState>({
      confirming: false,
      revealed: false,
      visible: false,
    });
  });

  it("requestReveal shows the confirmation before revealing the answer", () => {
    const next = revealReducer(initialRevealState, { type: "requestReveal" });
    expect(next.confirming).toBe(true);
    expect(next.revealed).toBe(false);
    expect(next.visible).toBe(false);
  });

  it("cancel dismisses the confirmation without revealing", () => {
    const confirming = revealReducer(initialRevealState, { type: "requestReveal" });
    const next = revealReducer(confirming, { type: "cancel" });
    expect(next.confirming).toBe(false);
    expect(next.revealed).toBe(false);
    expect(next.visible).toBe(false);
  });

  it("confirm reveals and shows the answer", () => {
    const confirming = revealReducer(initialRevealState, { type: "requestReveal" });
    const next = revealReducer(confirming, { type: "confirm" });
    expect(next.confirming).toBe(false);
    expect(next.revealed).toBe(true);
    expect(next.visible).toBe(true);
  });

  it("hide collapses the answer but keeps it revealed", () => {
    const revealed = revealReducer(
      revealReducer(initialRevealState, { type: "requestReveal" }),
      { type: "confirm" }
    );
    const next = revealReducer(revealed, { type: "hide" });
    expect(next.visible).toBe(false);
    expect(next.revealed).toBe(true);
    expect(next.confirming).toBe(false);
  });

  it("show re-reveals after hiding without asking to confirm again", () => {
    const hidden = revealReducer(
      revealReducer(
        revealReducer(initialRevealState, { type: "requestReveal" }),
        { type: "confirm" }
      ),
      { type: "hide" }
    );
    const next = revealReducer(hidden, { type: "show" });
    expect(next.visible).toBe(true);
    expect(next.revealed).toBe(true);
    expect(next.confirming).toBe(false);
  });
});
