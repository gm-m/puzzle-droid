export interface AppSettings {
  boardTheme: 'brown' | 'green' | 'blue' | 'grey';
  pieceSet: 'cburnett' | 'merida' | 'alpha' | 'kosal';
  is3d: boolean;
  darkMode: boolean;
  showCoordinates: boolean;
  highlightLastMove: boolean;
  autoQueen: boolean; // Just as a placeholder for professional feel
}

export const DEFAULT_SETTINGS: AppSettings = {
  boardTheme: 'brown',
  pieceSet: 'cburnett',
  is3d: false,
  darkMode: false,
  showCoordinates: true,
  highlightLastMove: true,
  autoQueen: false,
};
