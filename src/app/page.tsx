"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Cell = string | null;
type Grid = Cell[][];

const ROWS = 20;
const COLS = 10;

const SHAPES: number[][][] = [
  // I
  [
    [1, 1, 1, 1],
  ],
  // O
  [
    [1, 1],
    [1, 1],
  ],
  // T
  [
    [0, 1, 0],
    [1, 1, 1],
  ],
  // S
  [
    [0, 1, 1],
    [1, 1, 0],
  ],
  // Z
  [
    [1, 1, 0],
    [0, 1, 1],
  ],
  // J
  [
    [1, 0, 0],
    [1, 1, 1],
  ],
  // L
  [
    [0, 0, 1],
    [1, 1, 1],
  ],
];

const COLORS = [
  "#f5b700",
  "#f25f5c",
  "#50514f",
  "#70c1b3",
  "#247ba0",
  "#ffe066",
  "#ff9f1c",
];

type Piece = {
  shape: number[][];
  x: number;
  y: number;
  color: string;
};

function createEmptyGrid(): Grid {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null) as Cell[]);
}

function rotateMatrix(matrix: number[][]): number[][] {
  return matrix[0].map((_, i) => matrix.map((row) => row[i]).reverse());
}

function getRandomPiece(): Piece {
  const index = Math.floor(Math.random() * SHAPES.length);
  const shape = SHAPES[index];
  const color = COLORS[index % COLORS.length];
  const x = Math.floor((COLS - shape[0].length) / 2);
  return { shape, x, y: 0, color };
}

function hasCollision(grid: Grid, piece: Piece, offsetX = 0, offsetY = 0): boolean {
  const { shape, x, y } = piece;
  for (let row = 0; row < shape.length; row += 1) {
    for (let col = 0; col < shape[row].length; col += 1) {
      if (!shape[row][col]) continue;
      const newX = x + col + offsetX;
      const newY = y + row + offsetY;
      if (newX < 0 || newX >= COLS || newY >= ROWS) return true;
      if (newY >= 0 && grid[newY][newX]) return true;
    }
  }
  return false;
}

function mergePiece(grid: Grid, piece: Piece): Grid {
  const nextGrid = grid.map((row) => [...row]) as Grid;
  piece.shape.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        const gridY = piece.y + y;
        const gridX = piece.x + x;
        if (gridY >= 0 && gridY < ROWS && gridX >= 0 && gridX < COLS) {
          nextGrid[gridY][gridX] = piece.color;
        }
      }
    });
  });
  return nextGrid;
}

function clearLines(grid: Grid): { grid: Grid; cleared: number } {
  const newGrid = grid.filter((row) => row.some((cell) => cell === null));
  const cleared = ROWS - newGrid.length;
  while (newGrid.length < ROWS) {
    newGrid.unshift(Array(COLS).fill(null) as Cell[]);
  }
  return { grid: newGrid, cleared };
}

export default function Home() {
  const [started, setStarted] = useState(false);
  const [username, setUsername] = useState("");
  const [hasName, setHasName] = useState(false);
  const [grid, setGrid] = useState<Grid>(() => createEmptyGrid());
  const [piece, setPiece] = useState<Piece>(() => getRandomPiece());
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [tickMs, setTickMs] = useState(550);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const displayGrid = useMemo(() => {
    const merged = mergePiece(grid, piece);
    return merged;
  }, [grid, piece]);

  useEffect(() => {
    if (!started || gameOver) return;
    const interval = setInterval(() => {
      setPiece((prev) => {
        if (!hasCollision(grid, prev, 0, 1)) {
          return { ...prev, y: prev.y + 1 };
        }
        const merged = mergePiece(grid, prev);
        const { grid: clearedGrid, cleared } = clearLines(merged);
        if (cleared > 0) {
          setScore((s) => s + cleared * 100);
          setTickMs((ms) => Math.max(120, ms - cleared * 15));
        }
        const nextPiece = getRandomPiece();
        setGrid(clearedGrid);
        if (hasCollision(clearedGrid, nextPiece, 0, 0)) {
          setGameOver(true);
          return prev;
        }
        return nextPiece;
      });
    }, tickMs);
    return () => clearInterval(interval);
  }, [grid, started, gameOver, tickMs]);

  useEffect(() => {
    if (!started) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (gameOver) return;
      if (event.key === "ArrowLeft") {
        setPiece((prev) =>
          hasCollision(grid, prev, -1, 0) ? prev : { ...prev, x: prev.x - 1 }
        );
      } else if (event.key === "ArrowRight") {
        setPiece((prev) =>
          hasCollision(grid, prev, 1, 0) ? prev : { ...prev, x: prev.x + 1 }
        );
      } else if (event.key === "ArrowDown") {
        setPiece((prev) =>
          hasCollision(grid, prev, 0, 1) ? prev : { ...prev, y: prev.y + 1 }
        );
      } else if (event.key === "ArrowUp") {
        setPiece((prev) => {
          const rotated = rotateMatrix(prev.shape);
          const rotatedPiece = { ...prev, shape: rotated };
          return hasCollision(grid, rotatedPiece, 0, 0) ? prev : rotatedPiece;
        });
      } else if (event.key === " ") {
        setPiece((prev) => {
          let dropY = prev.y;
          while (!hasCollision(grid, prev, 0, dropY - prev.y + 1)) {
            dropY += 1;
          }
          return { ...prev, y: dropY };
        });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [started, grid, gameOver]);

  const startGame = async () => {
    if (!username.trim()) return;
    setStarted(true);
    setGameOver(false);
    setScore(0);
    setTickMs(550);
    setGrid(createEmptyGrid());
    setPiece(getRandomPiece());
    try {
      await audioRef.current?.play();
    } catch {
      // Autoplay might be blocked until user interaction, ignore errors.
    }
  };

  const resetGame = () => {
    setStarted(false);
    setGameOver(false);
    setScore(0);
    setTickMs(550);
    setGrid(createEmptyGrid());
    setPiece(getRandomPiece());
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const handleNameSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!username.trim()) return;
    setHasName(true);
    await startGame();
  };

  const containerClassName = hasName
    ? "flex w-full max-w-4xl flex-col items-center gap-6 rounded-3xl bg-white/85 p-8 text-neutral-900 shadow-2xl backdrop-blur-md transition-all duration-300"
    : "flex flex-col items-center gap-6 transition-all duration-300";

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <audio ref={audioRef} src="/feeling-good.mp3" preload="auto" />
      <div className={containerClassName}>
        <h1 className="text-4xl font-semibold">
          {started ? `Hello ${username}` : "Hello World"}
        </h1>
        <form onSubmit={handleNameSubmit} className="relative z-10 w-full max-w-md">
          <div className="flex items-center gap-3 rounded-full border border-neutral-300 bg-white/90 px-4 py-3 shadow-sm">
            <span className="text-base font-semibold text-neutral-700">Hello</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="your name"
              className="flex-1 bg-transparent text-lg font-semibold text-neutral-900 outline-none"
              aria-label="Your name"
            />
          </div>
          <p className="mt-2 text-sm text-neutral-600">
            Press Enter to start Tetris and the music.
          </p>
        </form>
        {started && (
          <button
            type="button"
            onClick={resetGame}
            className="rounded-full border border-neutral-800 px-4 py-2 text-sm font-semibold text-neutral-900"
          >
            Stop & Reset
          </button>
        )}
        <div
          className={`flex flex-wrap items-start justify-center gap-6 transition-all duration-700 ease-out ${
            started ? "translate-y-0 opacity-100" : "-translate-y-24 opacity-0"
          }`}
        >
          <div className="grid grid-rows-[repeat(20,_1fr)] gap-1 rounded-xl bg-neutral-900 p-3 shadow-lg">
            {displayGrid.map((row, rowIndex) => (
              <div key={`row-${rowIndex}`} className="grid grid-cols-[repeat(10,_1fr)] gap-1">
                {row.map((cell, colIndex) => (
                  <div
                    key={`cell-${rowIndex}-${colIndex}`}
                    className="h-4 w-4 rounded-sm"
                    style={{ backgroundColor: cell ?? "#1f2937" }}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="min-w-[200px] space-y-3 text-left">
            <p className="text-lg font-semibold">Score: {score}</p>
            <p className="text-sm text-neutral-700">
              Controls: Arrow keys to move, Up to rotate, Space to drop.
            </p>
            {gameOver && (
              <div className="rounded-lg bg-red-100 p-3 text-sm font-semibold text-red-700">
                Game Over
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
