import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { Chess } from 'chess.js';
import type { Move as ChessMove } from 'chess.js';
import type { Key } from 'chessground/types';
import { AnalysisPanelComponent, type LineMoveSelection } from '../analysis-panel/analysis-panel';
import { ChessBoardComponent, type BoardMove } from '../chess-board/chess-board';
import { EvalBarComponent } from '../eval-bar/eval-bar';
import {
  LibraryPanelComponent,
  type LibraryGameSelection,
  type LibraryModeChange,
} from '../library-panel/library-panel';
import type { EngineLine, EngineScore, StockfishEvent } from '../../models/engine.models';
import type { PgnLibraryGame, PgnLibraryItem, PgnLibraryPosition } from '../../models/library.models';
import { StockfishService } from '../../services/stockfish.service';

@Component({
  selector: 'app-test',
  imports: [CommonModule, ChessBoardComponent, EvalBarComponent, AnalysisPanelComponent, LibraryPanelComponent],
  templateUrl: './test.html',
  styleUrl: './test.scss',
})
export class Test implements OnInit, OnDestroy {
  private static readonly STARTING_FEN = new Chess().fen();
  private static readonly PUZZLE_AUTO_MOVE_DELAY_MS = 700;

  readonly activeView = signal<'analysis' | 'library'>('analysis');
  readonly isMenuOpen = signal(false);

  readonly currentFen = signal('');
  readonly turnColor = signal<'white' | 'black'>('white');
  readonly legalDests = signal<Map<Key, Key[]>>(new Map());

  readonly moveHistory = signal<string[]>([]);
  readonly moveCursor = signal(0);

  readonly bestMove = signal('-');
  readonly evalLabel = signal('-');
  readonly isAnalyzing = signal(false);
  readonly lines = signal<EngineLine[]>([]);
  readonly primaryScore = signal<EngineScore | null>(null);

  readonly depth = signal(12);
  readonly multiPv = signal(1);
  readonly showEvalBar = signal(true);
  readonly fenFeedback = signal('');
  readonly puzzleMessage = signal('');

  readonly isPuzzleMode = signal(false);
  readonly isPuzzleSurrendered = signal(false);
  readonly isPuzzleAutoPlaying = signal(false);

  readonly libraryItems = signal<PgnLibraryItem[]>([]);

  private readonly chess = new Chess();
  private historyInitialFen = Test.STARTING_FEN;
  private puzzleAutoMoveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly stockfish: StockfishService) {}

  ngOnInit(): void {
    this.syncGameState();
    this.stockfish.setListener((event) => this.handleEngineEvent(event));
    this.stockfish.init();
    this.analyzePosition();
  }

  ngOnDestroy(): void {
    this.clearPuzzleAutoMoveTimer();
    this.stockfish.destroy();
  }

  setActiveView(view: 'analysis' | 'library'): void {
    this.activeView.set(view);
    this.isMenuOpen.set(false);
  }

  toggleMenu(): void {
    this.isMenuOpen.update((value) => !value);
  }

  async onLibraryFilesSelected(files: FileList | null): Promise<void> {
    if (!files || files.length === 0) {
      return;
    }

    const parsedItems = await Promise.all(
      Array.from(files).map(async (file, index) => {
        const pgn = await file.text();
        const itemId = `${Date.now()}-${index}-${file.name}`;
        const games = this.parsePgnGames(pgn, itemId);
        const firstGame = games[0];

        return {
          id: itemId,
          name: file.name,
          pgn,
          mode: 'view',
          games,
          event: firstGame?.event,
          white: firstGame?.white,
          black: firstGame?.black,
          result: firstGame?.result,
        } as PgnLibraryItem;
      }),
    );

    this.libraryItems.update((items) => [...parsedItems, ...items]);
  }

  onLibraryModeChanged(change: LibraryModeChange): void {
    this.libraryItems.update((items) =>
      items.map((item) => (item.id === change.id ? { ...item, mode: change.mode } : item)),
    );
  }

  onLibraryGameSelected(selection: LibraryGameSelection): void {
    try {
      this.chess.load(selection.initialFen);
    } catch {
      return;
    }

    this.historyInitialFen = selection.initialFen;
    const fullHistory = [...selection.fullUciHistory];
    this.clearPuzzleAutoMoveTimer();
    this.isPuzzleAutoPlaying.set(false);

    if (selection.mode === 'puzzle') {
      this.isPuzzleMode.set(true);
      this.isPuzzleSurrendered.set(false);
      this.stockfish.stop();
      this.puzzleMessage.set('Puzzle avviato.');
    } else {
      this.isPuzzleMode.set(false);
      this.isPuzzleSurrendered.set(false);
      this.puzzleMessage.set('');
    }

    this.moveHistory.set([...fullHistory]);
    this.moveCursor.set(0);
    this.fenFeedback.set('Partita caricata dalla libreria.');
    this.syncGameState();
    this.setActiveView('analysis');
    this.analyzePosition();

    if (selection.mode === 'puzzle') {
      if (selection.autoPlayFirstMove && fullHistory.length > 0) {
        this.schedulePuzzleAutoMove(0, 'Prima mossa in arrivo...');
      } else {
        this.puzzleMessage.set('Puzzle avviato. Fai la prima mossa corretta.');
      }
    }
  }

  onBoardMove(move: BoardMove): void {
    if (this.isPuzzleActive()) {
      if (this.isPuzzleAutoPlaying()) {
        this.syncGameState();
        return;
      }

      this.handlePuzzleMove(move);
      return;
    }

    const playedMove = this.chess.move({ from: move.from, to: move.to, promotion: 'q' });

    if (!playedMove) {
      this.syncGameState();
      return;
    }

    const branch = this.moveHistory().slice(0, this.moveCursor());
    const uci = this.toUci(playedMove.from as Key, playedMove.to as Key, playedMove.promotion);
    const updatedHistory = [...branch, uci];
    this.moveHistory.set(updatedHistory);
    this.moveCursor.set(updatedHistory.length);

    this.syncGameState();
    this.analyzePosition();
  }

  resetBoard(): void {
    this.clearPuzzleAutoMoveTimer();
    this.isPuzzleAutoPlaying.set(false);
    this.chess.reset();
    this.historyInitialFen = Test.STARTING_FEN;
    this.isPuzzleMode.set(false);
    this.isPuzzleSurrendered.set(false);
    this.puzzleMessage.set('');
    this.moveHistory.set([]);
    this.moveCursor.set(0);
    this.fenFeedback.set('');
    this.syncGameState();
    this.analyzePosition();
  }

  applyFen(rawFen: string): void {
    const fen = rawFen.trim();
    if (!fen) {
      this.fenFeedback.set('Inserisci una FEN valida.');
      return;
    }

    try {
      this.chess.load(fen);
    } catch {
      this.fenFeedback.set('FEN non valida.');
      return;
    }

    this.clearPuzzleAutoMoveTimer();
    this.isPuzzleAutoPlaying.set(false);
    this.historyInitialFen = this.chess.fen();
    this.isPuzzleMode.set(false);
    this.isPuzzleSurrendered.set(false);
    this.puzzleMessage.set('');
    this.moveHistory.set([]);
    this.moveCursor.set(0);
    this.fenFeedback.set('Posizione caricata.');
    this.syncGameState();
    this.analyzePosition();
  }

  analyzePosition(): void {
    this.isAnalyzing.set(true);
    this.bestMove.set('-');
    this.lines.set([]);
    this.primaryScore.set(null);
    this.evalLabel.set('-');

    if (this.isPuzzleActive()) {
      this.stockfish.stop();
      this.isAnalyzing.set(false);
      return;
    }

    const hasStarted = this.stockfish.analyze(this.chess.fen(), {
      depth: this.depth(),
      multiPv: this.multiPv(),
    });

    if (!hasStarted) {
      this.isAnalyzing.set(false);
    }
  }

  onDepthChange(depth: number): void {
    this.depth.set(this.clamp(depth, 1, 30));
    this.analyzePosition();
  }

  onMultiPvChange(multiPv: number): void {
    this.multiPv.set(this.clamp(multiPv, 1, 5));
    this.analyzePosition();
  }

  toggleEvalBar(): void {
    this.showEvalBar.update((value) => !value);
  }

  previousMove(): void {
    if (this.moveCursor() === 0) {
      return;
    }

    this.rebuildPositionFromHistory(this.moveCursor() - 1);
    this.analyzePosition();
  }

  nextMove(): void {
    if (this.moveCursor() >= this.moveHistory().length) {
      return;
    }

    this.rebuildPositionFromHistory(this.moveCursor() + 1);
    this.analyzePosition();
  }

  onMoveJumpRequested(targetPly: number): void {
    if (this.isPuzzleActive()) {
      return;
    }

    this.rebuildPositionFromHistory(targetPly);
    this.analyzePosition();
  }

  onPuzzleSurrender(): void {
    if (!this.isPuzzleMode() || this.isPuzzleSurrendered()) {
      return;
    }

    this.clearPuzzleAutoMoveTimer();
    this.isPuzzleAutoPlaying.set(false);
    this.isPuzzleSurrendered.set(true);
    this.puzzleMessage.set('Ti sei arreso. Engine riattivato.');
    this.analyzePosition();
  }

  onLineSelected(selection: LineMoveSelection): void {
    const lineMoves = selection.line.pv.slice(0, selection.moveIndex + 1);
    if (lineMoves.length === 0) {
      return;
    }

    const branch = this.moveHistory().slice(0, this.moveCursor());
    const executedMoves: string[] = [];

    for (const uci of lineMoves) {
      const parsedMove = this.parseUciMove(uci);
      if (!parsedMove) {
        break;
      }

      const result = this.chess.move(parsedMove);
      if (!result) {
        break;
      }

      executedMoves.push(this.toUci(result.from as Key, result.to as Key, result.promotion));
    }

    if (executedMoves.length === 0) {
      return;
    }

    const updatedHistory = [...branch, ...executedMoves];
    this.moveHistory.set(updatedHistory);
    this.moveCursor.set(updatedHistory.length);
    this.syncGameState();
    this.analyzePosition();
  }

  canGoBack(): boolean {
    if (this.isPuzzleActive()) {
      return false;
    }

    return this.moveCursor() > 0;
  }

  canGoForward(): boolean {
    if (this.isPuzzleActive()) {
      return false;
    }

    return this.moveCursor() < this.moveHistory().length;
  }

  isEngineHidden(): boolean {
    return this.isPuzzleActive();
  }

  showSurrenderButton(): boolean {
    return this.isPuzzleMode() && !this.isPuzzleSurrendered();
  }

  showMoveList(): boolean {
    return !this.isPuzzleActive();
  }

  moveCursorLabel(): string {
    return `${this.moveCursor()}/${this.moveHistory().length}`;
  }

  private syncGameState(): void {
    this.currentFen.set(this.chess.fen());
    this.turnColor.set(this.chess.turn() === 'w' ? 'white' : 'black');
    this.legalDests.set(this.getLegalDestinations());
  }

  private handlePuzzleMove(move: BoardMove): void {
    const history = this.moveHistory();
    const cursor = this.moveCursor();
    const expectedUci = history[cursor];

    if (!expectedUci) {
      this.puzzleMessage.set('Puzzle completato.');
      this.syncGameState();
      return;
    }

    const expectedMove = this.parseUciMove(expectedUci);
    if (!expectedMove) {
      this.puzzleMessage.set('PGN puzzle non valido.');
      this.syncGameState();
      return;
    }

    if (move.from !== expectedMove.from || move.to !== expectedMove.to) {
      this.puzzleMessage.set('Mossa sbagliata, riprova.');
      this.syncGameState();
      return;
    }

    const result = this.chess.move({
      from: move.from,
      to: move.to,
      promotion: expectedMove.promotion ?? 'q',
    });
    if (!result) {
      this.puzzleMessage.set('Mossa non valida in questa posizione.');
      this.syncGameState();
      return;
    }

    const newCursor = cursor + 1;
    this.moveCursor.set(newCursor);
    this.syncGameState();

    if (newCursor >= history.length) {
      this.puzzleMessage.set('Puzzle risolto!');
      return;
    }

    this.schedulePuzzleAutoMove(newCursor, 'Corretto. Mossa avversaria in arrivo...');
  }

  private schedulePuzzleAutoMove(ply: number, pendingMessage: string): void {
    const history = this.moveHistory();
    const expectedUci = history[ply];
    if (!expectedUci) {
      this.puzzleMessage.set('Puzzle risolto!');
      return;
    }

    this.clearPuzzleAutoMoveTimer();
    this.isPuzzleAutoPlaying.set(true);
    this.puzzleMessage.set(pendingMessage);

    this.puzzleAutoMoveTimer = setTimeout(() => {
      this.puzzleAutoMoveTimer = null;
      this.isPuzzleAutoPlaying.set(false);

      if (!this.isPuzzleActive()) {
        return;
      }

      const parsed = this.parseUciMove(expectedUci);
      if (!parsed) {
        this.puzzleMessage.set('PGN puzzle non valido.');
        this.syncGameState();
        return;
      }

      const result = this.chess.move(parsed);
      if (!result) {
        this.puzzleMessage.set('Mossa automatica non valida in questa posizione.');
        this.syncGameState();
        return;
      }

      const nextCursor = ply + 1;
      this.moveCursor.set(nextCursor);
      this.syncGameState();

      if (nextCursor >= this.moveHistory().length) {
        this.puzzleMessage.set('Puzzle risolto!');
        return;
      }

      this.puzzleMessage.set('Tocca a te.');
    }, Test.PUZZLE_AUTO_MOVE_DELAY_MS);
  }

  private clearPuzzleAutoMoveTimer(): void {
    if (this.puzzleAutoMoveTimer !== null) {
      clearTimeout(this.puzzleAutoMoveTimer);
      this.puzzleAutoMoveTimer = null;
    }
  }

  private isPuzzleActive(): boolean {
    return this.isPuzzleMode() && !this.isPuzzleSurrendered();
  }

  private getLegalDestinations(): Map<Key, Key[]> {
    const destinations = new Map<Key, Key[]>();

    for (const move of this.chess.moves({ verbose: true })) {
      const from = move.from as Key;
      const to = move.to as Key;

      const fromMoves = destinations.get(from);
      if (fromMoves) {
        fromMoves.push(to);
      } else {
        destinations.set(from, [to]);
      }
    }

    return destinations;
  }

  private handleEngineEvent(event: StockfishEvent): void {
    if (event.type === 'error') {
      this.evalLabel.set(event.message);
      this.isAnalyzing.set(false);
      return;
    }

    if (event.type === 'bestmove') {
      this.bestMove.set(event.bestMove);
      this.isAnalyzing.set(false);
      return;
    }

    this.lines.set(event.lines);
    const firstLine = event.lines[0];
    if (!firstLine) {
      this.primaryScore.set(null);
      this.evalLabel.set('-');
      return;
    }

    this.primaryScore.set(firstLine.score);
    this.evalLabel.set(this.formatScore(firstLine.score));
  }

  private rebuildPositionFromHistory(targetCursor: number): void {
    const history = this.moveHistory();
    const safeTarget = this.clamp(targetCursor, 0, history.length);

    try {
      this.chess.load(this.historyInitialFen);
    } catch {
      this.chess.reset();
      this.historyInitialFen = Test.STARTING_FEN;
    }

    const replayedMoves: string[] = [];
    for (let i = 0; i < safeTarget; i += 1) {
      const parsedMove = this.parseUciMove(history[i]);
      if (!parsedMove) {
        break;
      }

      const result = this.chess.move(parsedMove);
      if (!result) {
        break;
      }

      replayedMoves.push(this.toUci(result.from as Key, result.to as Key, result.promotion));
    }

    if (replayedMoves.length < safeTarget) {
      this.moveHistory.set(replayedMoves);
      this.moveCursor.set(replayedMoves.length);
      this.syncGameState();
      return;
    }

    this.moveCursor.set(safeTarget);
    this.syncGameState();
  }

  private parseUciMove(uci: string): { from: Key; to: Key; promotion?: 'q' | 'r' | 'b' | 'n' } | null {
    if (uci.length < 4) {
      return null;
    }

    const from = uci.slice(0, 2) as Key;
    const to = uci.slice(2, 4) as Key;
    const promoChar = uci.slice(4, 5).toLowerCase();
    const promotion =
      promoChar === 'q' || promoChar === 'r' || promoChar === 'b' || promoChar === 'n'
        ? (promoChar as 'q' | 'r' | 'b' | 'n')
        : undefined;

    return {
      from,
      to,
      promotion,
    };
  }

  private toUci(from: Key, to: Key, promotion?: string): string {
    return `${from}${to}${promotion ?? ''}`;
  }

  private parsePgnGames(pgn: string, itemId: string): PgnLibraryGame[] {
    const gameBlocks = this.splitPgnIntoGames(pgn);

    return gameBlocks
      .map((block, index) => this.parseSinglePgnGame(block, itemId, index))
      .filter((game): game is PgnLibraryGame => game !== null);
  }

  private splitPgnIntoGames(pgn: string): string[] {
    const normalized = pgn.replace(/\r\n?/g, '\n').trim();
    if (!normalized) {
      return [];
    }

    const lines = normalized.split('\n');
    const games: string[] = [];

    let currentGame: string[] = [];
    let hasMovetext = false;
    let hasHeader = false;

    for (const line of lines) {
      const trimmed = line.trim();
      const isHeaderLine = /^\[[^\]]+\]$/.test(trimmed);

      if (isHeaderLine && hasHeader && hasMovetext && currentGame.length > 0) {
        const gameText = currentGame.join('\n').trim();
        if (gameText) {
          games.push(gameText);
        }

        currentGame = [line];
        hasMovetext = false;
        hasHeader = true;
        continue;
      }

      if (isHeaderLine) {
        hasHeader = true;
      } else if (trimmed.length > 0 && hasHeader) {
        hasMovetext = true;
      }

      currentGame.push(line);
    }

    const trailingGame = currentGame.join('\n').trim();
    if (trailingGame) {
      games.push(trailingGame);
    }

    return games.length > 0 ? games : [normalized];
  }

  private parseSinglePgnGame(pgn: string, itemId: string, gameIndex: number): PgnLibraryGame | null {
    const headers = this.parsePgnHeaders(pgn);
    const initialFen = this.resolveInitialFen(headers['FEN']);

    const chess = new Chess();
    try {
      chess.loadPgn(pgn, { strict: false });
    } catch {
      return null;
    }

    const moves = chess.history({ verbose: true });
    const positions = this.buildPositionsFromMoves(moves, initialFen, itemId, gameIndex);

    return {
      id: `${itemId}-g${gameIndex + 1}`,
      event: headers['Event'],
      white: headers['White'],
      black: headers['Black'],
      result: headers['Result'],
      initialFen,
      positions,
    };
  }

  private buildPositionsFromMoves(
    moves: ChessMove[],
    initialFen: string,
    itemId: string,
    gameIndex: number,
  ): PgnLibraryPosition[] {
    const replay = new Chess();
    if (initialFen !== Test.STARTING_FEN) {
      replay.load(initialFen);
    }

    const positions: PgnLibraryPosition[] = [
      {
        id: `${itemId}-g${gameIndex + 1}-p0`,
        ply: 0,
        moveNumber: 1,
        turn: replay.turn() === 'w' ? 'white' : 'black',
        san: '',
        label: 'Inizio partita',
        fen: replay.fen(),
        uciHistory: [],
      },
    ];

    const uciHistory: string[] = [];

    for (let index = 0; index < moves.length; index += 1) {
      const move = moves[index];
      const result = replay.move({ from: move.from, to: move.to, promotion: move.promotion });
      if (!result) {
        break;
      }

      const uci = this.toUci(result.from as Key, result.to as Key, result.promotion);
      uciHistory.push(uci);

      const turn = move.color === 'w' ? 'white' : 'black';
      const moveNumber = Math.floor(index / 2) + 1;
      const label = `${moveNumber}${turn === 'white' ? '.' : '...'} ${move.san}`;

      positions.push({
        id: `${itemId}-g${gameIndex + 1}-p${index + 1}`,
        ply: index + 1,
        moveNumber,
        turn,
        san: move.san,
        label,
        fen: replay.fen(),
        uciHistory: [...uciHistory],
      });
    }

    return positions;
  }

  private resolveInitialFen(fenHeader?: string): string {
    if (!fenHeader || fenHeader.trim().length === 0) {
      return Test.STARTING_FEN;
    }

    const candidate = fenHeader.trim();
    const chess = new Chess();
    try {
      chess.load(candidate);
      return chess.fen();
    } catch {
      return Test.STARTING_FEN;
    }
  }

  private parsePgnHeaders(pgn: string): Record<string, string> {
    const headers: Record<string, string> = {};
    const headerRegex = /^\[(\w+)\s+"([^"]*)"\]$/gm;

    let match = headerRegex.exec(pgn);
    while (match) {
      headers[match[1]] = match[2];
      match = headerRegex.exec(pgn);
    }

    return headers;
  }

  private formatScore(score: EngineScore): string {
    if (score.type === 'mate') {
      return `M${score.value}`;
    }

    const pawns = score.value / 100;
    return `${pawns >= 0 ? '+' : ''}${pawns.toFixed(2)}`;
  }

  private clamp(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) {
      return min;
    }

    return Math.max(min, Math.min(max, Math.trunc(value)));
  }
}
