import { describe, expect, it } from "vitest";
import {
  type CardState,
  type CardTarget,
  cardReducer,
  resolveCardTarget,
} from "#/components/galaxy/card-model";
import { REAL_OBJECTS, SOL_ID } from "#/lib/galaxy/realdata";
import type { MemoryStar } from "#/lib/galaxy/types";

const sol = REAL_OBJECTS.find((o) => o.id === SOL_ID) as CardTarget;
const andromeda = REAL_OBJECTS.find((o) => o.id === "andromeda") as CardTarget;

const memoryStar: MemoryStar = {
  id: "s01",
  text: "dad dancing badly in the kitchen.",
  name: "kitchen radio",
  mood: "joyful",
  who: "marco",
  color: "#f0c987",
  r: 0.5,
  angle: 0.2,
  brightness: 0.7,
  createdAt: 1748000000000,
  group: "bright-days",
};

const mom: MemoryStar = {
  id: "irina",
  text: "a whole life, lived right here on the third stone from this star.",
  name: "for mom",
  mood: "nostalgic",
  who: null,
  color: "#f5d6a0",
  r: 0.366,
  angle: 0.423,
  brightness: 1,
  createdAt: 1700000000000,
  deep: true,
};

describe("resolveCardTarget — real object → lore skin, memory star → memory skin", () => {
  it("resolves a RealObject (Sol) to a lore card carrying its loreKey + real distance", () => {
    const vm = resolveCardTarget(sol);
    expect(vm.skin).toBe("lore");
    if (vm.skin !== "lore") throw new Error("expected lore");
    expect(vm.id).toBe(SOL_ID);
    expect(vm.loreKey).toBe("sol");
    expect(vm.realDistance).toEqual({ value: 26000, unit: "ly" });
  });

  it("resolves another RealObject (Andromeda) to a lore card with its own loreKey", () => {
    const vm = resolveCardTarget(andromeda);
    expect(vm.skin).toBe("lore");
    if (vm.skin !== "lore") throw new Error("expected lore");
    expect(vm.loreKey).toBe("andromeda");
  });

  it("resolves a MemoryStar to a memory card carrying its text + mood + name", () => {
    const vm = resolveCardTarget(memoryStar);
    expect(vm.skin).toBe("memory");
    if (vm.skin !== "memory") throw new Error("expected memory");
    expect(vm.id).toBe("s01");
    expect(vm.text).toBe(memoryStar.text);
    expect(vm.mood).toBe("joyful");
    expect(vm.name).toBe("kitchen radio");
    expect(vm.color).toBe("#f0c987");
  });

  it("carries attribution (`who`) when present and omits it when anonymous", () => {
    expect(
      (() => {
        const vm = resolveCardTarget(memoryStar);
        return vm.skin === "memory" ? vm.who : undefined;
      })(),
    ).toBe("marco");
    expect(
      (() => {
        const vm = resolveCardTarget(mom);
        return vm.skin === "memory" ? vm.who : undefined;
      })(),
    ).toBeNull();
  });

  it("uses the discriminant (loreKey vs mood), not identity — every RealObject is lore", () => {
    for (const o of REAL_OBJECTS) {
      expect(resolveCardTarget(o).skin).toBe("lore");
    }
  });

  it("gives a stable, deep-linkable id on both skins", () => {
    expect(resolveCardTarget(sol).id).toBe(sol.id);
    expect(resolveCardTarget(mom).id).toBe("irina");
  });
});

const closed: CardState = { target: null };

describe("cardReducer — open / close / one-at-a-time (pure state machine)", () => {
  it("starts closed (no target)", () => {
    expect(closed.target).toBeNull();
  });

  it("open sets the clicked target", () => {
    const next = cardReducer(closed, { type: "open", target: sol });
    expect(next.target).toBe(sol);
  });

  it("close clears the target", () => {
    const open = cardReducer(closed, { type: "open", target: sol });
    expect(cardReducer(open, { type: "close" }).target).toBeNull();
  });

  it("opening a second target REPLACES the first — one card at a time", () => {
    const first = cardReducer(closed, { type: "open", target: sol });
    const second = cardReducer(first, { type: "open", target: memoryStar });
    expect(second.target).toBe(memoryStar);
  });

  it("close on an already-closed state is a no-op (idempotent)", () => {
    expect(cardReducer(closed, { type: "close" })).toEqual(closed);
  });

  it("never mutates the previous state object", () => {
    const open = cardReducer(closed, { type: "open", target: sol });
    cardReducer(open, { type: "close" });
    expect(open.target).toBe(sol);
  });
});
