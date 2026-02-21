export type EngineScore =
  | {
      type: 'cp';
      value: number;
    }
  | {
      type: 'mate';
      value: number;
    };

export interface EngineLine {
  multipv: number;
  depth: number;
  score: EngineScore;
  pv: string[];
}

export type StockfishEvent =
  | {
      type: 'line';
      lines: EngineLine[];
    }
  | {
      type: 'bestmove';
      bestMove: string;
    }
  | {
      type: 'error';
      message: string;
    };
