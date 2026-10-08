import { parseGameState, replayGame, type GameSession } from "./gameState";
import { fail, type Result } from "../engine/types";

/**
 * Validates a decoded save and replays it. The interface import and the bridge load both call
 * this, so a state accepted by one is accepted by the other.
 */
export const importGameValue = (value: unknown): Result<GameSession> => {
  const parsed = parseGameState(value);
  if (!parsed.ok) {
    return parsed;
  }
  return replayGame(parsed.value);
};

/** Parses pasted or file text as JSON, then validates it as a save. */
export const importGameText = (text: string): Result<GameSession> => {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : "unknown error";
    return fail(`The text is not valid JSON (${reason})`);
  }
  return importGameValue(value);
};
