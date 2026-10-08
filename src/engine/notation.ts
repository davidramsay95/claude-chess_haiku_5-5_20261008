import { generateLegalMoves } from "./moveGen";
import { isInCheck } from "./attacks";
import { makeMove, type Move, type Position } from "./position";
import { fileOf, oppositeColor, rankOf, squareName } from "./types";

const PIECE_LETTERS: Record<string, string> = { n: "N", b: "B", r: "R", q: "Q", k: "K" };

/**
 * Writes a move in standard algebraic notation for display. The legal move list of the
 * position is needed to disambiguate pieces that share a destination square.
 */
export const moveToSan = (position: Position, move: Move, legalMoves: readonly Move[]): string => {
  const body = move.isCastle ? castleText(move) : pieceText(position, move, legalMoves);
  return body + suffixFor(position, move);
};

const castleText = (move: Move): string => (fileOf(move.to) === 6 ? "O-O" : "O-O-O");

const pieceText = (position: Position, move: Move, legalMoves: readonly Move[]): string => {
  const destination = squareName(move.to);
  if (move.piece === "p") {
    const capture = move.captured !== null ? `${fileLetter(move.from)}x` : "";
    const promotion = move.promotion === null ? "" : `=${move.promotion.toUpperCase()}`;
    return `${capture}${destination}${promotion}`;
  }
  const letter = PIECE_LETTERS[move.piece] ?? "";
  const capture = move.captured !== null ? "x" : "";
  return `${letter}${disambiguation(move, legalMoves)}${capture}${destination}`;
};

const fileLetter = (square: number): string => squareName(square).charAt(0);

/** Adds the file, rank or both when another piece of the same kind can reach the same square. */
const disambiguation = (move: Move, legalMoves: readonly Move[]): string => {
  const rivals = legalMoves.filter(
    (other) => other.piece === move.piece && other.to === move.to && other.from !== move.from,
  );
  if (rivals.length === 0) {
    return "";
  }
  const sharesFile = rivals.some((other) => fileOf(other.from) === fileOf(move.from));
  const sharesRank = rivals.some((other) => rankOf(other.from) === rankOf(move.from));
  if (!sharesFile) {
    return fileLetter(move.from);
  }
  if (!sharesRank) {
    return String(rankOf(move.from) + 1);
  }
  return squareName(move.from);
};

const suffixFor = (position: Position, move: Move): string => {
  const after = makeMove(position, move);
  if (!isInCheck(after.board, oppositeColor(position.sideToMove))) {
    return "";
  }
  return generateLegalMoves(after).length === 0 ? "#" : "+";
};
