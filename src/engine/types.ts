/** Side to move or piece owner. */
export type Color = "white" | "black";

/** Piece kind, lower-case letter as used in UCI and FEN. */
export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";

/** Engine strength levels offered to the player. */
export type Difficulty = "easy" | "medium" | "hard" | "expert";

/** Success or failure value returned by parsers and validators. */
export type Result<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string };

export const DIFFICULTIES: readonly Difficulty[] = ["easy", "medium", "hard", "expert"];

export const PIECE_TYPES: readonly PieceType[] = ["p", "n", "b", "r", "q", "k"];

/**
 * Squares are indexed 0..63 with a1 = 0, h1 = 7 and a8 = 56.
 * Board cells store a signed piece code: positive for white, negative for black,
 * magnitude is the index in PIECE_TYPES plus one, and zero is an empty square.
 */
export const EMPTY_CELL = 0;

export const pieceCode = (color: Color, type: PieceType): number => {
  const magnitude = PIECE_TYPES.indexOf(type) + 1;
  return color === "white" ? magnitude : -magnitude;
};

/** Returns the owner of a non-empty cell code. */
export const codeColor = (code: number): Color => (code > 0 ? "white" : "black");

/** Returns the piece kind of a non-empty cell code, or null for an empty cell. */
export const codeType = (code: number): PieceType | null => {
  const type = PIECE_TYPES[Math.abs(code) - 1];
  return code === EMPTY_CELL ? null : type ?? null;
};

export const oppositeColor = (color: Color): Color => (color === "white" ? "black" : "white");

export const fileOf = (square: number): number => square & 7;

export const rankOf = (square: number): number => square >> 3;

export const squareName = (square: number): string =>
  `${String.fromCharCode("a".charCodeAt(0) + fileOf(square))}${rankOf(square) + 1}`;

/** Parses a square name such as "e4", returning null when the name is not on the board. */
export const squareIndex = (name: string): number | null => {
  const match = /^([a-h])([1-8])$/.exec(name);
  if (match === null) {
    return null;
  }
  const file = match[1]?.charCodeAt(0) ?? 0;
  const rank = Number(match[2]);
  return (rank - 1) * 8 + (file - "a".charCodeAt(0));
};

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });

export const fail = (error: string): { readonly ok: false; readonly error: string } => ({ ok: false, error });
