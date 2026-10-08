import { describe, expect, it, vi } from "vitest";
import { createBridgeListener, type BridgeHost, type BridgeSnapshot } from "./bridge";
import type { GameState } from "../game/gameState";

const ORIGIN = "https://site.example";
const SAMPLE_STATE: GameState = {
  version: 1,
  startFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  playerColor: "white",
  difficulty: "medium",
  moves: ["f2f3", "e7e5", "g2g4", "d8h4"],
  resigned: false,
};

/** Builds a host whose snapshot and load behaviour are supplied per test. */
const makeHost = (snapshot: BridgeSnapshot, loadResult: { ok: true } | { ok: false; error: string }): BridgeHost & { load: ReturnType<typeof vi.fn> } => {
  const load = vi.fn((_value: unknown) => loadResult);
  return {
    getSnapshot: () => snapshot,
    loadState: load,
    load,
  };
};

const setup = (host: BridgeHost) => {
  const parent = { postMessage: vi.fn() };
  const listener = createBridgeListener({ origin: ORIGIN, parent, host, post: (message) => parent.postMessage(message, ORIGIN) });
  const send = (data: unknown, overrides: { origin?: string; source?: unknown } = {}): void => {
    listener({ origin: overrides.origin ?? ORIGIN, source: "source" in overrides ? overrides.source : parent, data });
  };
  return { parent, send };
};

const EMPTY_SNAPSHOT: BridgeSnapshot = { state: null, summary: null };
const STARTED_SNAPSHOT: BridgeSnapshot = { state: SAMPLE_STATE, summary: { result: "0-1", moveCount: 4 } };

describe("bridge replies", () => {
  it("answers ping with ready", () => {
    const { parent, send } = setup(makeHost(EMPTY_SNAPSHOT, { ok: true }));
    send({ source: "claude-chess-shell", type: "ping" });
    expect(parent.postMessage).toHaveBeenCalledWith({ source: "claude-chess-game", type: "ready" }, ORIGIN);
  });

  it("replies to request-state with nulls before a game has started", () => {
    const { parent, send } = setup(makeHost(EMPTY_SNAPSHOT, { ok: true }));
    send({ source: "claude-chess-shell", type: "request-state", requestId: "r1" });
    expect(parent.postMessage).toHaveBeenCalledWith(
      { source: "claude-chess-game", type: "state", requestId: "r1", state: null, summary: null },
      ORIGIN,
    );
  });

  it("replies to request-state with the state and summary of the current game", () => {
    const { parent, send } = setup(makeHost(STARTED_SNAPSHOT, { ok: true }));
    send({ source: "claude-chess-shell", type: "request-state", requestId: "r2" });
    expect(parent.postMessage).toHaveBeenCalledWith(
      { source: "claude-chess-game", type: "state", requestId: "r2", state: SAMPLE_STATE, summary: { result: "0-1", moveCount: 4 } },
      ORIGIN,
    );
  });

  it("passes a valid load-state to the host and replies ok", () => {
    const host = makeHost(EMPTY_SNAPSHOT, { ok: true });
    const { parent, send } = setup(host);
    send({ source: "claude-chess-shell", type: "load-state", requestId: "r3", state: SAMPLE_STATE });
    expect(host.load).toHaveBeenCalledWith(SAMPLE_STATE);
    expect(parent.postMessage).toHaveBeenCalledWith({ source: "claude-chess-game", type: "loaded", requestId: "r3", ok: true }, ORIGIN);
  });

  it("replies ok false with the host error for an invalid state", () => {
    const { parent, send } = setup(makeHost(STARTED_SNAPSHOT, { ok: false, error: "Move 3 (g2g5) is not legal" }));
    send({ source: "claude-chess-shell", type: "load-state", requestId: "r4", state: { version: 1 } });
    expect(parent.postMessage).toHaveBeenCalledWith(
      { source: "claude-chess-game", type: "loaded", requestId: "r4", ok: false, error: "Move 3 (g2g5) is not legal" },
      ORIGIN,
    );
  });
});

describe("bridge filtering", () => {
  it("ignores messages from another origin", () => {
    const host = makeHost(EMPTY_SNAPSHOT, { ok: true });
    const { parent, send } = setup(host);
    send({ source: "claude-chess-shell", type: "load-state", requestId: "x", state: SAMPLE_STATE }, { origin: "https://evil.example" });
    expect(host.load).not.toHaveBeenCalled();
    expect(parent.postMessage).not.toHaveBeenCalled();
  });

  it("ignores messages from a window other than the parent", () => {
    const { parent, send } = setup(makeHost(EMPTY_SNAPSHOT, { ok: true }));
    send({ source: "claude-chess-shell", type: "ping" }, { source: {} });
    expect(parent.postMessage).not.toHaveBeenCalled();
  });

  it("ignores messages with the wrong source field", () => {
    const { parent, send } = setup(makeHost(EMPTY_SNAPSHOT, { ok: true }));
    send({ source: "someone-else", type: "ping" });
    expect(parent.postMessage).not.toHaveBeenCalled();
  });

  it("ignores unknown types, malformed data and game-side messages", () => {
    const { parent, send } = setup(makeHost(EMPTY_SNAPSHOT, { ok: true }));
    send({ source: "claude-chess-shell", type: "delete-everything" });
    send("ping");
    send(null);
    send({ source: "claude-chess-game", type: "ready" });
    send({ source: "claude-chess-shell", type: "request-state" });
    expect(parent.postMessage).not.toHaveBeenCalled();
  });
});
