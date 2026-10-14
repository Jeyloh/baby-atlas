import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import nb from "../../../messages/nb";
import type { SupportData } from "@/lib/support/support-data";
import { HealthHintsCard } from "./health-hints-card";
import { WhatsNextCard } from "./whats-next-card";

const NOW = new Date("2026-01-15T11:00:00Z");
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);

let data: SupportData | undefined;

vi.mock("@/hooks/use-support-data", () => ({
  useSupportData: () => data,
  useNow: () => NOW,
}));

function emptyData(overrides: Partial<SupportData> = {}): SupportData {
  return {
    feeds: [],
    sleeps: [],
    diapers: [],
    temperatures: [],
    feedingActive: false,
    sleepActive: false,
    ...overrides,
  };
}

function renderCard(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="nb" messages={nb} timeZone="Europe/Oslo">
      {ui}
    </NextIntlClientProvider>
  );
}

const TWO_MONTHS_OLD = new Date("2025-11-10T00:00:00Z");
const FIVE_MONTHS_OLD = new Date("2025-08-15T00:00:00Z");

describe("HealthHintsCard", () => {
  beforeEach(() => {
    data = undefined;
  });

  it("renders nothing without data or hints", () => {
    const { container } = renderCard(<HealthHintsCard childId="c1" birthDate={TWO_MONTHS_OLD} />);
    expect(container).toBeEmptyDOMElement();

    data = emptyData();
    const second = renderCard(<HealthHintsCard childId="c1" birthDate={TWO_MONTHS_OLD} />);
    expect(second.container).toBeEmptyDOMElement();
  });

  it("shows an urgent fever hint with contact links for a baby under 3 months", () => {
    data = emptyData({ temperatures: [{ id: "t1", time: ago(30), celsius: 38.4 }] });
    renderCard(<HealthHintsCard childId="c1" birthDate={TWO_MONTHS_OLD} />);

    expect(screen.getByText(/Feber på 38,4 °C/)).toBeInTheDocument();
    expect(screen.getByText(/Kontakt lege eller legevakten \(116 117\)/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /116 117/ })).toHaveAttribute("href", "tel:116117");
    expect(screen.getByRole("link", { name: /Ring 113/ })).toHaveAttribute("href", "tel:113");
    const more = screen.getByRole("link", { name: /Helsenorge/ });
    expect(more).toHaveAttribute("href", expect.stringContaining("helsenorge.no"));
  });

  it("names the real source in the link and says how the limits were measured", () => {
    const day10 = new Date("2026-01-05T00:00:00Z");
    data = emptyData({
      diapers: [
        { time: ago(60), diaperType: "WET" },
        { time: ago(180), diaperType: "WET" },
        { time: ago(300), diaperType: "DIRTY" },
        { time: ago(420), diaperType: "DIRTY" },
      ],
    });
    renderCard(<HealthHintsCard childId="c1" birthDate={day10} />);

    const link = screen.getByRole("link", { name: "Les mer hos Ammehjelpen" });
    expect(link).toHaveAttribute("href", "https://ammehjelpen.no/trotte-barn/");
    expect(screen.queryByRole("link", { name: /Helsenorge/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Grensene gjelder temperatur målt i endetarmen/)).toBeInTheDocument();
    expect(screen.getByText(/Det kan hende at ikke alle bleier er logget/)).toBeInTheDocument();
  });

  it("offers the 113 button for a very high fever too", () => {
    data = emptyData({ temperatures: [{ id: "t1", time: ago(30), celsius: 40.2 }] });
    renderCard(<HealthHintsCard childId="c1" birthDate={FIVE_MONTHS_OLD} />);

    expect(screen.getByRole("link", { name: /Ring 113/ })).toHaveAttribute("href", "tel:113");
  });

  it("hides a dismissed hint and remembers it on this device", () => {
    data = emptyData({ temperatures: [{ id: "t1", time: ago(30), celsius: 38.4 }] });
    const { container, unmount } = renderCard(
      <HealthHintsCard childId="c1" birthDate={TWO_MONTHS_OLD} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Skjul dette tipset" }));
    expect(container).toBeEmptyDOMElement();
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "baby-atlas-health-hints-dismissed:c1",
      expect.stringContaining("feverYoung:t1")
    );

    unmount();
    const again = renderCard(<HealthHintsCard childId="c1" birthDate={TWO_MONTHS_OLD} />);
    expect(again.container).toBeEmptyDOMElement();
  });
});

describe("WhatsNextCard", () => {
  beforeEach(() => {
    data = undefined;
  });

  it("renders nothing without data", () => {
    const { container } = renderCard(<WhatsNextCard childId="c1" birthDate={FIVE_MONTHS_OLD} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the next feed from the feeding rhythm", () => {
    // Feeds every 3 h, the last one 2.5 h ago: next in ~30 minutes
    data = emptyData({
      feeds: Array.from({ length: 5 }, (_, i) => ({
        id: `f${i}`,
        startTime: ago(150 + i * 180),
        endTime: null,
      })),
    });
    renderCard(<WhatsNextCard childId="c1" birthDate={FIVE_MONTHS_OLD} />);

    expect(screen.getByRole("heading", { name: "Hva skjer nå" })).toBeInTheDocument();
    expect(screen.getByText(/Neste måltid/)).toBeInTheDocument();
    expect(screen.getByText(/om ca\. 30 min/)).toBeInTheDocument();
  });

  it("shows the next nap when the child is awake", () => {
    data = emptyData({
      sleeps: [{ id: "s1", sleepType: "NAP", startTime: ago(150), endTime: ago(60) }],
    });
    renderCard(<WhatsNextCard childId="c1" birthDate={FIVE_MONTHS_OLD} />);

    expect(screen.getByText(/Neste lur/)).toBeInTheDocument();
    expect(screen.queryByText(/Neste måltid/)).not.toBeInTheDocument();
  });

  it("shows no nap while a sleep is running", () => {
    data = emptyData({
      sleeps: [{ id: "s1", sleepType: "NAP", startTime: ago(20), endTime: null }],
      sleepActive: true,
    });
    const { container } = renderCard(<WhatsNextCard childId="c1" birthDate={FIVE_MONTHS_OLD} />);
    expect(container).toBeEmptyDOMElement();
  });
});
