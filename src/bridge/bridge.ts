import type { GameState } from "../game/gameState";

/** Identifies messages sent by the game. The shell rejects anything else. */
export const GAME_MESSAGE_SOURCE = "claude-chess-game";

/** Identifies messages sent by the shell. The game rejects anything else. */
export const SHELL_MESSAGE_SOURCE = "claude-chess-shell";

export interface BridgeSummary {
  readonly result: string;
  readonly moveCount: number;
}

/** What the game reports when the shell asks for its state. Both fields are null before a game starts. */
export interface BridgeSnapshot {
  readonly state: GameState | null;
  readonly summary: BridgeSummary | null;
}

export type LoadOutcome = { readonly ok: true } | { readonly ok: false; readonly error: string };

/** The game-side operations the bridge needs. The app supplies these. */
export interface BridgeHost {
  readonly getSnapshot: () => BridgeSnapshot;
  readonly loadState: (value: unknown) => LoadOutcome;
}

/** Messages the game posts to the shell. */
export type GameToShellMessage =
  | { readonly source: typeof GAME_MESSAGE_SOURCE; readonly type: "ready" }
  | {
      readonly source: typeof GAME_MESSAGE_SOURCE;
      readonly type: "state";
      readonly requestId: string;
      readonly state: GameState | null;
      readonly summary: BridgeSummary | null;
    }
  | {
      readonly source: typeof GAME_MESSAGE_SOURCE;
      readonly type: "loaded";
      readonly requestId: string;
      readonly ok: boolean;
      readonly error?: string;
    };

/** Minimal event shape the listener reads, so it can be driven by a fake in tests. */
export interface BridgeMessageEvent {
  readonly origin: string;
  readonly source: unknown;
  readonly data: unknown;
}

export interface BridgeOptions {
  /** The page's own origin. Messages from any other origin are ignored. */
  readonly origin: string;
  /** The window that hosts the game. Messages from any other window are ignored. */
  readonly parent: unknown;
  readonly host: BridgeHost;
  readonly post: (message: GameToShellMessage) => void;
}

type ShellMessage =
  | { readonly type: "ping" }
  | { readonly type: "request-state"; readonly requestId: string }
  | { readonly type: "load-state"; readonly requestId: string; readonly state: unknown };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Reads a shell message, returning null for anything that is not one. */
const parseShellMessage = (data: unknown): ShellMessage | null => {
  if (!isRecord(data) || data.source !== SHELL_MESSAGE_SOURCE) {
    return null;
  }
  if (data.type === "ping") {
    return { type: "ping" };
  }
  if (typeof data.requestId !== "string") {
    return null;
  }
  if (data.type === "request-state") {
    return { type: "request-state", requestId: data.requestId };
  }
  if (data.type === "load-state") {
    return { type: "load-state", requestId: data.requestId, state: data.state };
  }
  return null;
};

/**
 * Builds the message listener. It answers only when the event comes from the expected origin and
 * window, so other frames and pages cannot drive the game.
 */
export const createBridgeListener = (options: BridgeOptions): ((event: BridgeMessageEvent) => void) => {
  const { host, post } = options;
  return (event: BridgeMessageEvent): void => {
    if (event.origin !== options.origin || event.source !== options.parent) {
      return;
    }
    const message = parseShellMessage(event.data);
    if (message === null) {
      return;
    }
    if (message.type === "ping") {
      post({ source: GAME_MESSAGE_SOURCE, type: "ready" });
      return;
    }
    if (message.type === "request-state") {
      const snapshot = host.getSnapshot();
      post({
        source: GAME_MESSAGE_SOURCE,
        type: "state",
        requestId: message.requestId,
        state: snapshot.state,
        summary: snapshot.summary,
      });
      return;
    }
    const outcome = host.loadState(message.state);
    post(
      outcome.ok
        ? { source: GAME_MESSAGE_SOURCE, type: "loaded", requestId: message.requestId, ok: true }
        : { source: GAME_MESSAGE_SOURCE, type: "loaded", requestId: message.requestId, ok: false, error: outcome.error },
    );
  };
};
