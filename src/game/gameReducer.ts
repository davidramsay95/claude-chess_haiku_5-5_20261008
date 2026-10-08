import { appendMove, createNewState, currentPosition, replayGame, resignGame, type GameSession } from "./gameState";
import type { Color, Difficulty } from "../engine/types";

/** Everything the screen needs. Pure data so the reducer can be tested without React. */
export interface AppState {
  readonly setupColor: Color;
  readonly setupDifficulty: Difficulty;
  readonly session: GameSession | null;
  /** Index into session positions currently shown. Equal to the move count when live. */
  readonly viewPly: number;
  readonly selected: number | null;
  readonly thinking: boolean;
  readonly notice: string | null;
  /** Increases whenever the game is replaced, so late engine replies can be recognised and dropped. */
  readonly generation: number;
}

export type AppAction =
  | { readonly type: "setup-color"; readonly color: Color }
  | { readonly type: "setup-difficulty"; readonly difficulty: Difficulty }
  | { readonly type: "start" }
  | { readonly type: "new-game" }
  | { readonly type: "select"; readonly square: number | null }
  | { readonly type: "move"; readonly uci: string }
  | { readonly type: "engine-started" }
  | { readonly type: "engine-move"; readonly generation: number; readonly uci: string | null }
  | { readonly type: "engine-failed"; readonly generation: number; readonly message: string }
  | { readonly type: "navigate"; readonly ply: number }
  | { readonly type: "resume" }
  | { readonly type: "resign" }
  | { readonly type: "load"; readonly session: GameSession }
  | { readonly type: "notice"; readonly message: string | null };

export const initialAppState: AppState = {
  setupColor: "white",
  setupDifficulty: "medium",
  session: null,
  viewPly: 0,
  selected: null,
  thinking: false,
  notice: null,
  generation: 0,
};

const replaceSession = (state: AppState, session: GameSession, viewPly: number): AppState => ({
  ...state,
  session,
  viewPly,
  selected: null,
  thinking: false,
  notice: null,
  generation: state.generation + 1,
});

const isLive = (state: AppState, session: GameSession): boolean =>
  state.viewPly === session.state.moves.length && session.outcome.kind === "ongoing";

/** Applies one UCI move to the live game, refusing moves that are out of turn or out of view. */
const applyMove = (state: AppState, uci: string): AppState => {
  const session = state.session;
  if (session === null) {
    return { ...state, notice: "Start a game first" };
  }
  if (!isLive(state, session)) {
    return { ...state, notice: "Go back to the latest position to play a move" };
  }
  if (currentPosition(session).sideToMove !== session.state.playerColor) {
    return { ...state, notice: "Wait for the engine to move" };
  }
  const result = appendMove(session, uci);
  if (!result.ok) {
    return { ...state, notice: result.error, selected: null };
  }
  return { ...state, session: result.value, viewPly: result.value.state.moves.length, selected: null, notice: null };
};

/**
 * Pure state transitions for the whole screen. Engine replies and bridge loads go through the
 * same validation as human moves, so no path can put the board into an illegal state.
 */
export const gameReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case "setup-color":
      return { ...state, setupColor: action.color };
    case "setup-difficulty":
      return { ...state, setupDifficulty: action.difficulty };
    case "start": {
      const result = replayGame(createNewState(state.setupColor, state.setupDifficulty));
      return result.ok ? replaceSession(state, result.value, 0) : { ...state, notice: result.error };
    }
    case "new-game":
      return { ...state, session: null, viewPly: 0, selected: null, thinking: false, notice: null, generation: state.generation + 1 };
    case "select":
      return { ...state, selected: action.square };
    case "move":
      return applyMove(state, action.uci);
    case "engine-started":
      return { ...state, thinking: true };
    case "engine-move": {
      if (action.generation !== state.generation || state.session === null) {
        return state;
      }
      if (action.uci === null) {
        return { ...state, thinking: false, notice: "The engine could not find a move" };
      }
      const result = appendMove(state.session, action.uci);
      if (!result.ok) {
        return { ...state, thinking: false, notice: `Engine move rejected: ${result.error}` };
      }
      return { ...state, session: result.value, viewPly: result.value.state.moves.length, thinking: false, notice: null };
    }
    case "engine-failed":
      if (action.generation !== state.generation) {
        return state;
      }
      return { ...state, thinking: false, notice: action.message };
    case "navigate": {
      const last = state.session?.state.moves.length ?? 0;
      return { ...state, viewPly: Math.min(Math.max(action.ply, 0), last), selected: null };
    }
    case "resume": {
      if (state.session === null) {
        return state;
      }
      const moves = state.session.state.moves.slice(0, state.viewPly);
      const result = replayGame({ ...state.session.state, moves, resigned: false });
      if (!result.ok) {
        return { ...state, notice: result.error };
      }
      return replaceSession(state, result.value, result.value.state.moves.length);
    }
    case "resign": {
      if (state.session === null || state.session.outcome.kind !== "ongoing") {
        return state;
      }
      return { ...state, session: resignGame(state.session), thinking: false, selected: null, notice: null };
    }
    case "load":
      return replaceSession(state, action.session, action.session.state.moves.length);
    case "notice":
      return { ...state, notice: action.message };
  }
};
