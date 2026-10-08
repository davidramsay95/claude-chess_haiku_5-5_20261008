import { describe, expect, it } from "vitest";
import { makeMove, parseFen, type Position } from "./position";
import { countPerft } from "./perft";
import { findLegalMove, generateLegalMoves, moveToUci } from "./moveGen";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const KIWIPETE_FEN = "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1";

/** Loads a FEN and fails the test if it does not parse. */
const loadFen = (fen: string): Position => {
  const result = parseFen(fen);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
};

describe("perft from the start position", () => {
  it.each([
    [1, 20],
    [2, 400],
    [3, 8902],
    [4, 197281],
  ])("depth %i gives %i nodes", (depth, expected) => {
    expect(countPerft(loadFen(START_FEN), depth)).toBe(expected);
  });
});

describe("perft from Kiwipete", () => {
  it.each([
    [1, 48],
    [2, 2039],
    [3, 97862],
  ])("depth %i gives %i nodes", (depth, expected) => {
    expect(countPerft(loadFen(KIWIPETE_FEN), depth)).toBe(expected);
  });
});

describe("special move rules", () => {
  it("allows castling on both sides when the path is clear and safe", () => {
    const moves = generateLegalMoves(loadFen("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1")).map(moveToUci);
    expect(moves).toContain("e1g1");
    expect(moves).toContain("e1c1");
  });

  it("forbids castling out of check", () => {
    const moves = generateLegalMoves(loadFen("r3k2r/8/8/8/4r3/8/8/R3K2R w KQkq - 0 1")).map(moveToUci);
    expect(moves).not.toContain("e1g1");
    expect(moves).not.toContain("e1c1");
  });

  it("forbids castling through an attacked square", () => {
    // The black rook on f8 attacks f1, which the king would cross when castling kingside.
    const moves = generateLegalMoves(loadFen("5rk1/8/8/8/8/8/8/R3K2R w KQ - 0 1")).map(moveToUci);
    expect(moves).not.toContain("e1g1");
  });

  it("forbids castling when the king would land on an attacked square", () => {
    const moves = generateLegalMoves(loadFen("1k4r1/8/8/8/8/8/8/R3K2R w KQ - 0 1")).map(moveToUci);
    expect(moves).not.toContain("e1g1");
  });

  it("allows queenside castling even when the b-file square is attacked", () => {
    const moves = generateLegalMoves(loadFen("1r2k3/8/8/8/8/8/8/R3K3 w Q - 0 1")).map(moveToUci);
    expect(moves).toContain("e1c1");
  });

  it("removes castling rights after the king moves", () => {
    const start = loadFen("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    const afterKingMove = makeMove(start, findLegalMove(start, "e1e2") ?? failMissing("e1e2"));
    const afterReturn = makeMove(afterKingMove, findLegalMove(afterKingMove, "e8e7") ?? failMissing("e8e7"));
    const back = makeMove(afterReturn, findLegalMove(afterReturn, "e2e1") ?? failMissing("e2e1"));
    const moves = generateLegalMoves(makeMove(back, findLegalMove(back, "e7e8") ?? failMissing("e7e8"))).map(moveToUci);
    expect(moves).not.toContain("e1g1");
    expect(moves).not.toContain("e1c1");
  });

  it("allows en passant capture immediately after a double push", () => {
    const pos = loadFen("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1");
    expect(generateLegalMoves(pos).map(moveToUci)).toContain("e5d6");
  });

  it("forbids en passant that exposes the king to a rook along the rank", () => {
    const pos = loadFen("8/8/8/KPp4r/8/8/8/7k w - c6 0 1");
    expect(generateLegalMoves(pos).map(moveToUci)).not.toContain("b5c6");
  });

  it("requires a promotion piece and offers all four choices", () => {
    const pos = loadFen("4k3/P7/8/8/8/8/8/4K3 w - - 0 1");
    const promotions = generateLegalMoves(pos).map(moveToUci).filter((uci) => uci.startsWith("a7a8"));
    expect(promotions.sort()).toEqual(["a7a8b", "a7a8n", "a7a8q", "a7a8r"]);
    expect(findLegalMove(pos, "a7a8")).toBeNull();
  });
});

describe("check, checkmate and stalemate", () => {
  it("only allows moves that resolve check, including capturing the checker", () => {
    const pos = loadFen("4k3/8/8/8/8/8/4r3/R3K3 w - - 0 1");
    const moves = generateLegalMoves(pos).map(moveToUci).sort();
    expect(moves).toEqual(["e1d1", "e1e2", "e1f1"]);
  });

  it("returns no legal moves for a checkmated side", () => {
    // Fool's mate: white is checkmated.
    const pos = loadFen("rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3");
    expect(generateLegalMoves(pos)).toHaveLength(0);
  });

  it("returns no legal moves for a stalemated side that is not in check", () => {
    const pos = loadFen("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
    expect(generateLegalMoves(pos)).toHaveLength(0);
  });
});

/** Throws with the missing move name so a broken fixture is easy to spot. */
function failMissing(uci: string): never {
  throw new Error(`Expected legal move ${uci}`);
}
