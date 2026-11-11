import React, { useEffect, useState } from 'react';
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  MapPin,
  Search,
  Sun,
  RefreshCw,
  X,
} from 'lucide-react';

interface WeatherLocation {
  id: number;
  name: string;
  country: string;
  admin1?: string;
  latitude: number;
  longitude: number;
}

interface WeatherReading {
  temperature: number;
  humidity: number;
  code: number;
  aqi: number | null;
  observedAt: string;
}

interface GeocodingResult extends WeatherLocation {
  country_code?: string;
}

interface IndiaPostOffice {
  Name: string;
  District: string;
  State: string;
  Pincode: string;
}

const LOCATION_STORAGE_KEY = 'tracker_dashboard_weather_location';

async function searchIndiaPostOfficeLocations(query: string, signal: AbortSignal): Promise<GeocodingResult[]> {
  const pinQuery = /^\d{6}$/.test(query);
  const endpoint = pinQuery ? 'pincode' : 'postoffice';
  const postalResponse = await fetch(`https://api.postalpincode.in/${endpoint}/${encodeURIComponent(query)}`, { signal });
  if (!postalResponse.ok) throw new Error('India Post location search is temporarily unavailable.');
  const postalPayload = await postalResponse.json();
  const offices: IndiaPostOffice[] = Array.isArray(postalPayload) && postalPayload[0]?.Status === 'Success' && Array.isArray(postalPayload[0]?.PostOffice)
    ? postalPayload[0].PostOffice
    : [];

  const matched: (GeocodingResult | null)[] = await Promise.all(offices.slice(0, 8).map(async (office): Promise<GeocodingResult | null> => {
    const searchTerms = [`${office.Name}, ${office.State}`, `${office.District}, ${office.State}`];
    for (const term of searchTerms) {
      const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
      url.searchParams.set('name', term);
      url.searchParams.set('count', '1');
      url.searchParams.set('language', 'en');
      url.searchParams.set('format', 'json');
      url.searchParams.set('countryCode', 'IN');
      const response = await fetch(url, { signal });
      if (!response.ok) continue;
      const body = await response.json();
      const place = Array.isArray(body?.results) ? body.results[0] : null;
      if (place && Number.isFinite(place.latitude) && Number.isFinite(place.longitude)) {
        return {
          id: Number(place.id),
          name: office.Name,
          admin1: `${office.District}, ${office.State} · ${office.Pincode}`,
          country: 'India',
          country_code: 'IN',
          latitude: place.latitude,
          longitude: place.longitude,
        };
      }
    }
    return null;
  }));

  const seen = new Set<number>();
  const results: GeocodingResult[] = [];
  for (const item of matched) {
    if (item && !seen.has(item.id)) {
      seen.add(item.id);
      results.push(item);
    }
  }
  return results;
}

function getSavedLocation(): WeatherLocation | null {
  try {
    const value = window.localStorage.getItem(LOCATION_STORAGE_KEY);
    if (!value) return null;
    const location = JSON.parse(value) as WeatherLocation;
    if (typeof location.latitude === 'number' && typeof location.longitude === 'number' && location.name) {
      return location;
    }
  } catch {
    // Ignore invalid or unavailable browser storage.
  }
  return null;
}

function getWeatherDescription(code: number): string {
  if (code === 0) return 'Clear sky';
  if ([1, 2].includes(code)) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if ([45, 48].includes(code)) return 'Foggy';
  if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzle';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snow';
  if ([95, 96, 99].includes(code)) return 'Thunderstorm';
  return 'Current conditions';
}

function getWeatherIcon(code: number) {
  if (code === 0) return Sun;
  if ([1, 2].includes(code)) return CloudSun;
  if (code === 3) return Cloud;
  if ([45, 48].includes(code)) return CloudFog;
  if ([51, 53, 55, 56, 57].includes(code)) return CloudDrizzle;
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return CloudRain;
  if ([71, 73, 75, 77, 85, 86].includes(code)) return CloudSnow;
  if ([95, 96, 99].includes(code)) return CloudLightning;
  return CloudSun;
}

function getAqiLabel(aqi: number | null): string {
  if (aqi === null) return 'Unavailable';
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Sensitive';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very unhealthy';
  return 'Hazardous';
}

export const DashboardWeather: React.FC = () => {
  const [location, setLocation] = useState<WeatherLocation | null>(getSavedLocation);
  const [reading, setReading] = useState<WeatherReading | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searchCountry, setSearchCountry] = useState('IN');
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!location) {
      setReading(null);
      setWeatherError('');
      return;
    }

    let mounted = true;
    let controller: AbortController | null = null;
    const loadWeather = async () => {
      controller?.abort();
      controller = new AbortController();
      setWeatherLoading(true);
      setWeatherError('');
      const { latitude, longitude } = location;
      const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast');
      forecastUrl.search = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        current: 'temperature_2m,relative_humidity_2m,weather_code',
        timezone: 'auto',
      }).toString();
      const airUrl = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
      airUrl.search = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        current: 'us_aqi',
        timezone: 'auto',
      }).toString();

      try {
        const forecastResponse = await fetch(forecastUrl, { signal: controller.signal });
        if (!forecastResponse.ok) throw new Error('Weather is unavailable right now.');
        const forecast = await forecastResponse.json();
        if (!Number.isFinite(forecast?.current?.temperature_2m) || !Number.isFinite(forecast?.current?.relative_humidity_2m)) {
          throw new Error('Weather is unavailable right now.');
        }
        const airResponse = await fetch(airUrl, { signal: controller.signal }).catch(() => null);
        const air = airResponse?.ok ? await airResponse.json() : null;
        if (!mounted) return;
        setReading({
          temperature: Math.round(forecast.current.temperature_2m),
          humidity: Math.round(forecast.current.relative_humidity_2m),
          code: Number(forecast.current.weather_code),
          aqi: Number.isFinite(air?.current?.us_aqi) ? Math.round(air.current.us_aqi) : null,
          observedAt: forecast.current.time,
        });
      } catch (error) {
        if (!mounted || (error instanceof DOMException && error.name === 'AbortError')) return;
        setWeatherError(error instanceof Error ? error.message : 'Weather is unavailable right now.');
      } finally {
        if (mounted) setWeatherLoading(false);
      }
    };

    void loadWeather();
    const refreshTimer = window.setInterval(loadWeather, 15 * 60 * 1000);
    return () => {
      mounted = false;
      window.clearInterval(refreshTimer);
      controller?.abort();
    };
  }, [location, refreshKey]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPickerOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pickerOpen]);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (!pickerOpen || normalizedQuery.length < 2) {
      setResults([]);
      setSearching(false);
      setSearchError('');
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setSearchError('');
      setResults([]);
      try {
        const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
        // Open-Meteo accepts both place names and postal codes in `name`.
        // Keeping URLSearchParams here also preserves punctuation and spaces
        // in searches such as "Springfield, Illinois" or "110001, IN".
        url.searchParams.set('name', normalizedQuery);
        url.searchParams.set('count', '10');
        url.searchParams.set('language', 'en');
        url.searchParams.set('format', 'json');
        if (searchCountry) url.searchParams.set('countryCode', searchCountry);
        const response = await fetch(url, { signal: controller.signal });
        const data = await response.json().catch(() => null);
        if (!response.ok || data?.error) {
          throw new Error(data?.reason || 'Location search is unavailable. Check your connection and try again.');
        }
        const matches = Array.isArray(data?.results) ? data.results : [];
        const mappedMatches: GeocodingResult[] = matches.map((item: GeocodingResult) => ({
          id: item.id,
          name: item.name,
          admin1: item.admin1,
          country: item.country,
          country_code: item.country_code,
          latitude: item.latitude,
          longitude: item.longitude,
        })).filter((item: GeocodingResult) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));
        if (mappedMatches.length || searchCountry !== 'IN') {
          setResults(mappedMatches);
        } else {
          // The global gazetteer can omit Indian post-office names and some PINs.
          // India Post resolves the PIN/office first; Open-Meteo then supplies the
          // coordinates needed by the weather panel.
          setResults(await searchIndiaPostOfficeLocations(normalizedQuery, controller.signal));
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setSearchError(error instanceof Error ? error.message : 'Location search is unavailable. Check your connection and try again.');
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 280);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [pickerOpen, query, searchCountry]);

  const selectLocation = (nextLocation: GeocodingResult) => {
    const savedLocation: WeatherLocation = {
      id: nextLocation.id,
      name: nextLocation.name,
      admin1: nextLocation.admin1,
      country: nextLocation.country,
      latitude: nextLocation.latitude,
      longitude: nextLocation.longitude,
    };
    setLocation(savedLocation);
    try { window.localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(savedLocation)); } catch {}
    setPickerOpen(false);
    setQuery('');
  };

  const WeatherIcon = reading ? getWeatherIcon(reading.code) : CloudSun;
  const locationLabel = location
    ? [location.name, location.country].filter(Boolean).join(', ')
    : 'Local weather';
  const updatedAt = reading?.observedAt
    ? new Date(reading.observedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : '';

  return (
    <section className={`dashboard-weather${location ? ' has-location' : ' is-empty'}`} aria-label="Local weather">
      <div className="dashboard-weather-heading">
        <div className="dashboard-weather-place">
          <MapPin size={13} aria-hidden="true" />
          <span title={locationLabel}>{locationLabel}</span>
        </div>
        <div className="dashboard-weather-tools">
          {location && <button type="button" className="dashboard-weather-refresh" onClick={() => setRefreshKey((key) => key + 1)} disabled={weatherLoading} aria-label="Refresh weather" title="Refresh weather"><RefreshCw size={13} className={weatherLoading ? 'is-spinning' : ''} aria-hidden="true" /></button>}
          <button type="button" className="dashboard-weather-change" onClick={() => setPickerOpen((open) => !open)} aria-expanded={pickerOpen} aria-controls="dashboard-weather-location-picker">
            {location ? 'Change city' : 'Add city'}
          </button>
        </div>
      </div>

      {pickerOpen && (
        <div className="dashboard-weather-picker" id="dashboard-weather-location-picker">
          <div className="dashboard-weather-picker-head"><div><strong>Choose a location</strong><span>Search a city, region, or full postal code</span></div><button type="button" onClick={() => setPickerOpen(false)} aria-label="Close location search"><X size={15} /></button></div>
          <label className="dashboard-weather-country">Search in
            <select aria-label="Limit location search by country" value={searchCountry} onChange={(event) => setSearchCountry(event.target.value)}>
              <option value="IN">India</option>
              <option value="">Everywhere</option>
              <option value="US">United States</option>
              <option value="GB">United Kingdom</option>
              <option value="CA">Canada</option>
              <option value="AU">Australia</option>
            </select>
          </label>
          <label className="dashboard-weather-search">
            <Search size={14} aria-hidden="true" />
            <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="City, area, or 6-digit PIN code" aria-label="Search city, area, or postal code" autoComplete="off" inputMode="search" />
          </label>
          <div className="dashboard-weather-results" role="listbox" aria-label="Matching locations">
            {!query.trim() && <p className="dashboard-weather-hint">Type at least 2 letters to find your city.</p>}
            {searching && <p className="dashboard-weather-hint">Searching locations…</p>}
            {!searching && query.trim().length >= 2 && !results.length && !searchError && <p className="dashboard-weather-hint">No match in {searchCountry === 'IN' ? 'India' : searchCountry ? 'this country' : 'the selected search area'}. Try a nearby city or select “Everywhere”.</p>}
            {searchError && <p className="dashboard-weather-error">{searchError}</p>}
            {results.map((result) => (
              <button key={result.id} type="button" role="option" aria-selected={location?.id === result.id} onClick={() => selectLocation(result)}>
                <MapPin size={13} aria-hidden="true" />
                <span><strong>{result.name}</strong><small>{[result.admin1, result.country].filter(Boolean).join(', ')}</small></span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="dashboard-weather-reading" aria-live="polite">
        <div className="dashboard-weather-now">
          <WeatherIcon className="dashboard-weather-icon" size={40} strokeWidth={1.6} aria-hidden="true" />
          <div>
            <div className="dashboard-weather-temp">{weatherLoading && !reading ? '—' : reading ? `${reading.temperature}°` : '—'}</div>
            <div className="dashboard-weather-condition">{weatherLoading && !reading ? 'Loading weather' : reading ? getWeatherDescription(reading.code) : location ? 'Conditions unavailable' : 'Select a city to see conditions'}</div>
          </div>
        </div>
        <div className="dashboard-weather-metrics">
          <div><span>Humidity</span><strong>{reading ? `${reading.humidity}%` : '—'}</strong></div>
          <div className={`dashboard-weather-aqi aqi-${reading?.aqi === null || reading?.aqi === undefined ? 'unknown' : reading.aqi <= 50 ? 'good' : reading.aqi <= 100 ? 'moderate' : reading.aqi <= 150 ? 'sensitive' : 'poor'}`}>
            <span>US AQI</span><strong>{reading?.aqi ?? '—'}</strong><small>{getAqiLabel(reading?.aqi ?? null)}</small>
          </div>
        </div>
      </div>
      {weatherError && <p className="dashboard-weather-error dashboard-weather-fetch-error">{weatherError}</p>}
      {!location && <p className="dashboard-weather-empty-copy">Add your city to see live conditions, humidity and air quality here.</p>}
      <div className="dashboard-weather-credit">
        <span>{updatedAt ? `Updated ${updatedAt}` : 'Live weather'}</span>
        <span><a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Weather data</a> · <a href="https://atmosphere.copernicus.eu/" target="_blank" rel="noreferrer">AQI source</a></span>
      </div>
    </section>
  );
};
