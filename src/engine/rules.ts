import { isInCheck } from "./attacks";
import { generateLegalMoves } from "./moveGen";
import { type Position } from "./position";
import { EMPTY_CELL, codeType, fileOf, oppositeColor, rankOf, squareName, type Color } from "./types";

/**
 * Halfmove count at which the fifty-move rule ends the game. The brief asks for the rule to
 * be applied; it is applied automatically rather than on a claim.
 */
export const FIFTY_MOVE_HALFMOVES = 100;

/** Occurrences of one position at which the game is drawn by repetition. */
export const THREEFOLD_COUNT = 3;

export type DrawReason = "stalemate" | "fifty-move" | "threefold-repetition" | "insufficient-material";

export type GameStatus =
  | { readonly kind: "ongoing" }
  | { readonly kind: "checkmate"; readonly winner: Color }
  | { readonly kind: "draw"; readonly reason: DrawReason };

/**
 * Decides whether the game has ended in this position. Checkmate and stalemate come first, then
 * the automatic draws. The caller counts how many times this position has occurred.
 */
export const evaluateStatus = (position: Position, repetitionCount: number): GameStatus => {
  const hasLegalMove = generateLegalMoves(position).length > 0;
  if (!hasLegalMove) {
    if (isInCheck(position.board, position.sideToMove)) {
      return { kind: "checkmate", winner: oppositeColor(position.sideToMove) };
    }
    return { kind: "draw", reason: "stalemate" };
  }
  if (isInsufficientMaterial(position.board)) {
    return { kind: "draw", reason: "insufficient-material" };
  }
  if (position.halfmoveClock >= FIFTY_MOVE_HALFMOVES) {
    return { kind: "draw", reason: "fifty-move" };
  }
  if (repetitionCount >= THREEFOLD_COUNT) {
    return { kind: "draw", reason: "threefold-repetition" };
  }
  return { kind: "ongoing" };
};

/**
 * Returns true when neither side can ever checkmate with the pieces left. Covers bare kings,
 * one minor piece, and bishops that all stand on the same colour. Two knights are not treated
 * as dead because a helpmate exists.
 */
export const isInsufficientMaterial = (board: Int8Array): boolean => {
  let knights = 0;
  let bishops = 0;
  let bishopsOnDark = 0;
  for (let square = 0; square < 64; square += 1) {
    const cell = board[square] ?? EMPTY_CELL;
    if (cell === EMPTY_CELL) {
      continue;
    }
    const type = codeType(cell);
    if (type === "p" || type === "r" || type === "q") {
      return false;
    }
    if (type === "n") {
      knights += 1;
    }
    if (type === "b") {
      bishops += 1;
      if (isDarkSquare(square)) {
        bishopsOnDark += 1;
      }
    }
  }
  if (knights === 0) {
    return bishops === 0 || bishopsOnDark === 0 || bishopsOnDark === bishops;
  }
  return knights === 1 && bishops === 0;
};

const isDarkSquare = (square: number): boolean => (fileOf(square) + rankOf(square)) % 2 === 0;

/**
 * Identifies a position for repetition counting. The en passant square only counts when a
 * capture is actually legal, because otherwise two identical positions would compare as different.
 */
export const positionKey = (position: Position): string => {
  const pieces = placementKey(position.board);
  const castling = position.castling;
  const rights = [
    castling.whiteKingside ? "K" : "",
    castling.whiteQueenside ? "Q" : "",
    castling.blackKingside ? "k" : "",
    castling.blackQueenside ? "q" : "",
  ].join("");
  const enPassantLegal =
    position.enPassantSquare !== null && generateLegalMoves(position).some((move) => move.isEnPassant);
  const enPassant = enPassantLegal && position.enPassantSquare !== null ? squareName(position.enPassantSquare) : "-";
  return `${pieces} ${position.sideToMove} ${rights === "" ? "-" : rights} ${enPassant}`;
};

const placementKey = (board: Int8Array): string => {
  const parts: string[] = [];
  for (let square = 0; square < 64; square += 1) {
    const cell = board[square] ?? EMPTY_CELL;
    parts.push(cell === EMPTY_CELL ? "." : String(cell));
  }
  return parts.join(",");
};
