import { isInCheck, isSquareAttacked, KING_TARGETS, KNIGHT_TARGETS, RAYS } from "./attacks";
import { makeMove, type Move, type Position } from "./position";
import {
  EMPTY_CELL,
  codeColor,
  codeType,
  oppositeColor,
  pieceCode,
  rankOf,
  squareName,
  type PieceType,
} from "./types";

const PROMOTION_PIECES: readonly PieceType[] = ["q", "r", "b", "n"];

/** Ray indices from attacks.ts: 0 to 3 orthogonal, 4 to 7 diagonal. */
const ROOK_RAYS = [0, 1, 2, 3];
const BISHOP_RAYS = [4, 5, 6, 7];
const QUEEN_RAYS = [...ROOK_RAYS, ...BISHOP_RAYS];

/** Generates moves that follow piece movement rules but may leave the mover's king in check. */
export const generatePseudoLegalMoves = (position: Position): Move[] => {
  const moves: Move[] = [];
  const { board, sideToMove } = position;
  for (let square = 0; square < 64; square += 1) {
    const cell = board[square] ?? EMPTY_CELL;
    if (cell === EMPTY_CELL || codeColor(cell) !== sideToMove) {
      continue;
    }
    const type = codeType(cell);
    if (type === "p") {
      addPawnMoves(position, square, moves);
    } else if (type === "n") {
      addLeaperMoves(position, square, KNIGHT_TARGETS[square] ?? [], "n", moves);
    } else if (type === "k") {
      addLeaperMoves(position, square, KING_TARGETS[square] ?? [], "k", moves);
      addCastlingMoves(position, square, moves);
    } else if (type === "r") {
      addSlidingMoves(position, square, ROOK_RAYS, "r", moves);
    } else if (type === "b") {
      addSlidingMoves(position, square, BISHOP_RAYS, "b", moves);
    } else if (type === "q") {
      addSlidingMoves(position, square, QUEEN_RAYS, "q", moves);
    }
  }
  return moves;
};

/** Returns the moves that do not leave the mover's own king attacked. */
export const generateLegalMoves = (position: Position): Move[] =>
  generatePseudoLegalMoves(position).filter((move) => !isInCheck(makeMove(position, move).board, position.sideToMove));

/** Serialises a move in UCI form, for example e2e4 or e7e8q. */
export const moveToUci = (move: Move): string =>
  `${squareName(move.from)}${squareName(move.to)}${move.promotion ?? ""}`;

/** Finds the legal move matching a UCI string, or null when it is not legal in this position. */
export const findLegalMove = (position: Position, uci: string): Move | null =>
  generateLegalMoves(position).find((move) => moveToUci(move) === uci) ?? null;

const isEnemyOrEmpty = (position: Position, square: number): boolean => {
  const cell = position.board[square] ?? EMPTY_CELL;
  return cell === EMPTY_CELL || codeColor(cell) !== position.sideToMove;
};

const capturedTypeAt = (position: Position, square: number): PieceType | null => {
  const cell = position.board[square] ?? EMPTY_CELL;
  return cell === EMPTY_CELL ? null : codeType(cell);
};

const pushMove = (
  moves: Move[],
  from: number,
  to: number,
  piece: PieceType,
  captured: PieceType | null,
  promotion: PieceType | null,
  flags: { isEnPassant?: boolean; isCastle?: boolean } = {},
): void => {
  moves.push({
    from,
    to,
    piece,
    captured,
    promotion,
    isEnPassant: flags.isEnPassant ?? false,
    isCastle: flags.isCastle ?? false,
  });
};

const addPawnMoves = (position: Position, from: number, moves: Move[]): void => {
  const mover = position.sideToMove;
  const direction = mover === "white" ? 8 : -8;
  const startRank = mover === "white" ? 1 : 6;
  const lastRank = mover === "white" ? 7 : 0;
  const pawnRank = rankOf(from);
  const one = from + direction;

  if (isOnBoard(one) && (position.board[one] ?? EMPTY_CELL) === EMPTY_CELL) {
    addPawnAdvance(moves, from, one, lastRank, null);
    const two = one + direction;
    if (pawnRank === startRank && (position.board[two] ?? EMPTY_CELL) === EMPTY_CELL) {
      pushMove(moves, from, two, "p", null, null);
    }
  }

  for (const to of pawnCaptureTargets(from, mover)) {
    const target = capturedTypeAt(position, to);
    if (target !== null && isEnemyOrEmpty(position, to)) {
      addPawnAdvance(moves, from, to, lastRank, target);
    } else if (to === position.enPassantSquare) {
      pushMove(moves, from, to, "p", "p", null, { isEnPassant: true });
    }
  }
};

const addPawnAdvance = (
  moves: Move[],
  from: number,
  to: number,
  lastRank: number,
  captured: PieceType | null,
): void => {
  if (rankOf(to) === lastRank) {
    for (const promotion of PROMOTION_PIECES) {
      pushMove(moves, from, to, "p", captured, promotion);
    }
    return;
  }
  pushMove(moves, from, to, "p", captured, null);
};

const pawnCaptureTargets = (from: number, mover: "white" | "black"): number[] => {
  const forward = mover === "white" ? 8 : -8;
  const file = from & 7;
  const targets: number[] = [];
  if (file > 0) {
    targets.push(from + forward - 1);
  }
  if (file < 7) {
    targets.push(from + forward + 1);
  }
  return targets.filter(isOnBoard);
};

const isOnBoard = (square: number): boolean => square >= 0 && square < 64;

const addLeaperMoves = (
  position: Position,
  from: number,
  targets: readonly number[],
  piece: PieceType,
  moves: Move[],
): void => {
  for (const to of targets) {
    if (!isEnemyOrEmpty(position, to)) {
      continue;
    }
    pushMove(moves, from, to, piece, capturedTypeAt(position, to), null);
  }
};

const addSlidingMoves = (
  position: Position,
  from: number,
  rays: readonly number[],
  piece: PieceType,
  moves: Move[],
): void => {
  for (const rayIndex of rays) {
    for (const to of RAYS[rayIndex]?.[from] ?? []) {
      if (!isEnemyOrEmpty(position, to)) {
        break;
      }
      pushMove(moves, from, to, piece, capturedTypeAt(position, to), null);
      if ((position.board[to] ?? EMPTY_CELL) !== EMPTY_CELL) {
        break;
      }
    }
  }
};

/**
 * Adds castling moves when the rights, empty path and attack conditions all hold.
 * The king may not start in check, cross an attacked square, or land on one; the
 * final legality filter also rejects the landing square, so only the crossed square is checked here.
 */
const addCastlingMoves = (position: Position, from: number, moves: Move[]): void => {
  const mover = position.sideToMove;
  const { board } = position;
  const enemy = oppositeColor(mover);
  const home = mover === "white" ? 4 : 60;
  if (from !== home || isInCheck(board, mover)) {
    return;
  }
  const rights = position.castling;
  const kingsideRight = mover === "white" ? rights.whiteKingside : rights.blackKingside;
  const queensideRight = mover === "white" ? rights.whiteQueenside : rights.blackQueenside;
  const rookCode = pieceCode(mover, "r");

  if (kingsideRight && board[home + 3] === rookCode && isEmpty(board, home + 1) && isEmpty(board, home + 2) && !isSquareAttacked(board, home + 1, enemy)) {
    pushMove(moves, from, home + 2, "k", null, null, { isCastle: true });
  }
  if (
    queensideRight &&
    board[home - 4] === rookCode &&
    isEmpty(board, home - 1) &&
    isEmpty(board, home - 2) &&
    isEmpty(board, home - 3) &&
    !isSquareAttacked(board, home - 1, enemy)
  ) {
    pushMove(moves, from, home - 2, "k", null, null, { isCastle: true });
  }
};

const isEmpty = (board: Int8Array, square: number): boolean => (board[square] ?? EMPTY_CELL) === EMPTY_CELL;
