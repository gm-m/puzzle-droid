import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, signal } from '@angular/core';
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

interface LibraryGameListEntry {
  id: string;
  index: number;
  title: string;
}

@Component({
  selector: 'app-test',
  imports: [CommonModule, ChessBoardComponent, EvalBarComponent, AnalysisPanelComponent, LibraryPanelComponent],
  templateUrl: './test.html',
  styleUrl: './test.scss',
})
export class Test implements OnInit, AfterViewInit, OnDestroy {
  private static readonly STARTING_FEN = new Chess().fen();
  private static readonly PUZZLE_AUTO_MOVE_DELAY_MS = 700;
  private static readonly PUZZLE_AUTO_NEXT_GAME_DELAY_MS = 700;

  readonly activeView = signal<'analysis' | 'library'>('analysis');
  readonly isMenuOpen = signal(false);

  readonly currentFen = signal('');
  readonly turnColor = signal<'white' | 'black'>('white');
  readonly legalDests = signal<Map<Key, Key[]>>(new Map());

  readonly moveHistory = signal<string[]>([]);
  readonly moveCursor = signal(0);
  readonly puzzleReplayLimit = signal(0);
  readonly boardPixelSize = signal(0);

  readonly bestMove = signal('-');
  readonly evalLabel = signal('-');
  readonly isAnalyzing = signal(false);
  readonly lines = signal<EngineLine[]>([]);
  readonly primaryScore = signal<EngineScore | null>(null);

  readonly depth = signal(8);
  readonly multiPv = signal(1);
  readonly showEvalBar = signal(true);
  readonly fenFeedback = signal('');
  readonly puzzleMessage = signal('');
  readonly boardOrientation = signal<'white' | 'black'>('white');
  readonly showBestMoveArrow = signal(false);
  readonly bestMoveArrow = signal<{ from: Key; to: Key } | null>(null);

  readonly isPuzzleMode = signal(false);
  readonly isPuzzleSurrendered = signal(false);
  readonly isPuzzleAutoPlaying = signal(false);
  readonly puzzleAutoRotateBoardOnTurn = signal(true);

  readonly libraryItems = signal<PgnLibraryItem[]>([]);
  readonly currentLibraryGameTitle = signal('');
  readonly isLibraryGamePickerOpen = signal(false);
  readonly libraryGameFilter = signal('');

  private readonly chess = new Chess();
  private historyInitialFen = Test.STARTING_FEN;
  private puzzleAutoMoveTimer: ReturnType<typeof setTimeout> | null = null;
  private puzzleAutoNextGameTimer: ReturnType<typeof setTimeout> | null = null;
  private boardResizeObserver: ResizeObserver | null = null;
  private currentLibrarySelection: LibraryGameSelection | null = null;
  private touchStartX: number | null = null;
  private touchStartY: number | null = null;
  private touchStartFromLeftEdge = false;
  private touchStartedOnBoard = false;

  @ViewChild('boardHostRef', { read: ElementRef })
  private boardHostRef?: ElementRef<HTMLElement>;

  constructor(private readonly stockfish: StockfishService) {}

  ngOnInit(): void {
    this.syncGameState();
    this.stockfish.setListener((event) => this.handleEngineEvent(event));
    this.stockfish.init();
    this.analyzePosition();
  }

  ngAfterViewInit(): void {
    this.observeBoardSize();
  }

  ngOnDestroy(): void {
    this.clearPuzzleAutoMoveTimer();
    this.clearPuzzleAutoNextGameTimer();
    if (this.boardResizeObserver) {
      this.boardResizeObserver.disconnect();
      this.boardResizeObserver = null;
    }
    this.stockfish.destroy();
  }

  setActiveView(view: 'analysis' | 'library'): void {
    this.activeView.set(view);
    this.isMenuOpen.set(false);
    this.closeLibraryGamePicker();

    if (view === 'analysis') {
      setTimeout(() => this.observeBoardSize());
    }
  }

  toggleMenu(): void {
    this.closeLibraryGamePicker();
    this.isMenuOpen.update((value) => !value);
  }

  onContentTouchStart(event: TouchEvent): void {
    if (!this.canHandleLibrarySwipe()) {
      return;
    }

    const touch = event.touches[0];
    if (!touch) {
      return;
    }

    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    this.touchStartFromLeftEdge = touch.clientX <= 36;
    this.touchStartedOnBoard = Boolean((event.target as HTMLElement | null)?.closest('.board'));
  }

  onContentTouchEnd(event: TouchEvent): void {
    if (!this.canHandleLibrarySwipe()) {
      this.resetTouchState();
      return;
    }

    if (this.touchStartedOnBoard) {
      this.resetTouchState();
      return;
    }

    const touch = event.changedTouches[0];
    if (!touch || this.touchStartX === null || this.touchStartY === null) {
      this.resetTouchState();
      return;
    }

    const deltaX = touch.clientX - this.touchStartX;
    const deltaY = touch.clientY - this.touchStartY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absX < 64 || absY > absX * 0.7) {
      this.resetTouchState();
      return;
    }

    if (deltaX < 0) {
      this.openLibraryGamePicker();
      this.resetTouchState();
      return;
    }

    if (deltaX > 0 && this.touchStartFromLeftEdge) {
      this.isMenuOpen.set(true);
    }

    this.resetTouchState();
  }

  onContentTouchCancel(): void {
    this.resetTouchState();
  }

  onLibraryGameFilterInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.libraryGameFilter.set(value);
  }

  closeLibraryGamePicker(): void {
    this.isLibraryGamePickerOpen.set(false);
    this.libraryGameFilter.set('');
  }

  libraryGamePickerEntries(): LibraryGameListEntry[] {
    const location = this.getCurrentLibraryGameLocation();
    if (!location) {
      return [];
    }

    const query = this.libraryGameFilter().trim().toLowerCase();
    return location.item.games
      .map((game, index) => ({
        id: game.id,
        index,
        title: this.formatLibraryGameTitle(game, index),
      }))
      .filter((entry) => !query || entry.title.toLowerCase().includes(query));
  }

  currentLibraryItemName(): string {
    const location = this.getCurrentLibraryGameLocation();
    return location?.item.name ?? '';
  }

  isCurrentLibraryGame(gameId: string): boolean {
    return this.currentLibrarySelection?.gameId === gameId;
  }

  selectLibraryGameFromPicker(gameId: string): void {
    if (this.isPuzzleAutoPlaying()) {
      return;
    }

    const location = this.getCurrentLibraryGameLocation();
    if (!location) {
      return;
    }

    const targetIndex = location.item.games.findIndex((game) => game.id === gameId);
    const targetGame = targetIndex >= 0 ? location.item.games[targetIndex] : null;
    if (!targetGame) {
      return;
    }

    this.selectLibraryGame(location.item, targetGame, targetIndex);
    this.closeLibraryGamePicker();
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
    this.clearPuzzleAutoNextGameTimer();
    this.isPuzzleAutoPlaying.set(false);
    this.currentLibrarySelection = {
      ...selection,
      fullUciHistory: [...selection.fullUciHistory],
    };
    this.currentLibraryGameTitle.set(selection.gameTitle);
    this.closeLibraryGamePicker();

    if (selection.mode === 'puzzle') {
      this.isPuzzleMode.set(true);
      this.isPuzzleSurrendered.set(false);
      this.puzzleAutoRotateBoardOnTurn.set(selection.autoRotateBoardOnTurn);
      if (selection.autoRotateBoardOnTurn) {
        this.boardOrientation.set(this.getPuzzleInitialOrientation(selection.initialFen, fullHistory, selection.autoPlayFirstMove));
      }
      this.stockfish.stop();
      this.puzzleMessage.set('Puzzle avviato.');
    } else {
      this.isPuzzleMode.set(false);
      this.isPuzzleSurrendered.set(false);
      this.puzzleAutoRotateBoardOnTurn.set(false);
      this.puzzleMessage.set('');
    }

    this.moveHistory.set([...fullHistory]);
    this.moveCursor.set(0);
    this.puzzleReplayLimit.set(selection.mode === 'puzzle' ? 0 : fullHistory.length);
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
    this.clearPuzzleAutoNextGameTimer();
    this.isPuzzleAutoPlaying.set(false);
    this.currentLibrarySelection = null;
    this.currentLibraryGameTitle.set('');
    this.closeLibraryGamePicker();
    this.chess.reset();
    this.historyInitialFen = Test.STARTING_FEN;
    this.isPuzzleMode.set(false);
    this.isPuzzleSurrendered.set(false);
    this.puzzleAutoRotateBoardOnTurn.set(false);
    this.puzzleMessage.set('');
    this.moveHistory.set([]);
    this.moveCursor.set(0);
    this.puzzleReplayLimit.set(0);
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
    this.clearPuzzleAutoNextGameTimer();
    this.isPuzzleAutoPlaying.set(false);
    this.currentLibrarySelection = null;
    this.currentLibraryGameTitle.set('');
    this.closeLibraryGamePicker();
    this.historyInitialFen = this.chess.fen();
    this.isPuzzleMode.set(false);
    this.isPuzzleSurrendered.set(false);
    this.puzzleAutoRotateBoardOnTurn.set(false);
    this.puzzleMessage.set('');
    this.moveHistory.set([]);
    this.moveCursor.set(0);
    this.puzzleReplayLimit.set(0);
    this.fenFeedback.set('Posizione caricata.');
    this.syncGameState();
    this.analyzePosition();
  }

  analyzePosition(): void {
    this.isAnalyzing.set(true);
    this.bestMove.set('-');
    this.bestMoveArrow.set(null);
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

  rotateBoard(): void {
    this.boardOrientation.update((value) => (value === 'white' ? 'black' : 'white'));
  }

  onBestMoveArrowToggled(enabled: boolean): void {
    this.showBestMoveArrow.set(enabled);
    this.refreshBestMoveArrow();
  }

  previousMove(): void {
    if (!this.canGoBack()) {
      return;
    }

    this.rebuildPositionFromHistory(this.moveCursor() - 1);
    this.analyzePosition();
  }

  firstMove(): void {
    if (!this.canGoBack()) {
      return;
    }

    this.rebuildPositionFromHistory(0);
    this.analyzePosition();
  }

  nextMove(): void {
    if (!this.canGoForward()) {
      return;
    }

    this.rebuildPositionFromHistory(this.moveCursor() + 1);
    this.analyzePosition();
  }

  lastMove(): void {
    if (!this.canGoForward()) {
      return;
    }

    const historyLength = this.moveHistory().length;
    const forwardLimit = this.isPuzzleActive() ? Math.min(this.puzzleReplayLimit(), historyLength) : historyLength;
    this.rebuildPositionFromHistory(forwardLimit);
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
    this.clearPuzzleAutoNextGameTimer();
    this.isPuzzleAutoPlaying.set(false);
    this.isPuzzleSurrendered.set(true);
    this.puzzleMessage.set('Ti sei arreso. Engine riattivato.');
    this.analyzePosition();
  }

  previousLibraryGame(): void {
    if (this.isPuzzleAutoPlaying()) {
      return;
    }

    this.navigateLibraryGame(-1);
  }

  nextLibraryGame(): void {
    if (this.isPuzzleAutoPlaying()) {
      return;
    }

    this.navigateLibraryGame(1);
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
    if (this.isPuzzleAutoPlaying()) {
      return false;
    }

    return this.moveCursor() > 0;
  }

  canGoForward(): boolean {
    if (this.isPuzzleAutoPlaying()) {
      return false;
    }

    const historyLength = this.moveHistory().length;
    const forwardLimit = this.isPuzzleActive() ? Math.min(this.puzzleReplayLimit(), historyLength) : historyLength;
    return this.moveCursor() < forwardLimit;
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

  showLibraryGameNavigation(): boolean {
    return this.currentLibrarySelection !== null;
  }

  canGoToPreviousLibraryGame(): boolean {
    if (this.isPuzzleAutoPlaying()) {
      return false;
    }

    const location = this.getCurrentLibraryGameLocation();
    return Boolean(location && location.gameIndex > 0);
  }

  canGoToNextLibraryGame(): boolean {
    if (this.isPuzzleAutoPlaying()) {
      return false;
    }

    const location = this.getCurrentLibraryGameLocation();
    return Boolean(location && location.gameIndex < location.item.games.length - 1);
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
      this.handlePuzzleSolved();
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
    this.puzzleReplayLimit.update((currentLimit) => Math.max(currentLimit, newCursor));
    this.syncGameState();

    if (newCursor >= history.length) {
      this.handlePuzzleSolved();
      return;
    }

    this.schedulePuzzleAutoMove(newCursor, 'Corretto. Mossa avversaria in arrivo...');
  }

  private schedulePuzzleAutoMove(ply: number, pendingMessage: string): void {
    const history = this.moveHistory();
    const expectedUci = history[ply];
    if (!expectedUci) {
      this.handlePuzzleSolved();
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
      this.puzzleReplayLimit.update((currentLimit) => Math.max(currentLimit, nextCursor));
      this.syncGameState();

      if (nextCursor >= this.moveHistory().length) {
        this.handlePuzzleSolved();
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

  private clearPuzzleAutoNextGameTimer(): void {
    if (this.puzzleAutoNextGameTimer !== null) {
      clearTimeout(this.puzzleAutoNextGameTimer);
      this.puzzleAutoNextGameTimer = null;
    }
  }

  private handlePuzzleSolved(): void {
    const location = this.getCurrentLibraryGameLocation();
    const hasNextGame = Boolean(location && location.gameIndex < location.item.games.length - 1);
    const shouldAutoAdvance =
      this.isPuzzleMode() &&
      !this.isPuzzleSurrendered() &&
      this.currentLibrarySelection?.mode === 'puzzle' &&
      this.currentLibrarySelection?.autoAdvanceOnSuccess === true;

    if (shouldAutoAdvance && hasNextGame) {
      this.clearPuzzleAutoNextGameTimer();
      this.isPuzzleAutoPlaying.set(true);
      this.puzzleMessage.set('Puzzle risolto! Carico il successivo...');
      this.puzzleAutoNextGameTimer = setTimeout(() => {
        this.puzzleAutoNextGameTimer = null;
        this.isPuzzleAutoPlaying.set(false);

        if (!this.isPuzzleMode() || this.isPuzzleSurrendered()) {
          return;
        }

        this.navigateLibraryGame(1);
      }, Test.PUZZLE_AUTO_NEXT_GAME_DELAY_MS);
      return;
    }

    this.puzzleMessage.set('Puzzle risolto!');
  }

  private navigateLibraryGame(direction: -1 | 1): void {
    const location = this.getCurrentLibraryGameLocation();
    if (!location) {
      return;
    }

    const targetIndex = location.gameIndex + direction;
    const targetGame = location.item.games[targetIndex];
    if (!targetGame) {
      return;
    }

    this.selectLibraryGame(location.item, targetGame, targetIndex);
  }

  private selectLibraryGame(item: PgnLibraryItem, targetGame: PgnLibraryGame, targetIndex: number): void {
    const reference = this.currentLibrarySelection;
    const fullUciHistory = targetGame.positions.at(-1)?.uciHistory ?? [];

    this.onLibraryGameSelected({
      itemId: item.id,
      gameId: targetGame.id,
      gameTitle: this.formatLibraryGameTitle(targetGame, targetIndex),
      mode: reference?.mode ?? item.mode,
      initialFen: targetGame.initialFen,
      fullUciHistory: [...fullUciHistory],
      autoPlayFirstMove: reference?.autoPlayFirstMove ?? false,
      autoAdvanceOnSuccess: reference?.autoAdvanceOnSuccess ?? true,
      autoRotateBoardOnTurn: reference?.autoRotateBoardOnTurn ?? true,
    });
  }

  private observeBoardSize(): void {
    if (this.boardResizeObserver) {
      this.boardResizeObserver.disconnect();
      this.boardResizeObserver = null;
    }

    const boardHost = this.boardHostRef?.nativeElement;
    if (!boardHost || typeof ResizeObserver === 'undefined') {
      return;
    }

    const boardElement = boardHost.querySelector('.board') as HTMLElement | null;
    const measurementTarget = boardElement ?? boardHost;

    const updateBoardSize = (): void => {
      const nextSize = Math.round(measurementTarget.getBoundingClientRect().height);
      this.boardPixelSize.set(nextSize > 0 ? nextSize : 0);
    };

    updateBoardSize();
    this.boardResizeObserver = new ResizeObserver(() => updateBoardSize());
    this.boardResizeObserver.observe(measurementTarget);
  }

  private getPuzzleInitialOrientation(initialFen: string, fullHistory: string[], autoPlayFirstMove: boolean): 'white' | 'black' {
    const preview = new Chess();
    try {
      preview.load(initialFen);
    } catch {
      return this.boardOrientation();
    }

    if (autoPlayFirstMove && fullHistory.length > 0) {
      const firstMove = this.parseUciMove(fullHistory[0]);
      if (firstMove) {
        preview.move(firstMove);
      }
    }

    return preview.turn() === 'w' ? 'white' : 'black';
  }

  private formatLibraryGameTitle(game: PgnLibraryGame, gameIndex: number): string {
    const white = game.white || '?';
    const black = game.black || '?';
    const result = game.result || '*';
    return `Partita ${gameIndex + 1}: ${white} vs ${black} (${result})`;
  }

  private canHandleLibrarySwipe(): boolean {
    return this.activeView() === 'analysis' && this.currentLibrarySelection !== null && !this.isLibraryGamePickerOpen();
  }

  private openLibraryGamePicker(): void {
    const location = this.getCurrentLibraryGameLocation();
    if (!location || location.item.games.length === 0) {
      return;
    }

    this.isMenuOpen.set(false);
    this.libraryGameFilter.set('');
    this.isLibraryGamePickerOpen.set(true);
  }

  private resetTouchState(): void {
    this.touchStartX = null;
    this.touchStartY = null;
    this.touchStartFromLeftEdge = false;
    this.touchStartedOnBoard = false;
  }

  private getCurrentLibraryGameLocation(): { item: PgnLibraryItem; gameIndex: number } | null {
    const selection = this.currentLibrarySelection;
    if (!selection) {
      return null;
    }

    const item = this.libraryItems().find((libraryItem) => libraryItem.id === selection.itemId);
    if (!item) {
      return null;
    }

    const gameIndex = item.games.findIndex((game) => game.id === selection.gameId);
    if (gameIndex === -1) {
      return null;
    }

    return { item, gameIndex };
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
      this.bestMoveArrow.set(null);
      this.isAnalyzing.set(false);
      return;
    }

    if (event.type === 'bestmove') {
      this.bestMove.set(event.bestMove);
      this.refreshBestMoveArrow();
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

  private refreshBestMoveArrow(): void {
    if (!this.showBestMoveArrow() || this.isEngineHidden()) {
      this.bestMoveArrow.set(null);
      return;
    }

    const parsed = this.parseUciMove(this.bestMove());
    if (!parsed) {
      this.bestMoveArrow.set(null);
      return;
    }

    this.bestMoveArrow.set({ from: parsed.from, to: parsed.to });
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
