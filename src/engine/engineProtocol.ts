import { DIFFICULTIES, type Difficulty } from "./types";

/** Message the page posts to the engine worker. The position is sent as FEN. */
export interface EngineRequest {
  readonly requestId: number;
  readonly fen: string;
  readonly difficulty: Difficulty;
}

/** Worker reply. `uci` is null when the position has no legal move. */
export interface EngineResponse {
  readonly requestId: number;
  readonly uci: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isEngineRequest = (value: unknown): value is EngineRequest =>
  isRecord(value) &&
  typeof value.requestId === "number" &&
  typeof value.fen === "string" &&
  typeof value.difficulty === "string" &&
  DIFFICULTIES.some((difficulty) => difficulty === value.difficulty);

export const isEngineResponse = (value: unknown): value is EngineResponse =>
  isRecord(value) &&
  typeof value.requestId === "number" &&
  (value.uci === null || typeof value.uci === "string");
