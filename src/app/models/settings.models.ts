export interface AppSettings {
  boardTheme: 'brown' | 'green' | 'blue' | 'grey';
  pieceSet: 'cburnett'; // Currently only cburnett is available locally
  showCoordinates: boolean;
  highlightLastMove: boolean;
  autoQueen: boolean; // Just as a placeholder for professional feel
}

export const DEFAULT_SETTINGS: AppSettings = {
  boardTheme: 'brown',
  pieceSet: 'cburnett',
  showCoordinates: true,
  highlightLastMove: true,
  autoQueen: false,
};
