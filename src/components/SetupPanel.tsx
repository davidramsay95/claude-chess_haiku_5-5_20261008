import type { ReactElement } from "react";
import { DIFFICULTIES, type Color, type Difficulty } from "../engine/types";

interface SetupPanelProps {
  readonly color: Color;
  readonly difficulty: Difficulty;
  readonly onColor: (color: Color) => void;
  readonly onDifficulty: (difficulty: Difficulty) => void;
  readonly onStart: () => void;
}

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  expert: "Expert",
};

/** The pre-game screen where the player picks a colour and strength. */
export const SetupPanel = ({ color, difficulty, onColor, onDifficulty, onStart }: SetupPanelProps): ReactElement => (
  <section className="setup" aria-labelledby="setup-heading">
    <h2 id="setup-heading">New game</h2>
    <fieldset className="choice-group">
      <legend>Play as</legend>
      {(["white", "black"] as const).map((option) => (
        <label key={option} className="choice">
          <input type="radio" name="color" value={option} checked={color === option} onChange={() => onColor(option)} />
          {option === "white" ? "White" : "Black"}
        </label>
      ))}
    </fieldset>
    <fieldset className="choice-group">
      <legend>Strength</legend>
      {DIFFICULTIES.map((option) => (
        <label key={option} className="choice">
          <input type="radio" name="difficulty" value={option} checked={difficulty === option} onChange={() => onDifficulty(option)} />
          {DIFFICULTY_LABELS[option]}
        </label>
      ))}
    </fieldset>
    <button type="button" className="primary" onClick={onStart}>
      Start game
    </button>
  </section>
);
