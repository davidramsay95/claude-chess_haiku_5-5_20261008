import { describe, expect, it } from "vitest";
import { parseFen, makeMove, type Position } from "./position";
import { findLegalMove, generateLegalMoves } from "./moveGen";
import { moveToSan } from "./notation";

const loadFen = (fen: string): Position => {
  const result = parseFen(fen);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
};

/** Returns the SAN of a UCI move in the given position. */
const sanOf = (fen: string, uci: string): string => {
  const pos = loadFen(fen);
  const move = findLegalMove(pos, uci);
  if (move === null) {
    throw new Error(`Illegal test move ${uci}`);
  }
  return moveToSan(pos, move, generateLegalMoves(pos));
};

describe("SAN notation", () => {
  it("writes pawn pushes and captures", () => {
    expect(sanOf("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "e2e4")).toBe("e4");
    expect(sanOf("rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", "e4d5")).toBe("exd5");
  });

  it("writes piece moves with check and mate markers", () => {
    expect(sanOf("rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2", "d8h4")).toBe("Qh4#");
  });

  it("disambiguates by file when two knights can reach the same square", () => {
    expect(sanOf("4k3/8/8/8/8/8/8/1N1K1N2 w - - 0 1", "b1d2")).toBe("Nbd2");
    expect(sanOf("4k3/8/8/8/8/8/8/1N1K1N2 w - - 0 1", "f1d2")).toBe("Nfd2");
  });

  it("writes castling", () => {
    expect(sanOf("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", "e1g1")).toBe("O-O");
    expect(sanOf("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", "e1c1")).toBe("O-O-O");
  });

  it("writes promotion with the chosen piece", () => {
    expect(sanOf("4k3/P7/8/8/8/8/8/4K3 w - - 0 1", "a7a8n")).toBe("a8=N");
  });

  it("writes en passant as a pawn capture", () => {
    expect(sanOf("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1", "e5d6")).toBe("exd6");
  });

  it("does not use a check marker for a quiet move", () => {
    const pos = loadFen("4k3/8/8/8/8/8/8/4K2R w - - 0 1");
    const after = makeMove(pos, findLegalMove(pos, "h1h2") ?? failNoMove());
    expect(after.halfmoveClock).toBe(1);
    expect(sanOf("4k3/8/8/8/8/8/8/4K2R w - - 0 1", "h1h2")).toBe("Rh2");
  });
});

/** Throws when a fixture move is missing. */
function failNoMove(): never {
  throw new Error("Expected a legal move in fixture");
}
