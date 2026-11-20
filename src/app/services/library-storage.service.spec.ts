import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { IDBFactory } from 'fake-indexeddb';
import { vi } from 'vitest';

import { LEGACY_LIBRARY_STORAGE_KEY, LibraryStorageService, type PersistedLibraryItem } from './library-storage.service';

const item = (id: string, createdAt: number): PersistedLibraryItem => ({
  id,
  name: `${id}.pgn`,
  pgn: '1. e4 *',
  mode: 'view',
  createdAt,
});

describe('LibraryStorageService', () => {
  const createService = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    return TestBed.inject(LibraryStorageService);
  };

  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    localStorage.removeItem(LEGACY_LIBRARY_STORAGE_KEY);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('should migrate legacy localStorage items preserving order and remove the legacy key', async () => {
    localStorage.setItem(
      LEGACY_LIBRARY_STORAGE_KEY,
      JSON.stringify([
        { id: 'newest', name: 'a', pgn: '1. e4 *', mode: 'view' },
        { id: 'oldest', name: 'b', pgn: '1. d4 *', mode: 'puzzle' },
      ]),
    );

    const items = await createService().loadAll();

    expect(items.map((entry) => entry.id)).toEqual(['newest', 'oldest']);
    expect(localStorage.getItem(LEGACY_LIBRARY_STORAGE_KEY)).toBeNull();
    expect((await createService().loadAll()).map((entry) => entry.id)).toEqual(['newest', 'oldest']);
  });

  it('should put, update and delete items per id', async () => {
    const service = createService();
    await service.putItems([item('one', 1), item('two', 2)]);
    await service.putItems([{ ...item('one', 1), mode: 'puzzle' }]);
    await service.deleteItem('two');

    const reloaded = await createService().loadAll();

    expect(reloaded.map((entry) => [entry.id, entry.mode])).toEqual([['one', 'puzzle']]);
    expect(service.snapshot().map((entry) => entry.id)).toEqual(['one']);
  });

  it('should replace all items', async () => {
    const service = createService();
    await service.putItems([item('old', 1)]);
    await service.replaceAll([item('a', 5), item('b', 9)]);

    expect((await createService().loadAll()).map((entry) => entry.id)).toEqual(['b', 'a']);
  });
});
