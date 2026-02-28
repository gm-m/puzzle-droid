export type LibraryMode = 'view' | 'puzzle';

export interface PgnLibraryPosition {
  id: string;
  ply: number;
  moveNumber: number;
  turn: 'white' | 'black';
  san: string;
  label: string;
  fen: string;
  uciHistory: string[];
}

export interface PgnLibraryGame {
  id: string;
  event?: string;
  white?: string;
  black?: string;
  result?: string;
  initialFen: string;
  positions: PgnLibraryPosition[];
}

export interface PgnLibraryItem {
  id: string;
  name: string;
  pgn: string;
  mode: LibraryMode;
  woodpeckerInitialTargetDays?: number;
  games: PgnLibraryGame[];
  event?: string;
  white?: string;
  black?: string;
  result?: string;
}
