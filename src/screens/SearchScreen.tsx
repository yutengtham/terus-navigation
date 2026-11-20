import { useEffect, useRef, useState } from 'react';
import { QuickCategoryIcon } from '../components/QuickCategoryIcon';
import { BackIcon, CloseIcon, NavArrowIcon, PinIcon, SearchIcon } from '../components/icons';
import type { LngLat } from '../config/malaysia';
import { QUICK_CATEGORIES, type QuickCategory } from '../config/quickCategories';
import type { Place } from '../models/place';
import { loadRecentPlaces, searchNearby, searchPlaces, SearchError } from '../services/searchService';
import { formatDistance } from '../utils/format';
import { distanceMeters } from '../utils/geo';

type Props = {
  token: string;
  /** Optional Geoapify key: adds OpenStreetMap streets / neighbourhoods to results. */
  osmKey: string | null;
  /** Your GPS position, if available - used to rank nearby results and show distances. */
  userPosition: LngLat | null;
  onSelect: (place: Place) => void;
  onClose: () => void;
  /** Text in the empty search box, e.g. "Choose start point". */
  placeholder?: string;
  /** When set, shows a "Your location" option at the top (used when picking a start point). */
  onUseMyLocation?: () => void;
  /** Where "near me" searches look when GPS is off: the centre of the map. */
  mapCenter?: LngLat;
};

/** Quick picks shown before typing (from the Terus brief). */
const POPULAR = ['KLCC', 'Pavilion Kuala Lumpur', 'Mid Valley Megamall', 'Sunway Pyramid', 'KLIA Terminal 1', 'Penang International Airport'];

const TYPING_PAUSE_MS = 350;

/** Screen 2 - Destination search. */
export function SearchScreen({ token, osmKey, userPosition, onSelect, onClose, placeholder, onUseMyLocation, mapCenter }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recents] = useState(loadRecentPlaces);
  const inputRef = useRef<HTMLInputElement>(null);
  // Quick search buttons ("Petrol", "Hospital"...): nearest places of that kind.
  const [category, setCategory] = useState<QuickCategory | null>(null);
  const [nearby, setNearby] = useState<Place[]>([]);
  const nearAnchor = userPosition ?? mapCenter ?? null;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Search after the user pauses typing; cancel older requests so results never arrive out of order.
  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      searchPlaces(token, text, { near: userPosition ?? undefined, signal: controller.signal, osmKey })
        .then((places) => {
          setResults(places);
          setError(null);
        })
        .catch((err: unknown) => {
          if ((err as Error).name === 'AbortError') return;
          setError(err instanceof SearchError ? err.message : 'Search failed. Please try again.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, TYPING_PAUSE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
    // userPosition changes every second while GPS is on; only re-search when the text changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, token, osmKey]);

  // A quick button was tapped: find the nearest places of that kind (typing cancels it).
  useEffect(() => {
    if (!category || !nearAnchor) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setNearby([]);
    searchNearby(token, osmKey, category, nearAnchor, controller.signal)
      .then(setNearby)
      .catch((err: unknown) => {
        if ((err as Error).name === 'AbortError') return;
        setError(err instanceof SearchError ? err.message : 'Search failed. Please try again.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
    // GPS updates every second; search again only when the button changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, token, osmKey]);

  const pickCategory = (c: QuickCategory) => {
    setQuery('');
    setCategory((current) => (current?.id === c.id ? null : c)); // tap again to close
  };

  const showStart = query.trim().length < 2;
  const showCategory = showStart && category !== null;
  const showsOsm =
    results.some((p) => p.source === 'osm') ||
    (showCategory && nearby.some((p) => p.source === 'osm')) ||
    (showStart && !showCategory && recents.some((p) => p.source === 'osm'));

  return (
    <div className="nn-search-screen" role="dialog" aria-label="Search destination">
      <div className="nn-search-screen__inner">
        <div className="nn-card nn-search nn-search--active">
          <button className="nn-icon-button" onClick={onClose} aria-label="Back to map">
            <BackIcon />
          </button>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCategory(null);
            }}
            placeholder={placeholder ?? 'Place, address or postcode'}
            enterKeyHint="search"
            autoComplete="off"
            aria-label="Search places in Malaysia"
          />
          {query && (
            <button className="nn-icon-button" onClick={() => setQuery('')} aria-label="Clear search">
              <CloseIcon />
            </button>
          )}
        </div>

        <div className="nn-card nn-results">
          {onUseMyLocation && (
            <button className="nn-place nn-place--mine" onClick={onUseMyLocation}>
              <span className="nn-place__icon nn-place__icon--mine">
                <NavArrowIcon size={18} color="#FFFFFF" />
              </span>
              <span className="nn-place__text">
                <span className="nn-place__name">Your location</span>
                <span className="nn-place__address">Start from where you are now (GPS)</span>
              </span>
            </button>
          )}
          {showStart && !onUseMyLocation && (
            // Quick search buttons - scroll sideways for more.
            <div className="nn-quick" role="toolbar" aria-label="Search nearby">
              {QUICK_CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  className={`nn-quick__btn${category?.id === c.id ? ' is-active' : ''}`}
                  onClick={() => pickCategory(c)}
                  aria-pressed={category?.id === c.id}
                >
                  <span className="nn-quick__circle" style={{ ['--nn-qc-bg' as string]: c.color }}>
                    <QuickCategoryIcon id={c.id} />
                  </span>
                  <span className="nn-quick__label">{c.label}</span>
                </button>
              ))}
            </div>
          )}
          {showCategory ? (
            <>
              <div className="nn-results__heading nn-results__heading--row">
                <span>
                  {category.plural} {userPosition ? 'near you' : 'near the map centre'}
                </span>
                <button className="nn-link-button" onClick={() => setCategory(null)}>
                  Close
                </button>
              </div>
              {error ? (
                <div className="nn-results__message">{error}</div>
              ) : loading ? (
                <div className="nn-results__message">Searching nearby…</div>
              ) : nearby.length === 0 ? (
                <div className="nn-results__message">No {category.plural.toLowerCase()} found within about 8 km.</div>
              ) : (
                <PlaceList places={nearby} userPosition={nearAnchor} onSelect={onSelect} />
              )}
            </>
          ) : showStart ? (
            <>
              <div className="nn-results__heading">Popular in Malaysia</div>
              <div className="nn-chips">
                {POPULAR.map((p) => (
                  <button key={p} className="nn-chip" onClick={() => setQuery(p)}>
                    {p}
                  </button>
                ))}
              </div>
              {recents.length > 0 && (
                <>
                  <div className="nn-results__heading">Recent</div>
                  <PlaceList places={recents} userPosition={userPosition} onSelect={onSelect} />
                </>
              )}
            </>
          ) : error ? (
            <div className="nn-results__message">{error}</div>
          ) : loading && results.length === 0 ? (
            <div className="nn-results__message">Searching…</div>
          ) : results.length === 0 ? (
            <div className="nn-results__message">
              No places found in Malaysia for “{query.trim()}”. Try a shorter name, a street (Jalan …) or a postcode.
            </div>
          ) : (
            <PlaceList places={results} userPosition={userPosition} onSelect={onSelect} />
          )}
          {showsOsm && (
            // Required credit for OpenStreetMap data and the Geoapify free plan.
            <div className="nn-results__credit">
              Some results © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>
              {' · '}
              <a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">Powered by Geoapify</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PlaceList({ places, userPosition, onSelect }: { places: Place[]; userPosition: LngLat | null; onSelect: (p: Place) => void }) {
  return (
    <ul className="nn-place-list">
      {places.map((p) => (
        <li key={p.id}>
          <button className="nn-place" onClick={() => onSelect(p)}>
            <span className={`nn-place__icon nn-place__icon--${p.kind === 'poi' ? 'poi' : 'area'}`}>
              {p.kind === 'poi' ? <PinIcon /> : <SearchIcon size={18} color="#5B6B80" />}
            </span>
            <span className="nn-place__text">
              <span className="nn-place__name">{p.name}</span>
              <span className="nn-place__address">{[p.category, p.address].filter(Boolean).join(' · ')}</span>
            </span>
            {userPosition && (
              <span className="nn-place__distance">{formatDistance(distanceMeters(userPosition, p.coordinates))}</span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
