import { ActivatedRoute, convertToParamMap, type ParamMap, Router } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';

import { Test } from './test';
import { SettingsService } from '../../services/settings.service';
import { StockfishService } from '../../services/stockfish.service';
import { WoodpeckerAnalyticsService } from '../../services/woodpecker-analytics.service';

describe('Test', () => {
  let component: Test;
  let fixture: ComponentFixture<Test>;
  let routerNavigateSpy: jasmine.Spy;

  beforeEach(async () => {
    const routeParamMap$ = new BehaviorSubject<ParamMap>(convertToParamMap({ view: 'analysis' }));
    const routeQueryParamMap$ = new BehaviorSubject<ParamMap>(convertToParamMap({}));

    const stockfishMock: Pick<StockfishService, 'setListener' | 'init' | 'analyze' | 'stop' | 'destroy'> = {
      setListener: jasmine.createSpy('setListener'),
      init: jasmine.createSpy('init'),
      analyze: jasmine.createSpy('analyze').and.returnValue(true),
      stop: jasmine.createSpy('stop'),
      destroy: jasmine.createSpy('destroy'),
    };

    const settingsMock = {
      settings: () => ({
        boardTheme: 'brown',
        pieceSet: 'cburnett',
        is3d: false,
        showCoordinates: true,
        highlightLastMove: true,
        darkMode: false,
      }),
    };

    const analyticsMock = {
      recordAttempt: jasmine.createSpy('recordAttempt'),
      getDashboardData: jasmine.createSpy('getDashboardData').and.returnValue(null),
      getAvailablePgns: jasmine.createSpy('getAvailablePgns').and.returnValue([]),
      exportBackupBundle: jasmine.createSpy('exportBackupBundle').and.returnValue('{}'),
      importBackupBundle: jasmine.createSpy('importBackupBundle').and.returnValue({ ok: true, message: 'ok' }),
    };

    routerNavigateSpy = jasmine.createSpy('navigate').and.resolveTo(true);

    await TestBed.configureTestingModule({
      imports: [Test],
      providers: [
        { provide: StockfishService, useValue: stockfishMock },
        { provide: SettingsService, useValue: settingsMock },
        { provide: WoodpeckerAnalyticsService, useValue: analyticsMock },
        { provide: Router, useValue: { navigate: routerNavigateSpy } as Partial<Router> },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: routeParamMap$.asObservable(),
            queryParamMap: routeQueryParamMap$.asObservable(),
          } as Partial<ActivatedRoute>,
        },
      ],
    }).compileComponents();

    spyOn(window.localStorage, 'getItem').and.returnValue(null);
    spyOn(window.localStorage, 'setItem');

    fixture = TestBed.createComponent(Test);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should save a position bookmark with title, note and current fen', () => {
    component.applyFen('4k3/8/8/8/8/8/8/4K3 w - - 0 1');

    component.savePositionBookmark({
      title: 'Finale semplice',
      note: 'Da rivedere',
    });

    const bookmarks = component.positionBookmarks();
    expect(bookmarks.length).toBe(1);
    expect(bookmarks[0].title).toBe('Finale semplice');
    expect(bookmarks[0].note).toBe('Da rivedere');
    expect(bookmarks[0].fen).toBe('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
    expect(component.fenFeedback()).toBe('Posizione salvata nei bookmark.');
    expect(window.localStorage.setItem).toHaveBeenCalled();
  });

  it('should load a bookmark and switch to analysis view', () => {
    component.savePositionBookmark({
      title: 'Posizione test',
      note: 'Nota',
    });
    const bookmarkId = component.positionBookmarks()[0].id;

    component.setActiveView('library');
    component.loadPositionBookmark(bookmarkId);

    expect(component.currentFen()).toBe(component.positionBookmarks()[0].fen);
    expect(component.fenFeedback()).toContain('Bookmark caricato: Posizione test');
    expect(routerNavigateSpy).toHaveBeenCalledWith(['/', 'analysis']);
  });

  it('should update an existing bookmark title and note', () => {
    component.savePositionBookmark({
      title: 'Vecchio titolo',
      note: 'Vecchia nota',
    });
    const bookmarkId = component.positionBookmarks()[0].id;

    component.updatePositionBookmark({
      id: bookmarkId,
      title: 'Nuovo titolo',
      note: 'Nuova nota',
    });

    const bookmark = component.positionBookmarks()[0];
    expect(bookmark.title).toBe('Nuovo titolo');
    expect(bookmark.note).toBe('Nuova nota');
    expect(component.fenFeedback()).toBe('Bookmark aggiornato.');
  });

  it('should delete an existing bookmark', () => {
    component.savePositionBookmark({
      title: 'Da cancellare',
      note: 'Nota',
    });
    const bookmarkId = component.positionBookmarks()[0].id;

    component.deletePositionBookmark(bookmarkId);

    expect(component.positionBookmarks().length).toBe(0);
    expect(component.fenFeedback()).toBe('Bookmark eliminato.');
  });
});
