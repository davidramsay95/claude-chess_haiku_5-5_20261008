/// <reference lib="webworker" />
import { moveToUci } from "./moveGen";
import { parseFen, type Position } from "./position";
import { chooseMove } from "./search";
import { isEngineRequest, type EngineResponse } from "./engineProtocol";
import type { Difficulty } from "./types";

/**
 * Runs the search off the main thread so the board stays responsive. A request with an invalid
 * FEN gets a null move back, which the client reports as an error instead of hanging.
 */
self.onmessage = (event: MessageEvent<unknown>): void => {
  if (!isEngineRequest(event.data)) {
    return;
  }
  const request = event.data;
  const parsed = parseFen(request.fen);
  const uci = parsed.ok ? chooseUci(parsed.value, request.difficulty) : null;
  const response: EngineResponse = { requestId: request.requestId, uci };
  self.postMessage(response);
};

const chooseUci = (position: Position, difficulty: Difficulty): string | null => {
  const move = chooseMove(position, difficulty);
  return move === null ? null : moveToUci(move);
};
