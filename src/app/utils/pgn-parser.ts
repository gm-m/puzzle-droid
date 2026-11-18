import { Chess } from 'chess.js';
import type { Move as ChessMove } from 'chess.js';
import type { PgnLibraryGame, PgnLibraryPosition } from '../models/library.models';

export const STARTING_FEN = new Chess().fen();

/** Bundled PGN collections shown in the library as "Tattiche famose" (served from public/assets/pgn). */
export const FAMOUS_TACTICS_ASSETS = ['tattiche-vol-1.pgn'];

export function famousTacticsItemId(assetName: string): string {
  return `famous-tactics-${assetName}`;
}

export function formatAssetPgnName(assetName: string): string {
  return assetName
    .replace(/\.pgn$/i, '')
    .split(/[-_\s]+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Splits multi-game PGN files into library games. Headers are read eagerly; the moves of each game
 * are parsed lazily on first access to `uciMoves`/`positions`.
 */
export class PgnParser {
  parsePgnGames(pgn: string, itemId: string): PgnLibraryGame[] {
    const gameBlocks = this.splitPgnIntoGames(pgn);

    return gameBlocks
      .map((block, index) => this.parseSinglePgnGame(block, itemId, index))
      .filter((game): game is PgnLibraryGame => game !== null);
  }

  splitPgnIntoGames(pgn: string): string[] {
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

  parseSinglePgnGame(pgn: string, itemId: string, gameIndex: number): PgnLibraryGame | null {
    const headers = this.parsePgnHeaders(pgn);
    const initialFen = this.resolveInitialFen(headers['FEN']);

    // Move parsing is by far the most expensive step (chess.js loadPgn): defer it until the game's
    // positions are actually needed, so loading a large library only costs a header scan.
    let resolved: { positions: PgnLibraryPosition[]; uciMoves: string[] } | null = null;
    const resolve = () => {
      if (!resolved) {
        const { moves, commentByFen } = this.loadPgnWithFallback(pgn);
        const leadingComment = this.extractLeadingPgnComment(pgn);
        if (!commentByFen.has(initialFen) && leadingComment) {
          commentByFen.set(initialFen, leadingComment);
        }
        resolved = this.buildPositionsFromMoves(moves, initialFen, itemId, gameIndex, commentByFen);
      }
      return resolved;
    };

    return {
      id: `${itemId}-g${gameIndex + 1}`,
      event: headers['Event'],
      white: headers['White'],
      black: headers['Black'],
      result: headers['Result'],
      initialFen,
      plyCount: this.countMainlinePlies(pgn),
      get uciMoves() {
        return resolve().uciMoves;
      },
      get positions() {
        return resolve().positions;
      },
    };
  }

  /** Cheap mainline ply count from the movetext, without validating moves. */
  countMainlinePlies(pgn: string): number {
    let movetext = pgn
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .filter((line) => !/^\s*\[[^\]]*\]\s*$/.test(line) && !line.trimStart().startsWith('%'))
      .join(' ')
      .replace(/\{[^}]*\}/g, ' ')
      .replace(/;[^\n]*/g, ' ');

    while (/\([^()]*\)/.test(movetext)) {
      movetext = movetext.replace(/\([^()]*\)/g, ' ');
    }

    return movetext
      .replace(/\$\d+/g, ' ')
      .replace(/\d+\.(\.\.)?/g, ' ')
      .replace(/(1-0|0-1|1\/2-1\/2|\*)\s*$/, ' ')
      .split(/\s+/)
      .filter((token) => /^[a-hKQRBNO0]/.test(token)).length;
  }

  /**
   * Parses the PGN once with chess.js and extracts both the mainline and the comments from the same
   * instance. Falls back to a sanitized copy (comments/variations stripped) only if the original fails.
   */
  loadPgnWithFallback(pgn: string): { moves: ChessMove[]; commentByFen: Map<string, string> } {
    const chess = new Chess();

    try {
      chess.loadPgn(pgn, { strict: false });
      const commentByFen = new Map<string, string>();
      for (const entry of chess.getComments()) {
        const comment = entry.comment.trim();
        if (comment.length > 0) {
          commentByFen.set(entry.fen, comment);
        }
      }
      return { moves: chess.history({ verbose: true }), commentByFen };
    } catch {
      // Try the sanitized fallback below.
    }

    const sanitized = this.sanitizePgnForParser(pgn);
    if (sanitized && sanitized !== pgn) {
      try {
        chess.loadPgn(sanitized, { strict: false });
        return { moves: chess.history({ verbose: true }), commentByFen: new Map() };
      } catch {
        // Unparseable PGN: keep only the initial position.
      }
    }

    return { moves: [], commentByFen: new Map() };
  }

  sanitizePgnForParser(pgn: string): string {
    const normalized = pgn.replace(/\r\n?/g, '\n');
    const lines = normalized.split('\n');

    const headerLines = lines.filter((line) => /^\[[^\]]+\]$/.test(line.trim()));
    const movetextLines = lines.filter((line) => !/^\[[^\]]+\]$/.test(line.trim()));

    let movetext = movetextLines.join(' ');
    movetext = movetext.replace(/\{[^}]*\}/g, ' ');

    while (/\([^()]*\)/.test(movetext)) {
      movetext = movetext.replace(/\([^()]*\)/g, ' ');
    }

    movetext = movetext.replace(/\$\d+/g, ' ');
    movetext = movetext.replace(/[\u2000-\u206F\u2E00-\u2E7F]/g, ' ');
    movetext = movetext.replace(/[^\x20-\x7E]/g, ' ');
    movetext = movetext.replace(/\s+/g, ' ').trim();

    const headerBlock = headerLines.join('\n').trim();
    if (!movetext) {
      return headerBlock;
    }

    return `${headerBlock}\n\n${movetext}`.trim();
  }

  buildPositionsFromMoves(
    moves: ChessMove[],
    initialFen: string,
    itemId: string,
    gameIndex: number,
    commentByFen: Map<string, string>,
  ): { positions: PgnLibraryPosition[]; uciMoves: string[] } {
    // chess.js loads the PGN from its own FEN header; if that differs from the resolved initial
    // position (e.g. invalid FEN header), the moves don't belong to this start and are discarded.
    const startsFromInitialFen = moves.length === 0 || moves[0].before === initialFen;
    const mainline = startsFromInitialFen ? moves : [];

    const positions: PgnLibraryPosition[] = [
      {
        id: `${itemId}-g${gameIndex + 1}-p0`,
        ply: 0,
        moveNumber: 1,
        turn: initialFen.split(' ')[1] === 'b' ? 'black' : 'white',
        san: '',
        label: 'Inizio partita',
        fen: initialFen,
        comment: commentByFen.get(initialFen),
      },
    ];
    const uciMoves: string[] = [];

    for (let index = 0; index < mainline.length; index += 1) {
      const move = mainline[index];
      uciMoves.push(`${move.from}${move.to}${move.promotion ?? ''}`);

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
        fen: move.after,
        comment: commentByFen.get(move.after),
      });
    }

    return { positions, uciMoves };
  }

  extractLeadingPgnComment(pgn: string): string {
    const normalized = pgn.replace(/\r\n?/g, '\n');
    const withoutHeaders = normalized.replace(/^(\s*\[[^\]]+\]\s*)+/m, '').trimStart();
    const match = withoutHeaders.match(/^\{([\s\S]*?)\}/);
    return match?.[1]?.trim() ?? '';
  }

  resolveInitialFen(fenHeader?: string): string {
    if (!fenHeader || fenHeader.trim().length === 0) {
      return STARTING_FEN;
    }

    const candidate = fenHeader.trim();
    const chess = new Chess();
    try {
      chess.load(candidate);
      return chess.fen();
    } catch {
      return STARTING_FEN;
    }
  }

  parsePgnHeaders(pgn: string): Record<string, string> {
    const headers: Record<string, string> = {};
    const headerRegex = /^\[(\w+)\s+"([^"]*)"\]$/gm;

    let match = headerRegex.exec(pgn);
    while (match) {
      headers[match[1]] = match[2];
      match = headerRegex.exec(pgn);
    }

    return headers;
  }
}

export const pgnParser = new PgnParser();
