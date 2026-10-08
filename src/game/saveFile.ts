import type { GameState } from "./gameState";

/** Name of the downloaded save. Dated so repeated exports do not look identical. */
export const saveFileName = (now: Date): string => {
  const stamp = now.toISOString().slice(0, 10);
  return `chess-game-${stamp}.json`;
};

/** Serialises a state to the documented JSON form. */
export const serializeGameState = (state: GameState): string => `${JSON.stringify(state, null, 2)}\n`;
