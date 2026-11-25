import React, { useEffect, useRef, useState } from 'react';
import {
  APIProvider,
  AdvancedMarker,
  Map as GoogleMap,
  Pin,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { CloudFog, CloudRain, Compass, MapPin, Moon, Navigation, Play, Sun } from 'lucide-react';
import { CAREER_ROUTES } from '../data/routes';
import type { CareerRouteSpec, RouteId, WeatherPreset } from '../types/simulator';

const MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || '';

interface ComputedStopPin {
  label: string;
  position: { lat: number; lng: number };
  index: number;
  isTerminal: boolean;
}

interface LiveRouteMetrics {
  distanceKm: number;
  durationMin: number;
  stopPins: ComputedStopPin[];
}

interface RoutePolylineControllerProps {
  route: CareerRouteSpec;
  onMetrics: (metrics: LiveRouteMetrics | null) => void;
  onStatus: (status: { loading: boolean; error: string | null }) => void;
}

/**
 * Uses the modern Google Maps Platform Routes Library (`useMapsLibrary('routes')` + `Route.computeRoutes()`)
 * with address strings so all displayed coordinates, polylines, and pins originate directly from the live API.
 */
interface MapPolylineLike {
  setMap: (map: unknown) => void;
  setOptions: (options: {
    strokeColor: string;
    strokeOpacity: number;
    strokeWeight: number;
  }) => void;
}

const RoutePolylineController: React.FC<RoutePolylineControllerProps> = ({
  route,
  onMetrics,
  onStatus,
}) => {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<MapPolylineLike[]>([]);
  const [pins, setPins] = useState<ComputedStopPin[]>([]);

  useEffect(() => {
    if (!routesLib || !map) return;

    let cancelled = false;
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];
    setPins([]);
    onStatus({ loading: true, error: null });

    const originQuery = route.stops[0].mapQuery;
    const destinationQuery = route.stops[route.stops.length - 1].mapQuery;
    const intermediates = route.stops.slice(1, -1).map((s) => ({
      location: s.mapQuery,
    }));

    const request = {
      origin: originQuery,
      destination: destinationQuery,
      intermediates,
      travelMode: 'DRIVING',
      fields: ['path', 'distanceMeters', 'durationMillis', 'viewport', 'legs'],
    };

    const RouteClass = (routesLib as unknown as { Route?: { computeRoutes: (req: unknown) => Promise<{ routes?: unknown[] }> } }).Route;

    if (!RouteClass || typeof RouteClass.computeRoutes !== 'function') {
      onStatus({
        loading: false,
        error: 'Google Maps Routes library is initializing. You can still launch the 3D mountain drive.',
      });
      return;
    }

    RouteClass.computeRoutes(request)
      .then((response) => {
        if (cancelled) return;
        const primaryRoute = response?.routes?.[0] as
          | {
              distanceMeters?: number;
              durationMillis?: number;
              viewport?: Parameters<typeof map.fitBounds>[0];
              legs?: Array<{
                startLocation?: { lat?: () => number; lng?: () => number } | { lat: number; lng: number };
                endLocation?: { lat?: () => number; lng?: () => number } | { lat: number; lng: number };
              }>;
              createPolylines?: () => MapPolylineLike[];
            }
          | undefined;

        if (!primaryRoute) {
          onStatus({ loading: false, error: 'Unable to compute highway polyline right now.' });
          onMetrics(null);
          return;
        }

        // Render modern Routes API polyline
        if (typeof primaryRoute.createPolylines === 'function') {
          const newPolylines = primaryRoute.createPolylines();
          newPolylines.forEach((poly) => {
            poly.setOptions({
              strokeColor: '#0B5ED7',
              strokeOpacity: 0.94,
              strokeWeight: 6,
            });
            poly.setMap(map);
          });
          polylinesRef.current = newPolylines;
        }

        if (primaryRoute.viewport) {
          map.fitBounds(primaryRoute.viewport, 48);
        }

        // Extract live API-resolved waypoint markers from returned route legs
        const extractLatLng = (
          loc?: { lat?: (() => number) | number; lng?: (() => number) | number }
        ): { lat: number; lng: number } | null => {
          if (!loc) return null;
          const lat = typeof loc.lat === 'function' ? loc.lat() : loc.lat;
          const lng = typeof loc.lng === 'function' ? loc.lng() : loc.lng;
          if (typeof lat === 'number' && typeof lng === 'number') return { lat, lng };
          return null;
        };

        const resolvedPins: ComputedStopPin[] = [];
        const legs = primaryRoute.legs ?? [];
        legs.forEach((leg, idx) => {
          const startPos = extractLatLng(leg.startLocation);
          if (startPos && route.stops[idx]) {
            resolvedPins.push({
              label: route.stops[idx].name,
              position: startPos,
              index: idx + 1,
              isTerminal: idx === 0,
            });
          }
          if (idx === legs.length - 1) {
            const endPos = extractLatLng(leg.endLocation);
            const lastStop = route.stops[route.stops.length - 1];
            if (endPos && lastStop) {
              resolvedPins.push({
                label: lastStop.name,
                position: endPos,
                index: route.stops.length,
                isTerminal: true,
              });
            }
          }
        });

        setPins(resolvedPins);
        onMetrics({
          distanceKm: Math.round((primaryRoute.distanceMeters ?? route.approxDistanceKm * 1000) / 1000),
          durationMin: Math.round((primaryRoute.durationMillis ?? 0) / 60000),
          stopPins: resolvedPins,
        });
        onStatus({ loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('OVER_QUERY_LIMIT') ||
          msg.includes('Quota') ||
          msg.includes('429')
        ) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        onStatus({
          loading: false,
          error: 'Live route polyline temporarily unavailable. 3D mountain corridor is ready to drive.',
        });
        onMetrics(null);
      });

    return () => {
      cancelled = true;
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [routesLib, map, route]);

  return (
    <>
      {pins.map((pin) => (
        <AdvancedMarker key={`${route.id}-${pin.index}`} position={pin.position} title={pin.label}>
          <Pin
            background={pin.isTerminal ? '#0B5ED7' : '#F59E0B'}
            borderColor="#0B111A"
            glyphColor="#FFFFFF"
            glyphText={String(pin.index)}
          />
        </AdvancedMarker>
      ))}
    </>
  );
};

interface GoogleMapsDispatchProps {
  selectedRouteId: RouteId;
  weather: WeatherPreset;
  onSelectRoute: (id: RouteId) => void;
  onSelectWeather: (w: WeatherPreset) => void;
  onLaunchDrive: () => void;
}

export const GoogleMapsDispatch: React.FC<GoogleMapsDispatchProps> = ({
  selectedRouteId,
  weather,
  onSelectRoute,
  onSelectWeather,
  onLaunchDrive,
}) => {
  const activeRoute = CAREER_ROUTES.find((r) => r.id === selectedRouteId) ?? CAREER_ROUTES[0];
  const [liveMetrics, setLiveMetrics] = useState<LiveRouteMetrics | null>(null);
  const [mapStatus, setMapStatus] = useState<{ loading: boolean; error: string | null }>({
    loading: false,
    error: null,
  });

  const weatherOptions: Array<{ id: WeatherPreset; label: string; icon: React.ReactNode }> = [
    { id: 'sunny', label: 'Mountain Sun', icon: <Sun className="w-4 h-4" /> },
    { id: 'mist', label: 'Himalayan Mist', icon: <CloudFog className="w-4 h-4" /> },
    { id: 'rain', label: 'Monsoon Rain', icon: <CloudRain className="w-4 h-4" /> },
    { id: 'night', label: 'Night Ghat', icon: <Moon className="w-4 h-4" /> },
  ];

  return (
    <div className="w-full max-w-[1380px] mx-auto px-4 md:px-6 pt-20 pb-8">
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-sky-400 tracking-wide mb-1">
            Haryana Roadways Interstate Dispatch · Live Google Maps Corridors
          </p>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-white">
            Select Haryana to Himachal Mountain Route
          </h1>
        </div>

        <button
          type="button"
          onClick={onLaunchDrive}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-[#0B5ED7] hover:bg-[#094DB2] text-white font-semibold text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Play className="w-4 h-4 fill-current" />
          Depart Depot — Launch 3D Drive
        </button>
      </div>

      {/* Main 2-Column Dispatch Grid: Left Route List + Right Live Google Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Route Cards Column */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          {CAREER_ROUTES.map((route) => {
            const isSelected = route.id === selectedRouteId;
            return (
              <button
                key={route.id}
                type="button"
                onClick={() => onSelectRoute(route.id)}
                className={`text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[#152236] border-[#0B5ED7] text-white'
                    : 'bg-[#111A28] border-slate-800 hover:border-slate-700 text-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <h2 className="font-display text-base font-bold text-white leading-snug">
                    {route.title}
                  </h2>
                  <span className="font-mono text-xs text-amber-400 tabular-nums whitespace-nowrap shrink-0">
                    {route.depotPlate}
                  </span>
                </div>
                <p className="text-xs text-sky-300 mb-2">{route.hindiBoard}</p>
                <p className="text-xs text-slate-400 leading-relaxed mb-3">{route.description}</p>
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-400 font-mono tabular-nums">
                  <span>{route.highwayCode}</span>
                  <span aria-hidden="true">·</span>
                  <span>{route.approxDistanceKm} km</span>
                  <span aria-hidden="true">·</span>
                  <span>Max {route.maxAltitudeM} m</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-300">{route.difficulty}</span>
                </div>
              </button>
            );
          })}

          {/* Weather & Time Selector */}
          <div className="p-4 rounded-xl bg-[#111A28] border border-slate-800 mt-1">
            <div className="text-xs font-semibold text-slate-300 mb-2.5">
              Himachal Weather &amp; Time of Day
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {weatherOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onSelectWeather(opt.id)}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    weather === opt.id
                      ? 'bg-[#0B5ED7] text-white'
                      : 'bg-[#182436] text-slate-300 hover:text-white'
                  }`}
                >
                  {opt.icon}
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live Google Maps Panel + Stop Schedule */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="rounded-xl overflow-hidden border border-slate-800 bg-[#111A28] flex flex-col flex-1 min-h-[430px]">
            {/* Map Header Bar */}
            <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Navigation className="w-4 h-4 text-sky-400" />
                <span>{activeRoute.highwayCode}</span>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono text-slate-300 tabular-nums">
                {mapStatus.loading && <span className="text-sky-400">Computing live Google route…</span>}
                {liveMetrics && (
                  <>
                    <span>Google Route: {liveMetrics.distanceKm} km</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Est. {Math.floor(liveMetrics.durationMin / 60)}h {liveMetrics.durationMin % 60}m
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Live Interactive Google Map (explicit height so it never collapses) */}
            <div className="relative w-full h-[360px] lg:h-[420px] bg-[#0F172A]">
              {MAPS_API_KEY ? (
                <APIProvider
                  apiKey={MAPS_API_KEY}
                  language="en"
                  region="IN"
                  libraries={['routes', 'marker']}
                >
                  <GoogleMap
                    mapId="DEMO_MAP_ID"
                    defaultCenter={{ lat: 31.35, lng: 77.15 }}
                    defaultZoom={8}
                    gestureHandling="greedy"
                    mapTypeControl={true}
                    streetViewControl={false}
                    fullscreenControl={true}
                    internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                    style={{ width: '100%', height: '100%' }}
                  >
                    <RoutePolylineController
                      route={activeRoute}
                      onMetrics={setLiveMetrics}
                      onStatus={setMapStatus}
                    />
                  </GoogleMap>
                </APIProvider>
              ) : (
                <div className="w-full h-full relative flex flex-col items-center justify-center p-6 text-center">
                  <img
                    src="/src/assets/images/himachal_depot_backdrop_1795494857599.jpg"
                    alt="Himachal Pradesh mountain highway route preview"
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 w-full h-full object-cover opacity-30"
                  />
                  <div className="relative z-10 max-w-md">
                    <Compass className="w-8 h-8 text-sky-400 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-white mb-1">
                      Google Maps API Key Pending Runtime Injection
                    </p>
                    <p className="text-xs text-slate-300">
                      The 3D Haryana-to-Himachal highway corridor is fully loaded and ready to drive.
                    </p>
                  </div>
                </div>
              )}

              {mapStatus.error && (
                <div className="absolute bottom-3 left-3 right-3 z-20 px-3 py-2 rounded-lg bg-[#0B111A]/95 border border-amber-500/40 text-xs text-amber-200">
                  {mapStatus.error}
                </div>
              )}
            </div>

            {/* Route Landmarks & Passenger Stops Manifest */}
            <div className="p-4 border-t border-slate-800">
              <div className="text-xs font-semibold text-slate-300 mb-2.5">
                Scheduled 3D Stops, Landmarks &amp; Waiting Crowds
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                {activeRoute.stops.map((stop, idx) => (
                  <div
                    key={stop.id}
                    className="p-2.5 rounded-lg bg-[#162234] border border-slate-800/80"
                  >
                    <div className="flex items-center justify-between text-[11px] font-mono text-sky-400 mb-1">
                      <span>Stop {idx + 1}</span>
                      <span>{stop.altitudeM}m</span>
                    </div>
                    <div className="text-xs font-semibold text-white leading-snug mb-1">
                      {stop.name}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                      <span className="truncate capitalize">
                        {stop.landmarkType.replace('_', ' ')} · ₹{stop.fareInr}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
