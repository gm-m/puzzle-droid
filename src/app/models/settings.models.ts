export interface AppSettings {
  boardTheme: 'brown' | 'green' | 'blue' | 'grey';
  pieceSet: 'cburnett' | 'merida' | 'alpha' | 'kosal';
  is3d: boolean;
  darkMode: boolean;
  showCoordinates: boolean;
  highlightLastMove: boolean;
  /** Promote straight to a queen in analysis; puzzles always ask, so underpromotions stay solvable. */
  autoQueen: boolean;
  /** In puzzles, ask Stockfish whether a move different from the solution is just as good. */
  puzzleEngineCheck: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  boardTheme: 'brown',
  pieceSet: 'cburnett',
  is3d: false,
  darkMode: false,
  showCoordinates: true,
  highlightLastMove: true,
  autoQueen: false,
  puzzleEngineCheck: false,
};
