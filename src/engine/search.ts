import { isInCheck } from "./attacks";
import { generateLegalMoves } from "./moveGen";
import { makeMove, type Move, type Position } from "./position";
import { FIFTY_MOVE_HALFMOVES, isInsufficientMaterial } from "./rules";
import { EMPTY_CELL, codeColor, codeType, type Difficulty, type PieceType } from "./types";

/**
 * How hard each level searches. Easy looks one move ahead with no quiescence and adds noise,
 * so it misses tactics. Medium and above add quiescence. Hard and expert are capped by depth and
 * by time; expert searches deepest within its budget.
 */
export interface SearchLevel {
  readonly maxDepth: number;
  readonly timeLimitMs: number;
  readonly noiseCp: number;
  readonly quiescence: boolean;
}

export const SEARCH_LEVELS: Record<Difficulty, SearchLevel> = {
  easy: { maxDepth: 1, timeLimitMs: 300, noiseCp: 250, quiescence: false },
  medium: { maxDepth: 2, timeLimitMs: 1000, noiseCp: 0, quiescence: true },
  hard: { maxDepth: 4, timeLimitMs: 2500, noiseCp: 0, quiescence: true },
  expert: { maxDepth: 12, timeLimitMs: 4000, noiseCp: 0, quiescence: true },
};

export interface ChooseMoveOptions {
  /** Returns a number in [0, 1). Injected by tests to make easy-level noise repeatable. */
  readonly random?: () => number;
  /** Milliseconds clock. Injected by tests. */
  readonly now?: () => number;
}

const MATE_SCORE = 100000;
const INFINITY_SCORE = 1000000;

const PIECE_VALUE: Record<PieceType, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

interface SearchContext {
  readonly deadline: number;
  readonly now: () => number;
  readonly quiescence: boolean;
  nodes: number;
  aborted: boolean;
}

/**
 * Chooses a move for the side to move. Returns null when the position has no legal move.
 * Search results are stable for a given position, level and clock, except easy, which adds noise.
 */
export const chooseMove = (position: Position, difficulty: Difficulty, options: ChooseMoveOptions = {}): Move | null => {
  const legal = orderMoves(generateLegalMoves(position));
  const onlyMove = legal[0];
  if (onlyMove === undefined || legal.length === 1) {
    return onlyMove ?? null;
  }
  const level = SEARCH_LEVELS[difficulty];
  const now = options.now ?? (() => Date.now());
  const random = options.random ?? Math.random;
  const context: SearchContext = {
    deadline: now() + level.timeLimitMs,
    now,
    quiescence: level.quiescence,
    nodes: 0,
    aborted: false,
  };

  let best: Move = onlyMove;
  for (let depth = 1; depth <= level.maxDepth; depth += 1) {
    const result = searchRoot(position, legal, depth, context, level.noiseCp > 0);
    if (result === null) {
      break;
    }
    best = pickRootMove(result, level.noiseCp, random, onlyMove);
    if (Math.abs(result.bestScore) >= MATE_SCORE - depth) {
      break;
    }
  }
  return best;
};

interface RootResult {
  readonly scored: readonly { readonly move: Move; readonly score: number }[];
  readonly bestScore: number;
}

const searchRoot = (
  position: Position,
  moves: readonly Move[],
  depth: number,
  context: SearchContext,
  fullWindow: boolean,
): RootResult | null => {
  let alpha = -INFINITY_SCORE;
  const scored: { move: Move; score: number }[] = [];
  let bestScore = -INFINITY_SCORE;
  for (const move of moves) {
    const child = makeMove(position, move);
    const score = -negamax(child, depth - 1, -INFINITY_SCORE, fullWindow ? INFINITY_SCORE : -alpha, 1, context);
    if (context.aborted) {
      return null;
    }
    scored.push({ move, score });
    if (score > bestScore) {
      bestScore = score;
    }
    if (!fullWindow && score > alpha) {
      alpha = score;
    }
  }
  return { scored, bestScore };
};

const pickRootMove = (result: RootResult, noiseCp: number, random: () => number, fallback: Move): Move => {
  let chosen: { move: Move; score: number } | undefined;
  for (const candidate of result.scored) {
    const noisy = candidate.score + (random() * 2 - 1) * noiseCp;
    if (chosen === undefined || noisy > chosen.score) {
      chosen = { move: candidate.move, score: noisy };
    }
  }
  return chosen?.move ?? fallback;
};

const negamax = (
  position: Position,
  depth: number,
  alpha: number,
  beta: number,
  ply: number,
  context: SearchContext,
): number => {
  if (!tick(context)) {
    return 0;
  }
  if (depth <= 0) {
    return context.quiescence ? quiesce(position, alpha, beta, ply, context) : evaluate(position);
  }
  const legal = generateLegalMoves(position);
  if (legal.length === 0) {
    return isInCheck(position.board, position.sideToMove) ? -(MATE_SCORE - ply) : 0;
  }
  if (isDrawByRule(position)) {
    return 0;
  }
  let bestScore = -INFINITY_SCORE;
  let currentAlpha = alpha;
  for (const move of orderMoves(legal)) {
    const score = -negamax(makeMove(position, move), depth - 1, -beta, -currentAlpha, ply + 1, context);
    if (context.aborted) {
      return 0;
    }
    if (score > bestScore) {
      bestScore = score;
    }
    if (score > currentAlpha) {
      currentAlpha = score;
    }
    if (currentAlpha >= beta) {
      break;
    }
  }
  return bestScore;
};

/** Searches captures and promotions until the position is quiet, so the evaluation is not taken mid-exchange. */
const quiesce = (position: Position, alpha: number, beta: number, ply: number, context: SearchContext): number => {
  if (!tick(context)) {
    return 0;
  }
  const standPat = evaluate(position);
  if (standPat >= beta) {
    return beta;
  }
  let currentAlpha = Math.max(alpha, standPat);
  const legal = generateLegalMoves(position);
  if (legal.length === 0) {
    return isInCheck(position.board, position.sideToMove) ? -(MATE_SCORE - ply) : 0;
  }
  const tactical = orderMoves(legal.filter((move) => move.captured !== null || move.isEnPassant || move.promotion !== null));
  for (const move of tactical) {
    const score = -quiesce(makeMove(position, move), -beta, -currentAlpha, ply + 1, context);
    if (context.aborted) {
      return 0;
    }
    if (score >= beta) {
      return beta;
    }
    if (score > currentAlpha) {
      currentAlpha = score;
    }
  }
  return currentAlpha;
};

/** Counts nodes and checks the clock every 1024 nodes. Returns false once the search must stop. */
const tick = (context: SearchContext): boolean => {
  if (context.aborted) {
    return false;
  }
  context.nodes += 1;
  if ((context.nodes & 1023) === 0 && context.now() >= context.deadline) {
    context.aborted = true;
    return false;
  }
  return true;
};

const isDrawByRule = (position: Position): boolean =>
  isInsufficientMaterial(position.board) || position.halfmoveClock >= FIFTY_MOVE_HALFMOVES;

/** Puts captures of valuable pieces by cheap attackers first, then promotions, to make pruning effective. */
const orderMoves = (moves: readonly Move[]): Move[] => {
  return [...moves].sort((left, right) => moveOrderScore(right) - moveOrderScore(left));
};

const moveOrderScore = (move: Move): number => {
  const victim = move.captured === null ? 0 : PIECE_VALUE[move.captured];
  const promotionBonus = move.promotion === null ? 0 : PIECE_VALUE[move.promotion];
  return victim * 10 - PIECE_VALUE[move.piece] / 10 + promotionBonus;
};

/** Static evaluation from the side to move's point of view, in centipawns. */
export const evaluate = (position: Position): number => {
  let white = 0;
  for (let square = 0; square < 64; square += 1) {
    const cell = position.board[square] ?? EMPTY_CELL;
    if (cell === EMPTY_CELL) {
      continue;
    }
    const type = codeType(cell);
    if (type === null) {
      continue;
    }
    const color = codeColor(cell);
    const sign = color === "white" ? 1 : -1;
    white += sign * (PIECE_VALUE[type] + positionalBonus(type, square, color));
  }
  return position.sideToMove === "white" ? white : -white;
};

const positionalBonus = (type: PieceType, square: number, color: "white" | "black"): number => {
  const rank = color === "white" ? square >> 3 : 7 - (square >> 3);
  const file = square & 7;
  const centrality = centreScore(file, square >> 3);
  switch (type) {
    case "p":
      return rank * 5 + (file >= 2 && file <= 5 ? 4 : 0);
    case "n":
      return centrality * 8;
    case "b":
      return centrality * 5;
    case "r":
      return rank === 6 ? 12 : 0;
    case "k":
      return rank === 0 ? 15 : 0;
    default:
      return 0;
  }
};

/** Returns 3 for the four central squares, 0 for the outer ring. */
const centreScore = (file: number, rank: number): number => {
  const fileDistance = Math.abs(file * 2 - 7);
  const rankDistance = Math.abs(rank * 2 - 7);
  return (7 - Math.max(fileDistance, rankDistance)) / 2;
};
