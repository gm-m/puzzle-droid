export type LibraryMode = 'view' | 'puzzle';

export interface PgnLibraryItem {
  id: string;
  name: string;
  pgn: string;
  mode: LibraryMode;
  event?: string;
  white?: string;
  black?: string;
  result?: string;
}
