export interface AppSettings {
  boardTheme: 'brown' | 'green' | 'blue' | 'grey';
  pieceSet: 'cburnett' | 'merida' | 'alpha' | 'kosal';
  darkMode: boolean;
  showCoordinates: boolean;
  highlightLastMove: boolean;
  autoQueen: boolean; // Just as a placeholder for professional feel
}

export const DEFAULT_SETTINGS: AppSettings = {
  boardTheme: 'brown',
  pieceSet: 'cburnett',
  darkMode: false,
  showCoordinates: true,
  highlightLastMove: true,
  autoQueen: false,
};
