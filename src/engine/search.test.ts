import { describe, expect, it } from "vitest";
import { parseFen, type Position } from "./position";
import { chooseMove, SEARCH_LEVELS } from "./search";
import { moveToUci } from "./moveGen";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const loadFen = (fen: string): Position => {
  const result = parseFen(fen);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
};

describe("difficulty levels", () => {
  it("gives each level a deeper or longer search than the one below", () => {
    expect(SEARCH_LEVELS.easy.maxDepth).toBeLessThan(SEARCH_LEVELS.medium.maxDepth);
    expect(SEARCH_LEVELS.medium.maxDepth).toBeLessThan(SEARCH_LEVELS.hard.maxDepth);
    expect(SEARCH_LEVELS.hard.maxDepth).toBeLessThan(SEARCH_LEVELS.expert.maxDepth);
  });

  it("keeps every level inside the five second reply budget", () => {
    for (const level of Object.values(SEARCH_LEVELS)) {
      expect(level.timeLimitMs).toBeLessThanOrEqual(4000);
    }
  });
});

describe("chooseMove", () => {
  it("returns null when the side to move has no legal moves", () => {
    expect(chooseMove(loadFen("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"), "expert")).toBeNull();
  });

  it.each(["easy", "medium", "hard", "expert"] as const)("returns a legal move at %s from the start position", (difficulty) => {
    const pos = loadFen(START_FEN);
    const move = chooseMove(pos, difficulty);
    expect(move).not.toBeNull();
  });

  it.each(["medium", "hard", "expert"] as const)("finds mate in one at %s", (difficulty) => {
    const move = chooseMove(loadFen("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1"), difficulty);
    expect(move && moveToUci(move)).toBe("a1a8");
  });

  it.each(["medium", "hard", "expert"] as const)("takes a hanging queen at %s", (difficulty) => {
    const move = chooseMove(loadFen("4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1"), difficulty);
    expect(move && moveToUci(move)).toBe("d1d5");
  });

  it("finishes an expert search from the start position within the time budget", () => {
    const started = Date.now();
    chooseMove(loadFen(START_FEN), "expert");
    expect(Date.now() - started).toBeLessThan(5000);
  });
});
