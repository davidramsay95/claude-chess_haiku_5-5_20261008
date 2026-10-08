import { isEngineResponse, type EngineRequest } from "./engineProtocol";
import type { Difficulty } from "./types";

interface PendingRequest {
  readonly resolve: (uci: string | null) => void;
  readonly reject: (error: Error) => void;
}

let worker: Worker | null = null;
let nextRequestId = 1;
const pending = new Map<number, PendingRequest>();

const rejectAll = (error: Error): void => {
  for (const request of pending.values()) {
    request.reject(error);
  }
  pending.clear();
};

const ensureWorker = (): Worker => {
  if (worker !== null) {
    return worker;
  }
  const created = new Worker(new URL("./engine.worker.ts", import.meta.url), { type: "module" });
  created.onmessage = (event: MessageEvent<unknown>): void => {
    if (!isEngineResponse(event.data)) {
      return;
    }
    const request = pending.get(event.data.requestId);
    pending.delete(event.data.requestId);
    request?.resolve(event.data.uci);
  };
  created.onerror = (event: ErrorEvent): void => {
    rejectAll(new Error(`Engine worker failed: ${event.message}`));
    created.terminate();
    worker = null;
  };
  worker = created;
  return created;
};

/**
 * Asks the engine worker for its move in the given position. Resolves with a UCI move, or null
 * when the side to move has no legal move. Rejects if the worker crashes.
 */
export const requestEngineMove = (fen: string, difficulty: Difficulty): Promise<string | null> =>
  new Promise<string | null>((resolve, reject) => {
    const requestId = nextRequestId;
    nextRequestId += 1;
    pending.set(requestId, { resolve, reject });
    const request: EngineRequest = { requestId, fen, difficulty };
    ensureWorker().postMessage(request);
  });

/** Stops the worker. Pending requests are rejected. */
export const disposeEngine = (): void => {
  rejectAll(new Error("Engine was stopped"));
  worker?.terminate();
  worker = null;
};
