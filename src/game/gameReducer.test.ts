import { describe, expect, it } from "vitest";
import { gameReducer, initialAppState, type AppState } from "./gameReducer";
import { createNewState, replayGame, type GameSession } from "./gameState";

const freshSession = (): GameSession => {
  const result = replayGame(createNewState("white", "easy"));
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
};

const startedState = (): AppState => gameReducer(initialAppState, { type: "start" });

describe("gameReducer", () => {
  it("starts a game with the chosen colour and difficulty", () => {
    const state = gameReducer(
      gameReducer(initialAppState, { type: "setup-color", color: "black" }),
      { type: "setup-difficulty", difficulty: "hard" },
    );
    const started = gameReducer(state, { type: "start" });
    expect(started.session?.state.playerColor).toBe("black");
    expect(started.session?.state.difficulty).toBe("hard");
    expect(started.viewPly).toBe(0);
  });

  it("applies a legal human move and moves the view to the end", () => {
    const next = gameReducer(startedState(), { type: "move", uci: "e2e4" });
    expect(next.session?.state.moves).toEqual(["e2e4"]);
    expect(next.viewPly).toBe(1);
  });

  it("refuses an illegal move and shows a notice without changing the game", () => {
    const before = startedState();
    const after = gameReducer(before, { type: "move", uci: "e2e5" });
    expect(after.session?.state.moves).toEqual([]);
    expect(after.notice).not.toBeNull();
  });

  it("ignores an engine move that belongs to an earlier game", () => {
    const before = startedState();
    const after = gameReducer(before, { type: "engine-move", generation: before.generation - 1, uci: "e7e5" });
    expect(after).toEqual(before);
  });

  it("applies an engine move for the current game", () => {
    const withEngineTurn = gameReducer(startedState(), { type: "engine-started" });
    const after = gameReducer(withEngineTurn, { type: "engine-move", generation: withEngineTurn.generation, uci: "e2e4" });
    expect(after.session?.state.moves).toEqual(["e2e4"]);
    expect(after.thinking).toBe(false);
  });

  it("only moves the view when navigating, and keeps the game intact", () => {
    const played = gameReducer(startedState(), { type: "move", uci: "e2e4" });
    const viewed = gameReducer(played, { type: "navigate", ply: 0 });
    expect(viewed.viewPly).toBe(0);
    expect(viewed.session?.state.moves).toEqual(["e2e4"]);
  });

  it("resumes from an earlier ply by discarding the moves after it", () => {
    const played = gameReducer(gameReducer(startedState(), { type: "move", uci: "e2e4" }), { type: "move", uci: "e7e5" });
    const navigated = gameReducer(played, { type: "navigate", ply: 1 });
    const resumed = gameReducer(navigated, { type: "resume" });
    expect(resumed.session?.state.moves).toEqual(["e2e4"]);
    expect(resumed.viewPly).toBe(1);
    expect(resumed.generation).toBe(navigated.generation + 1);
  });

  it("loads a session and jumps to its last position", () => {
    const loaded = gameReducer(startedState(), { type: "load", session: freshSession() });
    expect(loaded.viewPly).toBe(0);
    expect(loaded.generation).toBeGreaterThan(startedState().generation);
  });

  it("marks the human as resigned", () => {
    const after = gameReducer(startedState(), { type: "resign" });
    expect(after.session?.outcome).toEqual({ kind: "resigned", winner: "black" });
  });
});

describe("importGame", () => {
  it("accepts the example save from the brief", async () => {
    const { importGameText } = await import("./importGame");
    const example = JSON.stringify({
      version: 1,
      startFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      playerColor: "white",
      difficulty: "medium",
      moves: ["f2f3", "e7e5", "g2g4", "d8h4"],
      resigned: false,
    });
    const result = importGameText(example);
    expect(result.ok && result.value.outcome).toEqual({ kind: "checkmate", winner: "black" });
  });

  it("rejects text that is not JSON", async () => {
    const { importGameText } = await import("./importGame");
    expect(importGameText("{not json").ok).toBe(false);
  });
});
