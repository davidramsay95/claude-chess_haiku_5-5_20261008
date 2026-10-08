import { generateLegalMoves } from "./moveGen";
import { makeMove, type Position } from "./position";

/**
 * Counts leaf nodes of the legal move tree to the given depth.
 * Used by tests to validate move generation against known perft values.
 */
export const countPerft = (position: Position, depth: number): number => {
  if (depth === 0) {
    return 1;
  }
  const moves = generateLegalMoves(position);
  if (depth === 1) {
    return moves.length;
  }
  let total = 0;
  for (const move of moves) {
    total += countPerft(makeMove(position, move), depth - 1);
  }
  return total;
};
