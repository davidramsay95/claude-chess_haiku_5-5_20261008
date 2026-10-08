import { useEffect, useRef } from "react";
import { createBridgeListener, type BridgeHost, type BridgeSnapshot, type GameToShellMessage, type LoadOutcome } from "./bridge";
import { summarizeGame, type GameSession } from "../game/gameState";
import type { Result } from "../engine/types";

interface BridgeCallbacks {
  readonly loadSession: (session: GameSession) => void;
  readonly importValue: (value: unknown) => Result<GameSession>;
}

/**
 * Connects the game to the site shell. Does nothing when the game is opened on its own, because
 * there is no parent window to talk to. The listener reads the latest session through a ref so it
 * never answers with stale data.
 */
export const useGameBridge = (session: GameSession | null, callbacks: BridgeCallbacks): void => {
  const sessionRef = useRef(session);
  const callbacksRef = useRef(callbacks);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  useEffect(() => {
    const parent: unknown = window.parent;
    if (parent === window) {
      return undefined;
    }
    const host: BridgeHost = {
      getSnapshot: (): BridgeSnapshot => {
        const current = sessionRef.current;
        return current === null ? { state: null, summary: null } : { state: current.state, summary: summarizeGame(current) };
      },
      loadState: (value: unknown): LoadOutcome => {
        const result = callbacksRef.current.importValue(value);
        if (!result.ok) {
          return { ok: false, error: result.error };
        }
        callbacksRef.current.loadSession(result.value);
        return { ok: true };
      },
    };
    const listener = createBridgeListener({
      origin: window.location.origin,
      parent,
      host,
      post: (message: GameToShellMessage): void => {
        window.parent.postMessage(message, window.location.origin);
      },
    });
    const handle = (event: MessageEvent<unknown>): void => {
      listener({ origin: event.origin, source: event.source, data: event.data });
    };
    window.addEventListener("message", handle);
    window.parent.postMessage({ source: "claude-chess-game", type: "ready" }, window.location.origin);
    return () => {
      window.removeEventListener("message", handle);
    };
  }, []);
};
