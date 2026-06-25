// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScaleNet } from "#/components/galaxy/ScaleNet";
import { en } from "#/lib/i18n/messages/en";

describe("ScaleNet — the tier-aware bottom-left range rings (spec §5.3)", () => {
  it("renders the Local-Group labels: 200k ly · 1 Mly · 2.5 Mly", () => {
    render(<ScaleNet tier="localGroup" label={en.scaleNet.label} />);
    expect(screen.getByText("200k ly")).toBeTruthy();
    expect(screen.getByText("1 Mly")).toBeTruthy();
    expect(screen.getByText("2.5 Mly")).toBeTruthy();
  });

  it("relabels to the Milky-Way disk scale: 10k ly · 50k ly · 100k ly", () => {
    render(<ScaleNet tier="galaxy" label={en.scaleNet.label} />);
    expect(screen.getByText("10k ly")).toBeTruthy();
    expect(screen.getByText("50k ly")).toBeTruthy();
    expect(screen.getByText("100k ly")).toBeTruthy();
  });

  it("snaps labels on tier change (re-render swaps LG → MW labels, no LG residue)", () => {
    const { rerender } = render(
      <ScaleNet tier="localGroup" label={en.scaleNet.label} />,
    );
    expect(screen.getByText("2.5 Mly")).toBeTruthy();
    rerender(<ScaleNet tier="galaxy" label={en.scaleNet.label} />);
    expect(screen.getByText("100k ly")).toBeTruthy();
    expect(screen.queryByText("2.5 Mly")).toBeNull();
  });

  it("carries the accessible name (it's a decorative display-only device)", () => {
    render(<ScaleNet tier="galaxy" label={en.scaleNet.label} />);
    expect(screen.getByRole("img", { name: en.scaleNet.label })).toBeTruthy();
  });

  it("renders one concentric ring per label (three circles)", () => {
    const { container } = render(
      <ScaleNet tier="galaxy" label={en.scaleNet.label} />,
    );
    expect(container.querySelectorAll("circle")).toHaveLength(3);
  });

  it("is display-only — no interactive controls, no pointer capture", () => {
    const { container } = render(
      <ScaleNet tier="galaxy" label={en.scaleNet.label} />,
    );
    expect(container.querySelector("button")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector('[role="button"]')).toBeNull();
  });

  it("relabels to the AU ladder at the Solar-System tier: 1 AU · 5 AU · 30 AU (ADR-0016 §2)", () => {
    render(<ScaleNet tier="solarSystem" label={en.scaleNet.label} />);
    expect(screen.getByText("1 AU")).toBeTruthy();
    expect(screen.getByText("5 AU")).toBeTruthy();
    expect(screen.getByText("30 AU")).toBeTruthy();
  });
});
