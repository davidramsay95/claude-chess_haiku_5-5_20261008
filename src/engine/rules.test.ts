import { describe, expect, it } from "vitest";
import { parseFen, type Position } from "./position";
import { evaluateStatus, isInsufficientMaterial, positionKey } from "./rules";
import { findLegalMove, generateLegalMoves } from "./moveGen";
import { makeMove } from "./position";

const loadFen = (fen: string): Position => {
  const result = parseFen(fen);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
};

describe("insufficient material", () => {
  it.each([
    ["king against king", "4k3/8/8/8/8/8/8/4K3 w - - 0 1"],
    ["king and bishop against king", "4k3/8/8/8/8/8/8/3BK3 w - - 0 1"],
    ["king and knight against king", "4k3/8/8/8/8/8/8/3NK3 w - - 0 1"],
    ["bishops on the same colour", "3bk3/8/8/8/8/8/8/2B1K3 w - - 0 1"],
  ])("treats %s as a dead position", (_name, fen) => {
    expect(isInsufficientMaterial(loadFen(fen).board)).toBe(true);
  });

  it.each([
    ["a pawn remains", "4k3/8/8/8/8/8/P7/4K3 w - - 0 1"],
    ["a rook remains", "4k3/8/8/8/8/8/8/R3K3 w - - 0 1"],
    ["a queen remains", "4k3/8/8/8/8/8/8/3QK3 w - - 0 1"],
    ["two knights against king", "4k3/8/8/8/8/8/8/N1N1K3 w - - 0 1"],
    ["bishops on opposite colours", "2b1k3/8/8/8/8/8/8/2B1K3 w - - 0 1"],
  ])("does not treat %s as dead", (_name, fen) => {
    expect(isInsufficientMaterial(loadFen(fen).board)).toBe(false);
  });
});

describe("terminal status", () => {
  it("reports checkmate with the winner", () => {
    const pos = loadFen("rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3");
    expect(evaluateStatus(pos, 1)).toEqual({ kind: "checkmate", winner: "black" });
  });

  it("reports stalemate as a draw", () => {
    const pos = loadFen("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
    expect(evaluateStatus(pos, 1)).toEqual({ kind: "draw", reason: "stalemate" });
  });

  it("reports the fifty-move rule once the halfmove clock reaches one hundred", () => {
    const pos = loadFen("4k3/8/8/8/8/8/8/R3K3 w - - 100 80");
    expect(evaluateStatus(pos, 1)).toEqual({ kind: "draw", reason: "fifty-move" });
  });

  it("keeps the game going just before the fifty-move limit", () => {
    const pos = loadFen("4k3/8/8/8/8/8/8/R3K3 w - - 99 80");
    expect(evaluateStatus(pos, 1)).toEqual({ kind: "ongoing" });
  });

  it("reports threefold repetition when the position has occurred three times", () => {
    const pos = loadFen("4k3/8/8/8/8/8/8/R3K3 w - - 0 1");
    expect(evaluateStatus(pos, 3)).toEqual({ kind: "draw", reason: "threefold-repetition" });
    expect(evaluateStatus(pos, 2)).toEqual({ kind: "ongoing" });
  });

  it("gives checkmate priority over the fifty-move rule", () => {
    const pos = loadFen("rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 100 3");
    expect(evaluateStatus(pos, 1)).toEqual({ kind: "checkmate", winner: "black" });
  });
});

describe("position key for repetition", () => {
  it("ignores the en passant square when no en passant capture is legal", () => {
    const withEp = loadFen("4k3/8/8/3p4/4P3/8/8/4K3 b - e3 0 1");
    const withoutEp = loadFen("4k3/8/8/3p4/4P3/8/8/4K3 b - - 0 1");
    expect(positionKey(withEp)).toBe(positionKey(withoutEp));
  });

  it("includes the en passant square when an en passant capture is legal", () => {
    const withEp = loadFen("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1");
    const withoutEp = loadFen("4k3/8/8/3pP3/8/8/8/4K3 w - - 0 1");
    expect(positionKey(withEp)).not.toBe(positionKey(withoutEp));
  });

  it("matches after a knight shuffles out and back", () => {
    const start = loadFen("4k3/8/8/8/8/8/8/1N2K3 w - - 0 1");
    const step = (pos: Position, uci: string): Position => {
      const move = findLegalMove(pos, uci);
      if (move === null) {
        throw new Error(`Illegal move ${uci}`);
      }
      return makeMove(pos, move);
    };
    const cycled = step(step(step(step(start, "b1c3"), "e8d8"), "c3b1"), "d8e8");
    expect(positionKey(cycled)).toBe(positionKey(start));
    expect(generateLegalMoves(cycled).length).toBeGreaterThan(0);
  });
});
