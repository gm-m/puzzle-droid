import { ChangeDetectionStrategy, Component, HostListener, OnDestroy, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Chess } from 'chess.js';
import type { Key } from 'chessground/types';
import { ChessBoardComponent, type BoardMove } from '../chess-board/chess-board';
import { AppIconComponent } from '../ui/app-icon/app-icon';
import { EmptyStateComponent } from '../ui/empty-state/empty-state';
import { LoadingIndicatorComponent } from '../ui/loading-indicator/loading-indicator';
import {
  RUSH_MODES,
  RUSH_MODE_ORDER,
  type RushBest,
  type RushMode,
  type RushPuzzleResult,
} from '../../models/puzzle-rush.models';
import { HapticsService } from '../../services/haptics.service';
import { LibraryStorageService } from '../../services/library-storage.service';
import { PuzzleRushRecordsService } from '../../services/puzzle-rush-records.service';
import { SettingsService } from '../../services/settings.service';
import { ShellLayoutService } from '../../services/shell-layout.service';
import { FAMOUS_TACTICS_ASSETS, famousTacticsItemId, formatAssetPgnName, pgnParser } from '../../utils/pgn-parser';
import { PuzzleRushRun, buildRushPuzzles, orderRushPuzzles, type RushMoveOutcome, type RushPuzzle } from './puzzle-rush-run';

interface RushCollection {
  id: string;
  name: string;
  puzzles: RushPuzzle[];
}

interface RushSummary {
  score: number;
  mistakes: number;
  durationMs: number;
  averageSolveMs: number;
  isNewBest: boolean;
  previousBest: RushBest | null;
  results: RushPuzzleResult[];
  endReason: 'time' | 'strikes' | 'exhausted' | 'stopped';
}

type RushPhase = 'setup' | 'playing' | 'finished';

const OPPONENT_MOVE_DELAY_MS = 300;
const NEXT_PUZZLE_DELAY_MS = 350;
const FAILED_PUZZLE_DELAY_MS = 900;
const CLOCK_TICK_MS = 200;
const LOW_TIME_MS = 15_000;

@Component({
  selector: 'app-puzzle-rush',
  imports: [RouterLink, ChessBoardComponent, AppIconComponent, EmptyStateComponent, LoadingIndicatorComponent],
  templateUrl: './puzzle-rush.html',
  styleUrl: './puzzle-rush.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PuzzleRushComponent implements OnInit, OnDestroy {
  private readonly storage = inject(LibraryStorageService);
  private readonly records = inject(PuzzleRushRecordsService);
  private readonly shell = inject(ShellLayoutService);
  private readonly haptics = inject(HapticsService);
  readonly settings = inject(SettingsService).settings;

  readonly modes = RUSH_MODE_ORDER.map((id) => ({ id, ...RUSH_MODES[id] }));
  readonly maxStrikesSlots = computed(() => Array.from({ length: RUSH_MODES[this.mode()].maxStrikes }, (_, index) => index));

  readonly isLoading = signal(true);
  readonly collections = signal<RushCollection[]>([]);
  readonly phase = signal<RushPhase>('setup');
  readonly mode = signal<RushMode>(this.records.prefs().mode);
  readonly opponentMovesFirst = signal(this.records.prefs().opponentMovesFirst);
  private readonly preferredCollectionId = signal<string | null>(this.records.prefs().collectionId);

  readonly playableCollections = computed(() => this.collections().filter((collection) => collection.puzzles.length > 0));
  readonly selectedCollection = computed(() => {
    const playable = this.playableCollections();
    return playable.find((collection) => collection.id === this.preferredCollectionId()) ?? playable.at(0) ?? null;
  });
  readonly selectedBest = computed(() => {
    const collection = this.selectedCollection();
    this.recordsVersion();
    return collection ? this.records.best(collection.id, this.mode()) : null;
  });

  readonly fen = signal(new Chess().fen());
  readonly turnColor = signal<'white' | 'black'>('white');
  readonly orientation = signal<'white' | 'black'>('white');
  readonly legalDests = signal<Map<Key, Key[]>>(new Map());
  readonly lastMove = signal<[Key, Key] | null>(null);
  readonly score = signal(0);
  readonly strikes = signal(0);
  readonly puzzleNumber = signal(1);
  readonly remainingMs = signal<number | null>(null);
  readonly elapsedMs = signal(0);
  readonly feedback = signal<{ tone: 'good' | 'bad'; text: string } | null>(null);
  readonly summary = signal<RushSummary | null>(null);

  readonly isLowTime = computed(() => {
    const remaining = this.remainingMs();
    return remaining !== null && remaining <= LOW_TIME_MS;
  });
  readonly timeProgressPercent = computed(() => {
    const remaining = this.remainingMs();
    const duration = RUSH_MODES[this.mode()].durationMs;
    return remaining === null || !duration ? 100 : Math.max(0, Math.min(100, (remaining / duration) * 100));
  });

  private readonly board = viewChild(ChessBoardComponent);
  private readonly recordsVersion = signal(0);
  private run: PuzzleRushRun | null = null;
  private runCollection: RushCollection | null = null;
  private startedAt = 0;
  private endsAt: number | null = null;
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private stepTimer: ReturnType<typeof setTimeout> | null = null;
  private feedbackTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    void this.loadCollections();
  }

  ngOnDestroy(): void {
    this.clearTimers();
    this.shell.tabBarVisible.set(true);
  }

  selectCollection(collectionId: string): void {
    this.preferredCollectionId.set(collectionId);
    this.records.updatePrefs({ collectionId });
  }

  selectMode(mode: RushMode): void {
    this.mode.set(mode);
    this.records.updatePrefs({ mode });
  }

  onOpponentMovesFirstChange(event: Event): void {
    const value = (event.target as HTMLInputElement).checked;
    this.opponentMovesFirst.set(value);
    this.records.updatePrefs({ opponentMovesFirst: value });
  }

  bestFor(collectionId: string): RushBest | null {
    this.recordsVersion();
    return this.records.best(collectionId, this.mode());
  }

  start(): void {
    const collection = this.selectedCollection();
    if (!collection) {
      return;
    }

    this.clearTimers();
    const config = RUSH_MODES[this.mode()];
    this.runCollection = collection;
    this.run = new PuzzleRushRun(orderRushPuzzles(collection.puzzles), {
      opponentMovesFirst: this.opponentMovesFirst(),
      maxStrikes: config.maxStrikes,
    });
    this.score.set(0);
    this.strikes.set(0);
    this.summary.set(null);
    this.feedback.set(null);
    this.startedAt = Date.now();
    this.endsAt = config.durationMs === null ? null : this.startedAt + config.durationMs;
    this.remainingMs.set(config.durationMs);
    this.elapsedMs.set(0);
    this.phase.set('playing');
    this.shell.tabBarVisible.set(false);
    this.clockTimer = setInterval(() => this.tick(), CLOCK_TICK_MS);
    this.loadNextPuzzle();
  }

  stop(): void {
    if (this.phase() === 'playing') {
      this.finish('stopped');
    }
  }

  /** Escape / Android back during a run ends it and shows the summary instead of leaving the page. */
  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    // An open promotion picker handles Escape itself (it just closes).
    if (event.key === 'Escape' && !event.defaultPrevented && this.phase() === 'playing' && !this.board()?.pendingPromotion()) {
      event.preventDefault();
      this.stop();
    }
  }

  backToSetup(): void {
    this.phase.set('setup');
  }

  onBoardMove(move: BoardMove): void {
    const run = this.run;
    if (!run || this.phase() !== 'playing' || this.stepTimer !== null) {
      this.syncBoard();
      return;
    }

    this.handleOutcome(run.playMove(move));
  }

  formatClock(ms: number | null): string {
    const totalSeconds = Math.max(0, Math.ceil((ms ?? 0) / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    return `${minutes}:${String(totalSeconds % 60).padStart(2, '0')}`;
  }

  formatSeconds(ms: number): string {
    return `${(ms / 1000).toFixed(1)}s`;
  }

  endReasonLabel(reason: RushSummary['endReason']): string {
    switch (reason) {
      case 'time':
        return 'Tempo scaduto';
      case 'strikes':
        return 'Tre errori';
      case 'exhausted':
        return 'Puzzle della raccolta finiti';
      default:
        return 'Partita interrotta';
    }
  }

  private handleOutcome(outcome: RushMoveOutcome): void {
    const run = this.run!;
    switch (outcome.kind) {
      case 'correct':
        this.lastMove.set([outcome.move.from as Key, outcome.move.to as Key]);
        this.syncBoard();
        if (run.isOpponentToMove) {
          this.scheduleStep(OPPONENT_MOVE_DELAY_MS, () => this.handleOutcome(run.playOpponentMove()));
        }
        return;
      case 'solved':
        this.lastMove.set([outcome.move.from as Key, outcome.move.to as Key]);
        this.score.set(run.score);
        this.syncBoard();
        this.haptics.success();
        this.showFeedback('good', 'Risolto!');
        this.scheduleStep(NEXT_PUZZLE_DELAY_MS, () => this.loadNextPuzzle());
        return;
      case 'failed':
        this.strikes.set(run.strikes);
        this.syncBoard();
        this.haptics.error();
        this.showFeedback('bad', `Sbagliato: la mossa era ${outcome.expectedSan}`);
        this.scheduleStep(FAILED_PUZZLE_DELAY_MS, () =>
          run.isOutOfStrikes ? this.finish('strikes') : this.loadNextPuzzle(),
        );
        return;
      case 'skipped':
        this.scheduleStep(0, () => this.loadNextPuzzle());
        return;
      default:
        this.syncBoard();
    }
  }

  private loadNextPuzzle(): void {
    const run = this.run;
    if (!run || this.phase() !== 'playing') {
      return;
    }

    if (!run.nextPuzzle()) {
      this.finish(run.isOutOfStrikes ? 'strikes' : 'exhausted');
      return;
    }

    this.puzzleNumber.set(run.puzzleNumber);
    this.orientation.set(run.playerColor);
    this.lastMove.set(null);
    this.syncBoard();
    if (run.isOpponentToMove) {
      this.scheduleStep(OPPONENT_MOVE_DELAY_MS, () => this.handleOutcome(run.playOpponentMove()));
    }
  }

  private scheduleStep(delayMs: number, step: () => void): void {
    if (this.stepTimer !== null) {
      clearTimeout(this.stepTimer);
    }

    this.legalDests.set(new Map());
    this.stepTimer = setTimeout(() => {
      this.stepTimer = null;
      if (this.phase() === 'playing') {
        step();
      }
    }, delayMs);
  }

  private syncBoard(): void {
    const run = this.run;
    if (!run) {
      return;
    }

    const chess = run.chess;
    this.fen.set(chess.fen());
    this.turnColor.set(chess.turn() === 'w' ? 'white' : 'black');

    const dests = new Map<Key, Key[]>();
    if (this.phase() === 'playing' && this.stepTimer === null && !run.isOpponentToMove && this.turnColor() === run.playerColor) {
      for (const move of chess.moves({ verbose: true })) {
        const targets = dests.get(move.from as Key) ?? [];
        targets.push(move.to as Key);
        dests.set(move.from as Key, targets);
      }
    }
    this.legalDests.set(dests);
  }

  private tick(): void {
    const now = Date.now();
    this.elapsedMs.set(now - this.startedAt);
    if (this.endsAt === null) {
      return;
    }

    const remaining = Math.max(0, this.endsAt - now);
    this.remainingMs.set(remaining);
    if (remaining <= 0) {
      this.finish('time');
    }
  }

  private finish(endReason: RushSummary['endReason']): void {
    const run = this.run;
    const collection = this.runCollection;
    this.clearTimers();
    this.phase.set('finished');
    this.legalDests.set(new Map());
    this.shell.tabBarVisible.set(true);
    if (!run || !collection) {
      return;
    }

    const durationMs = Date.now() - this.startedAt;
    const solved = run.results.filter((result) => result.solved);
    const recorded =
      run.results.length > 0
        ? this.records.recordRun({
            collectionId: collection.id,
            collectionName: collection.name,
            mode: this.mode(),
            score: run.score,
            mistakes: run.strikes,
            durationMs,
            at: Date.now(),
          })
        : { isNewBest: false, previousBest: this.records.best(collection.id, this.mode()) };
    this.recordsVersion.update((version) => version + 1);

    this.summary.set({
      score: run.score,
      mistakes: run.strikes,
      durationMs,
      averageSolveMs: solved.length > 0 ? solved.reduce((sum, result) => sum + result.elapsedMs, 0) / solved.length : 0,
      isNewBest: recorded.isNewBest,
      previousBest: recorded.previousBest,
      results: [...run.results],
      endReason,
    });
    if (recorded.isNewBest) {
      this.haptics.success();
    }
  }

  private showFeedback(tone: 'good' | 'bad', text: string): void {
    if (this.feedbackTimer !== null) {
      clearTimeout(this.feedbackTimer);
    }

    this.feedback.set({ tone, text });
    this.feedbackTimer = setTimeout(() => {
      this.feedbackTimer = null;
      this.feedback.set(null);
    }, tone === 'bad' ? FAILED_PUZZLE_DELAY_MS + 400 : 900);
  }

  private clearTimers(): void {
    for (const timer of [this.stepTimer, this.feedbackTimer]) {
      if (timer !== null) clearTimeout(timer);
    }
    if (this.clockTimer !== null) clearInterval(this.clockTimer);
    this.stepTimer = null;
    this.feedbackTimer = null;
    this.clockTimer = null;
  }

  private async loadCollections(): Promise<void> {
    try {
      const [persisted, famous] = await Promise.all([
        this.storage.loadAll().catch(() => []),
        Promise.all(
          FAMOUS_TACTICS_ASSETS.map(async (assetName) => {
            const response = await fetch(`assets/pgn/${assetName}`).catch(() => null);
            return response?.ok
              ? { id: famousTacticsItemId(assetName), name: formatAssetPgnName(assetName), pgn: await response.text() }
              : null;
          }),
        ),
      ]);

      const sources = [...persisted, ...famous.filter((entry) => entry !== null)].filter(
        (entry) => typeof entry.pgn === 'string' && typeof entry.id === 'string',
      );
      this.collections.set(
        sources.map((source) => ({
          id: source.id,
          name: source.name,
          puzzles: buildRushPuzzles(pgnParser.parsePgnGames(source.pgn, source.id)),
        })),
      );
    } finally {
      this.isLoading.set(false);
    }
  }
}
