import { describe, expect, it } from "vitest";
import {
  appendMove,
  parseGameState,
  replayGame,
  resignGame,
  summarizeGame,
  type GameSession,
  type GameState,
} from "./gameState";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const FOOLS_MATE_STATE: GameState = {
  version: 1,
  startFen: START_FEN,
  playerColor: "white",
  difficulty: "medium",
  moves: ["f2f3", "e7e5", "g2g4", "d8h4"],
  resigned: false,
};

/** Returns a replayed session, failing the test on any error. */
const replayOrThrow = (state: GameState): GameSession => {
  const result = replayGame(state);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
};

describe("parseGameState", () => {
  it("accepts the example state from the brief", () => {
    expect(parseGameState(FOOLS_MATE_STATE)).toEqual({ ok: true, value: FOOLS_MATE_STATE });
  });

  it.each([
    ["a version other than 1", { ...FOOLS_MATE_STATE, version: 2 }],
    ["an unknown difficulty", { ...FOOLS_MATE_STATE, difficulty: "impossible" }],
    ["an unknown player colour", { ...FOOLS_MATE_STATE, playerColor: "red" }],
    ["moves that are not an array", { ...FOOLS_MATE_STATE, moves: "e2e4" }],
    ["a move that is not UCI", { ...FOOLS_MATE_STATE, moves: ["e2-e4"] }],
    ["a resigned flag that is not boolean", { ...FOOLS_MATE_STATE, resigned: "no" }],
    ["an invalid start FEN", { ...FOOLS_MATE_STATE, startFen: "not a fen" }],
    ["a missing field", { version: 1, startFen: START_FEN }],
    ["null", null],
    ["an array", [FOOLS_MATE_STATE]],
  ])("rejects %s", (_name, value) => {
    expect(parseGameState(value).ok).toBe(false);
  });
});

describe("replayGame", () => {
  it("replays the example and reports checkmate with SAN for each move", () => {
    const session = replayOrThrow(FOOLS_MATE_STATE);
    expect(session.moveRecords.map((record) => record.san)).toEqual(["f3", "e5", "g4", "Qh4#"]);
    expect(session.outcome).toEqual({ kind: "checkmate", winner: "black" });
    expect(session.positions).toHaveLength(5);
  });

  it("names the first illegal move by its number", () => {
    const result = replayGame({ ...FOOLS_MATE_STATE, moves: ["f2f3", "e7e5", "g2g5"] });
    expect(result).toEqual({ ok: false, error: "Move 3 (g2g5) is not legal" });
  });

  it("rejects moves that follow a finished game", () => {
    const result = replayGame({ ...FOOLS_MATE_STATE, moves: [...FOOLS_MATE_STATE.moves, "a2a3"] });
    expect(result.ok).toBe(false);
  });

  it("rejects a start position whose side not to move is in check", () => {
    const result = replayGame({ ...FOOLS_MATE_STATE, startFen: "4k3/8/8/8/8/8/8/r3K3 b - - 0 1", moves: [] });
    expect(result.ok).toBe(false);
  });
});

describe("appendMove", () => {
  it("adds a legal move and keeps the old session intact", () => {
    const session = replayOrThrow({ ...FOOLS_MATE_STATE, moves: [] });
    const next = appendMove(session, "e2e4");
    expect(next.ok && next.value.state.moves).toEqual(["e2e4"]);
    expect(session.state.moves).toEqual([]);
  });

  it("returns an error and leaves the session unchanged for an illegal move", () => {
    const session = replayOrThrow({ ...FOOLS_MATE_STATE, moves: [] });
    const next = appendMove(session, "e2e5");
    expect(next.ok).toBe(false);
    expect(session.state.moves).toEqual([]);
  });
});

describe("resignGame and summarizeGame", () => {
  it("makes the opponent the winner when the human resigns", () => {
    const session = resignGame(replayOrThrow({ ...FOOLS_MATE_STATE, moves: ["e2e4"] }));
    expect(session.outcome).toEqual({ kind: "resigned", winner: "black" });
    expect(summarizeGame(session)).toEqual({ result: "0-1", moveCount: 1 });
  });

  it("uses 1/2-1/2 for a draw and * while the game is ongoing", () => {
    const ongoing = replayOrThrow({ ...FOOLS_MATE_STATE, moves: ["e2e4"] });
    expect(summarizeGame(ongoing).result).toBe("*");
    const draw = replayOrThrow({ version: 1, startFen: "4k3/8/8/8/8/8/8/4K3 w - - 0 1", playerColor: "white", difficulty: "easy", moves: [], resigned: false });
    expect(summarizeGame(draw).result).toBe("1/2-1/2");
  });
});

describe("export and import", () => {
  it("round-trips a game through JSON without changing it", () => {
    const session = replayOrThrow(FOOLS_MATE_STATE);
    const imported = parseGameState(JSON.parse(JSON.stringify(session.state)));
    expect(imported.ok && imported.value).toEqual(FOOLS_MATE_STATE);
  });
});
