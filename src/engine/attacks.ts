import { EMPTY_CELL, codeColor, oppositeColor, pieceCode, rankOf, fileOf, type Color } from "./types";

/** Direction deltas as [fileStep, rankStep]. Indices 0 to 3 are orthogonal, 4 to 7 diagonal. */
const DIRECTIONS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

const KNIGHT_DELTAS: readonly (readonly [number, number])[] = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
];

const KING_DELTAS: readonly (readonly [number, number])[] = DIRECTIONS;

/** Returns the square reached by a step, or null if the step leaves the board. */
const step = (square: number, fileStep: number, rankStep: number): number | null => {
  const file = fileOf(square) + fileStep;
  const rank = rankOf(square) + rankStep;
  if (file < 0 || file > 7 || rank < 0 || rank > 7) {
    return null;
  }
  return rank * 8 + file;
};

const targetsFor = (deltas: readonly (readonly [number, number])[]): readonly (readonly number[])[] =>
  Array.from({ length: 64 }, (_unused, square) =>
    deltas.map(([fileStep, rankStep]) => step(square, fileStep, rankStep)).filter((target): target is number => target !== null),
  );

/** Squares a knight on each square can jump to. */
export const KNIGHT_TARGETS = targetsFor(KNIGHT_DELTAS);

/** Squares a king on each square touches. */
export const KING_TARGETS = targetsFor(KING_DELTAS);

/**
 * Squares a pawn of each colour on each square attacks. Used in reverse: a pawn of colour C
 * attacks square S when S is in PAWN_ATTACKS[C] for that pawn's square.
 */
export const PAWN_ATTACKS: Record<Color, readonly (readonly number[])[]> = {
  white: targetsFor([
    [-1, 1],
    [1, 1],
  ]),
  black: targetsFor([
    [-1, -1],
    [1, -1],
  ]),
};

/** Rays from each square in each of the eight directions, nearest square first. */
export const RAYS: readonly (readonly (readonly number[])[])[] = DIRECTIONS.map(([fileStep, rankStep]) =>
  Array.from({ length: 64 }, (_unused, square) => {
    const ray: number[] = [];
    let current = step(square, fileStep, rankStep);
    while (current !== null) {
      ray.push(current);
      current = step(current, fileStep, rankStep);
    }
    return ray;
  }),
);

const ORTHOGONAL_RAYS = [0, 1, 2, 3];
const DIAGONAL_RAYS = [4, 5, 6, 7];

/**
 * Returns true when the given colour's king is attacked on the board. Assumes the board has
 * exactly one king of that colour; callers that move kings must have validated the position.
 */
export const isInCheck = (board: Int8Array, color: Color): boolean => {
  const king = findKing(board, color);
  return king !== null && isSquareAttacked(board, king, oppositeColor(color));
};

/** Returns the square of the given colour's king, or null if there is none. */
export const findKing = (board: Int8Array, color: Color): number | null => {
  const target = pieceCode(color, "k");
  for (let square = 0; square < 64; square += 1) {
    if (board[square] === target) {
      return square;
    }
  }
  return null;
};

/** Returns true when any piece of byColor attacks the square. */
export const isSquareAttacked = (board: Int8Array, square: number, byColor: Color): boolean => {
  for (const pawnSquare of PAWN_ATTACKS[oppositeColor(byColor)][square] ?? []) {
    if (board[pawnSquare] === pieceCode(byColor, "p")) {
      return true;
    }
  }
  for (const knightSquare of KNIGHT_TARGETS[square] ?? []) {
    if (board[knightSquare] === pieceCode(byColor, "n")) {
      return true;
    }
  }
  for (const kingSquare of KING_TARGETS[square] ?? []) {
    if (board[kingSquare] === pieceCode(byColor, "k")) {
      return true;
    }
  }
  return slidingAttack(board, square, byColor, ORTHOGONAL_RAYS, "r") || slidingAttack(board, square, byColor, DIAGONAL_RAYS, "b");
};

const slidingAttack = (board: Int8Array, square: number, byColor: Color, rays: readonly number[], lineType: "r" | "b"): boolean => {
  for (const rayIndex of rays) {
    for (const along of RAYS[rayIndex]?.[square] ?? []) {
      const cell = board[along] ?? EMPTY_CELL;
      if (cell === EMPTY_CELL) {
        continue;
      }
      if (codeColor(cell) === byColor && (cellIsPiece(cell, lineType) || cellIsPiece(cell, "q"))) {
        return true;
      }
      break;
    }
  }
  return false;
};

const cellIsPiece = (cell: number, type: "r" | "b" | "q"): boolean => cell === pieceCode(codeColor(cell), type);
