import {
  EMPTY_CELL,
  codeType,
  codeColor,
  fail,
  oppositeColor,
  ok,
  pieceCode,
  rankOf,
  squareIndex,
  squareName,
  type Color,
  type PieceType,
  type Result,
  PIECE_TYPES,
} from "./types";
import { isInCheck } from "./attacks";

export interface CastlingRights {
  readonly whiteKingside: boolean;
  readonly whiteQueenside: boolean;
  readonly blackKingside: boolean;
  readonly blackQueenside: boolean;
}

/** A full chess position. The board is immutable by convention; makeMove copies it. */
export interface Position {
  readonly board: Int8Array;
  readonly sideToMove: Color;
  readonly castling: CastlingRights;
  readonly enPassantSquare: number | null;
  readonly halfmoveClock: number;
  readonly fullmoveNumber: number;
}

/** A pseudo-legal or legal move with enough detail to make and display it. */
export interface Move {
  readonly from: number;
  readonly to: number;
  readonly piece: PieceType;
  readonly captured: PieceType | null;
  readonly promotion: PieceType | null;
  readonly isEnPassant: boolean;
  readonly isCastle: boolean;
}

const START_RANK_FOR_PAWN: Record<Color, number> = { white: 1, black: 6 };
const KING_HOME: Record<Color, number> = { white: 4, black: 60 };
const ROOK_HOME_KINGSIDE: Record<Color, number> = { white: 7, black: 63 };
const ROOK_HOME_QUEENSIDE: Record<Color, number> = { white: 0, black: 56 };

/** Parses a FEN string and rejects positions that could never occur in a legal game. */
export const parseFen = (fen: string): Result<Position> => {
  const fields = fen.trim().split(/\s+/);
  if (fields.length !== 6) {
    return fail("FEN must have six space-separated fields");
  }
  const [placement = "", sideField = "", castlingField = "", epField = "", halfField = "", fullField = ""] = fields;

  const board = parsePlacement(placement);
  if (!board.ok) {
    return board;
  }
  const sideToMove = parseSideToMove(sideField);
  if (sideToMove === null) {
    return fail(`Unknown side to move "${sideField}"`);
  }
  const castling = parseCastling(castlingField, board.value);
  if (!castling.ok) {
    return castling;
  }
  const enPassantSquare = parseEnPassant(epField, sideToMove, board.value);
  if (!enPassantSquare.ok) {
    return enPassantSquare;
  }
  const halfmoveClock = parseCounter(halfField, 0);
  const fullmoveNumber = parseCounter(fullField, 1);
  if (halfmoveClock === null || fullmoveNumber === null) {
    return fail("Move counters must be non-negative integers, and the full move number must be at least 1");
  }

  const position: Position = {
    board: board.value,
    sideToMove,
    castling: castling.value,
    enPassantSquare: enPassantSquare.value,
    halfmoveClock,
    fullmoveNumber,
  };
  return validateKings(position);
};

const parsePlacement = (placement: string): Result<Int8Array> => {
  const ranks = placement.split("/");
  if (ranks.length !== 8) {
    return fail("Placement must have eight ranks");
  }
  const board = new Int8Array(64);
  for (let fenRank = 0; fenRank < 8; fenRank += 1) {
    const rank = 7 - fenRank;
    const row = ranks[fenRank] ?? "";
    let file = 0;
    for (const char of row) {
      if (/[1-8]/.test(char)) {
        file += Number(char);
        continue;
      }
      const pieceType = PIECE_TYPES.find((candidate) => candidate === char.toLowerCase());
      if (pieceType === undefined || file > 7) {
        return fail(`Invalid character "${char}" in placement`);
      }
      const color: Color = char === char.toUpperCase() ? "white" : "black";
      if ((pieceType === "p") && (rank === 0 || rank === 7)) {
        return fail("Pawns cannot stand on the first or last rank");
      }
      board[rank * 8 + file] = pieceCode(color, pieceType);
      file += 1;
    }
    if (file !== 8) {
      return fail(`Rank ${rank + 1} does not contain eight squares`);
    }
  }
  return ok(board);
};

const parseSideToMove = (field: string): Color | null => {
  if (field === "w") {
    return "white";
  }
  if (field === "b") {
    return "black";
  }
  return null;
};

const parseCastling = (field: string, board: Int8Array): Result<CastlingRights> => {
  if (field !== "-" && !/^K?Q?k?q?$/.test(field)) {
    return fail(`Invalid castling field "${field}"`);
  }
  const rights = {
    whiteKingside: field.includes("K"),
    whiteQueenside: field.includes("Q"),
    blackKingside: field.includes("k"),
    blackQueenside: field.includes("q"),
  };
  const checks: [boolean, Color, "kingside" | "queenside"][] = [
    [rights.whiteKingside, "white", "kingside"],
    [rights.whiteQueenside, "white", "queenside"],
    [rights.blackKingside, "black", "kingside"],
    [rights.blackQueenside, "black", "queenside"],
  ];
  for (const [granted, color, side] of checks) {
    if (granted && !hasCastlingPieces(board, color, side)) {
      return fail(`Castling right for ${color} ${side} needs the king and rook on their home squares`);
    }
  }
  return ok(rights);
};

const hasCastlingPieces = (board: Int8Array, color: Color, side: "kingside" | "queenside"): boolean => {
  const rook = side === "kingside" ? ROOK_HOME_KINGSIDE[color] : ROOK_HOME_QUEENSIDE[color];
  return board[KING_HOME[color]] === pieceCode(color, "k") && board[rook] === pieceCode(color, "r");
};

/**
 * Validates an en passant square against the side to move. The square must sit behind a pawn
 * that just double-pushed, so it must be on the rank that pawn skipped over.
 */
const parseEnPassant = (field: string, sideToMove: Color, board: Int8Array): Result<number | null> => {
  if (field === "-") {
    return ok(null);
  }
  const square = squareIndex(field);
  if (square === null) {
    return fail(`Invalid en passant square "${field}"`);
  }
  const expectedRank = sideToMove === "white" ? 5 : 2;
  if (rankOf(square) !== expectedRank) {
    return fail(`En passant square ${field} is not possible with this side to move`);
  }
  const pawnSquare = sideToMove === "white" ? square - 8 : square + 8;
  const originSquare = sideToMove === "white" ? square + 8 : square - 8;
  const pawnOwner = oppositeColor(sideToMove);
  if (board[pawnSquare] !== pieceCode(pawnOwner, "p") || board[square] !== EMPTY_CELL || board[originSquare] !== EMPTY_CELL) {
    return fail(`En passant square ${field} does not match a double pawn push`);
  }
  return ok(square);
};

const parseCounter = (field: string, minimum: number): number | null => {
  if (!/^\d+$/.test(field)) {
    return null;
  }
  const value = Number(field);
  return value >= minimum ? value : null;
};

const validateKings = (position: Position): Result<Position> => {
  const whiteKings = countPieces(position.board, "white", "k");
  const blackKings = countPieces(position.board, "black", "k");
  if (whiteKings !== 1 || blackKings !== 1) {
    return fail("Each side must have exactly one king");
  }
  if (isInCheck(position.board, oppositeColor(position.sideToMove))) {
    return fail("The side not to move cannot be in check");
  }
  return ok(position);
};

const countPieces = (board: Int8Array, color: Color, type: PieceType): number => {
  const target = pieceCode(color, type);
  let count = 0;
  for (const cell of board) {
    if (cell === target) {
      count += 1;
    }
  }
  return count;
};

/** Serialises a position to FEN. Used for the start position field and debugging. */
export const toFen = (position: Position): string => {
  const ranks: string[] = [];
  for (let rank = 7; rank >= 0; rank -= 1) {
    ranks.push(rankToFen(position.board, rank));
  }
  const castling = castlingToFen(position.castling);
  const enPassant = position.enPassantSquare === null ? "-" : squareName(position.enPassantSquare);
  return [
    ranks.join("/"),
    position.sideToMove === "white" ? "w" : "b",
    castling,
    enPassant,
    String(position.halfmoveClock),
    String(position.fullmoveNumber),
  ].join(" ");
};

const rankToFen = (board: Int8Array, rank: number): string => {
  let text = "";
  let empty = 0;
  for (let file = 0; file < 8; file += 1) {
    const code = board[rank * 8 + file] ?? EMPTY_CELL;
    if (code === EMPTY_CELL) {
      empty += 1;
      continue;
    }
    if (empty > 0) {
      text += String(empty);
      empty = 0;
    }
    const type = codeType(code);
    const letter = type ?? "p";
    text += codeColor(code) === "white" ? letter.toUpperCase() : letter;
  }
  return empty > 0 ? text + String(empty) : text;
};

const castlingToFen = (rights: CastlingRights): string => {
  const text = [
    rights.whiteKingside ? "K" : "",
    rights.whiteQueenside ? "Q" : "",
    rights.blackKingside ? "k" : "",
    rights.blackQueenside ? "q" : "",
  ].join("");
  return text === "" ? "-" : text;
};

/**
 * Applies a move and returns the resulting position. The input position is not modified.
 * The move must come from generateLegalMoves or generatePseudoLegalMoves for this position.
 */
export const makeMove = (position: Position, move: Move): Position => {
  const board = position.board.slice();
  const mover = position.sideToMove;
  const forward = mover === "white" ? 8 : -8;

  board[move.from] = EMPTY_CELL;
  if (move.isEnPassant) {
    board[move.to - forward] = EMPTY_CELL;
  }
  if (move.isCastle) {
    moveCastlingRook(board, move.from, move.to);
  }
  board[move.to] = move.promotion === null ? pieceCode(mover, move.piece) : pieceCode(mover, move.promotion);

  const isPawnMove = move.piece === "p";
  const isCapture = move.captured !== null || move.isEnPassant;
  const doublePush = isPawnMove && Math.abs(move.to - move.from) === 16;

  return {
    board,
    sideToMove: oppositeColor(mover),
    castling: updateCastling(position.castling, move),
    enPassantSquare: doublePush ? (move.from + move.to) / 2 : null,
    halfmoveClock: isPawnMove || isCapture ? 0 : position.halfmoveClock + 1,
    fullmoveNumber: mover === "black" ? position.fullmoveNumber + 1 : position.fullmoveNumber,
  };
};

const moveCastlingRook = (board: Int8Array, kingFrom: number, kingTo: number): void => {
  if (kingTo > kingFrom) {
    board[kingFrom + 1] = board[kingFrom + 3] ?? EMPTY_CELL;
    board[kingFrom + 3] = EMPTY_CELL;
  } else {
    board[kingFrom - 1] = board[kingFrom - 4] ?? EMPTY_CELL;
    board[kingFrom - 4] = EMPTY_CELL;
  }
};

const updateCastling = (rights: CastlingRights, move: Move): CastlingRights => {
  let next = rights;
  if (move.piece === "k") {
    next = move.from === KING_HOME.white ? { ...next, whiteKingside: false, whiteQueenside: false } : next;
    next = move.from === KING_HOME.black ? { ...next, blackKingside: false, blackQueenside: false } : next;
  }
  for (const square of [move.from, move.to]) {
    next = clearRightsForSquare(next, square);
  }
  return next;
};

const clearRightsForSquare = (rights: CastlingRights, square: number): CastlingRights => {
  switch (square) {
    case ROOK_HOME_QUEENSIDE.white:
      return { ...rights, whiteQueenside: false };
    case ROOK_HOME_KINGSIDE.white:
      return { ...rights, whiteKingside: false };
    case ROOK_HOME_QUEENSIDE.black:
      return { ...rights, blackQueenside: false };
    case ROOK_HOME_KINGSIDE.black:
      return { ...rights, blackKingside: false };
    default:
      return rights;
  }
};
