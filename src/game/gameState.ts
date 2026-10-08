import { generateLegalMoves, moveToUci } from "../engine/moveGen";
import { moveToSan } from "../engine/notation";
import { makeMove, parseFen, type Position } from "../engine/position";
import { evaluateStatus, positionKey, type GameStatus } from "../engine/rules";
import {
  DIFFICULTIES,
  fail,
  ok,
  oppositeColor,
  type Color,
  type Difficulty,
  type Result,
} from "../engine/types";

/** Start position used by every new game. */
export const STANDARD_START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** Longest game the importer accepts, comfortably above the 5,949 half-move record. */
const MAX_IMPORTED_MOVES = 2000;

const UCI_PATTERN = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

/**
 * The exported save format. Keep this shape stable so saved games stay portable between games.
 * `moves` holds every half-move in UCI form, in order.
 */
export interface GameState {
  readonly version: 1;
  readonly startFen: string;
  readonly playerColor: Color;
  readonly difficulty: Difficulty;
  readonly moves: readonly string[];
  readonly resigned: boolean;
}

/** A finished game result from the human resigning or from the board itself. */
export type GameOutcome = GameStatus | { readonly kind: "resigned"; readonly winner: Color };

export interface MoveRecord {
  readonly uci: string;
  readonly san: string;
}

/** A validated game with every position reached, ready to display and play on. */
export interface GameSession {
  readonly state: GameState;
  readonly positions: readonly Position[];
  readonly moveRecords: readonly MoveRecord[];
  readonly outcome: GameOutcome;
}

export type BridgeResult = "1-0" | "0-1" | "1/2-1/2" | "*";

/** Creates the state for a fresh game with no moves played. */
export const createNewState = (playerColor: Color, difficulty: Difficulty): GameState => ({
  version: 1,
  startFen: STANDARD_START_FEN,
  playerColor,
  difficulty,
  moves: [],
  resigned: false,
});

/**
 * Replays a state through the rules engine. Every move is checked for legality, and no move
 * may follow a finished game. Returns an error that names the first problem found.
 */
export const replayGame = (state: GameState): Result<GameSession> => {
  const start = parseFen(state.startFen);
  if (!start.ok) {
    return fail(`Start position is invalid: ${start.error}`);
  }
  const positions: Position[] = [start.value];
  const keys: string[] = [positionKey(start.value)];
  const moveRecords: MoveRecord[] = [];
  let outcome: GameStatus = evaluateStatus(start.value, 1);

  for (const [index, uci] of state.moves.entries()) {
    const moveNumber = index + 1;
    if (outcome.kind !== "ongoing") {
      return fail(`Move ${moveNumber} (${uci}) comes after the game has already finished`);
    }
    const current = positions[positions.length - 1];
    if (current === undefined) {
      return fail("Internal error: no current position");
    }
    const legal = generateLegalMoves(current);
    const move = legal.find((candidate) => moveToUci(candidate) === uci);
    if (move === undefined) {
      return fail(`Move ${moveNumber} (${uci}) is not legal`);
    }
    moveRecords.push({ uci, san: moveToSan(current, move, legal) });
    const next = makeMove(current, move);
    const key = positionKey(next);
    keys.push(key);
    positions.push(next);
    outcome = evaluateStatus(next, keys.filter((candidate) => candidate === key).length);
  }

  const finalOutcome: GameOutcome = state.resigned
    ? { kind: "resigned", winner: oppositeColor(state.playerColor) }
    : outcome;
  return ok({ state, positions, moveRecords, outcome: finalOutcome });
};

/** Adds one UCI move to a session, returning the new session or the reason it was refused. */
export const appendMove = (session: GameSession, uci: string): Result<GameSession> =>
  replayGame({ ...session.state, moves: [...session.state.moves, uci] });

/** Marks the human as having resigned. The opponent wins. */
export const resignGame = (session: GameSession): GameSession => {
  const winner = oppositeColor(session.state.playerColor);
  return {
    ...session,
    state: { ...session.state, resigned: true },
    outcome: { kind: "resigned", winner },
  };
};

/** Returns the current position of a session, which is the last one reached. */
export const currentPosition = (session: GameSession): Position => {
  const last = session.positions[session.positions.length - 1];
  if (last === undefined) {
    throw new Error("A game session always holds at least the start position");
  }
  return last;
};

export const resultOf = (outcome: GameOutcome): BridgeResult => {
  if (outcome.kind === "resigned" || outcome.kind === "checkmate") {
    return outcome.winner === "white" ? "1-0" : "0-1";
  }
  if (outcome.kind === "draw") {
    return "1/2-1/2";
  }
  return "*";
};

/** Summary shape the save bridge reports alongside the state. */
export const summarizeGame = (session: GameSession): { readonly result: BridgeResult; readonly moveCount: number } => ({
  result: resultOf(session.outcome),
  moveCount: session.state.moves.length,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isColor = (value: unknown): value is Color => value === "white" || value === "black";

const isDifficulty = (value: unknown): value is Difficulty =>
  typeof value === "string" && DIFFICULTIES.some((candidate) => candidate === value);

const isUciString = (value: unknown): value is string => typeof value === "string" && UCI_PATTERN.test(value);

/**
 * Checks the shape of an imported state. Legality is not checked here; replayGame does that.
 * Unknown extra fields are dropped so the stored value is exactly the documented shape.
 */
export const parseGameState = (value: unknown): Result<GameState> => {
  if (!isRecord(value)) {
    return fail("Saved game must be a JSON object");
  }
  if (value.version !== 1) {
    return fail("Unsupported save version, expected 1");
  }
  if (typeof value.startFen !== "string" || !parseFen(value.startFen).ok) {
    return fail("startFen must be a valid FEN string");
  }
  if (!isColor(value.playerColor)) {
    return fail("playerColor must be \"white\" or \"black\"");
  }
  if (!isDifficulty(value.difficulty)) {
    return fail("difficulty must be easy, medium, hard or expert");
  }
  if (!Array.isArray(value.moves) || value.moves.length > MAX_IMPORTED_MOVES) {
    return fail(`moves must be an array of at most ${MAX_IMPORTED_MOVES} UCI strings`);
  }
  if (!value.moves.every(isUciString)) {
    return fail("Every move must be a UCI string such as e2e4 or e7e8q");
  }
  if (typeof value.resigned !== "boolean") {
    return fail("resigned must be true or false");
  }
  return ok({
    version: 1,
    startFen: value.startFen,
    playerColor: value.playerColor,
    difficulty: value.difficulty,
    moves: value.moves,
    resigned: value.resigned,
  });
};
