import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import nb from "../../../messages/nb";
import { HIDDEN_CARD, type SupportCardState } from "./types";
import { SupportCards } from "./support-cards";

const states: Record<string, SupportCardState> = {};
const card = (name: string, urgent = false): SupportCardState => ({
  visible: true,
  urgent,
  element: <p>{name}</p>,
});

vi.mock("./handover-card", () => ({ useHandoverCard: () => states.handover ?? HIDDEN_CARD }));
vi.mock("./health-hints-card", () => ({
  useHealthHintsCards: () => ({
    urgent: states.hintsUrgent ?? HIDDEN_CARD,
    regular: states.hints ?? HIDDEN_CARD,
  }),
}));
vi.mock("./timer-fix-card", () => ({
  useTimerFixCards: () => ({
    urgent: states.timerUrgent ?? HIDDEN_CARD,
    regular: states.timer ?? HIDDEN_CARD,
  }),
}));
vi.mock("./medicine-status-card", () => ({ useMedicineStatusCard: () => states.medicine ?? HIDDEN_CARD }));
vi.mock("./whats-next-card", () => ({ useWhatsNextCard: () => states.next ?? HIDDEN_CARD }));
vi.mock("./weekly-tip-card", () => ({ useWeeklyTipCard: () => states.tip ?? HIDDEN_CARD }));
vi.mock("./wellbeing-card", () => ({ useWellbeingCard: () => states.wellbeing ?? HIDDEN_CARD }));

function renderCards() {
  return render(
    <NextIntlClientProvider locale="nb" messages={nb} timeZone="Europe/Oslo">
      <SupportCards childId="c1" birthDate={new Date("2025-08-15T00:00:00Z")} />
    </NextIntlClientProvider>
  );
}

/** The text of the cards in page order */
const order = () => Array.from(document.querySelectorAll("p")).map((p) => p.textContent);

describe("SupportCards", () => {
  beforeEach(() => {
    for (const key of Object.keys(states)) delete states[key];
  });

  it("renders nothing when no card has anything to show", () => {
    const { container } = renderCards();
    // The empty list element is hidden by CSS (empty:hidden)
    expect(container.firstElementChild).toBeEmptyDOMElement();
    expect(container.firstElementChild).toHaveClass("empty:hidden");
  });

  it("puts urgent cards first, then the others in the fixed order", () => {
    Object.assign(states, {
      tip: card("tip"),
      hints: card("hints"),
      next: card("next"),
      medicine: card("medicine"),
      timer: card("timer"),
      handover: card("handover"),
      timerUrgent: card("timerUrgent", true),
      hintsUrgent: card("hintsUrgent", true),
    });
    renderCards();

    expect(order()).toEqual(["hintsUrgent", "timerUrgent", "handover", "timer", "medicine", "tip"]);
    expect(screen.getByRole("button", { name: "Vis 2 til" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });

  it("shows at most three non-urgent cards and reveals the rest on request", () => {
    Object.assign(states, {
      handover: card("handover"),
      timer: card("timer"),
      medicine: card("medicine"),
      next: card("next"),
      hints: card("hints"),
      wellbeing: card("wellbeing"),
      tip: card("tip"),
    });
    renderCards();

    // The soft card goes last; only the first soft card with something to show is kept
    expect(order()).toEqual(["handover", "timer", "medicine", "wellbeing"]);

    fireEvent.click(screen.getByRole("button", { name: "Vis 2 til" }));
    expect(order()).toEqual(["handover", "timer", "medicine", "next", "hints", "wellbeing"]);

    fireEvent.click(screen.getByRole("button", { name: "Vis færre" }));
    expect(order()).toEqual(["handover", "timer", "medicine", "wellbeing"]);
  });

  it("does not count urgent or soft cards against the limit, and has no toggle for three", () => {
    Object.assign(states, {
      hintsUrgent: card("hintsUrgent", true),
      timerUrgent: card("timerUrgent", true),
      handover: card("handover"),
      timer: card("timer"),
      next: card("next"),
      tip: card("tip"),
    });
    renderCards();

    expect(order()).toEqual(["hintsUrgent", "timerUrgent", "handover", "timer", "next", "tip"]);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows the weekly tip when the wellbeing card has nothing to ask", () => {
    states.tip = card("tip");
    renderCards();
    expect(order()).toEqual(["tip"]);
  });

  it("renders the overlay of a card that is not in the list", () => {
    states.timer = { visible: false, urgent: false, element: null, overlay: <p>dialog</p> };
    renderCards();
    expect(order()).toEqual(["dialog"]);
  });
});
