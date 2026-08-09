/**
 * Open-Meteo weather — free, no key. Geocode a district/village to
 * coordinates, then pull a 3-day forecast for it.
 */

export interface DayForecast {
  date: string;
  tMax: number;
  tMin: number;
  rainMm: number;
  rainProb: number;
  windKmh: number;
  uv: number;
}

export interface WeatherReport {
  location: string;
  days: DayForecast[];
  summary: string;
}

interface GeoResult {
  latitude: number;
  longitude: number;
  name: string;
}

async function geocode(location: string): Promise<GeoResult | null> {
  const url =
    "https://geocoding-api.open-meteo.com/v1/search" +
    `?name=${encodeURIComponent(location)}&count=1&language=en&format=json&countryCode=IN`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    results?: Array<{ latitude: number; longitude: number; name: string }>;
  };
  const r = data.results?.[0];
  if (!r) return null;
  return { latitude: r.latitude, longitude: r.longitude, name: r.name };
}

export async function getWeather(location: string): Promise<WeatherReport | null> {
  const g = await geocode(location);
  if (!g) return null;

  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${g.latitude}&longitude=${g.longitude}` +
    "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,uv_index_max" +
    "&timezone=Asia%2FKolkata&forecast_days=3";

  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    daily?: {
      time?: string[];
      temperature_2m_max?: number[];
      temperature_2m_min?: number[];
      precipitation_sum?: number[];
      precipitation_probability_max?: number[];
      wind_speed_10m_max?: number[];
      uv_index_max?: number[];
    };
  };
  const daily = data.daily;
  if (!daily?.time?.length) return null;

  const days: DayForecast[] = daily.time.map((date, i) => ({
    date,
    tMax: daily.temperature_2m_max?.[i] ?? 0,
    tMin: daily.temperature_2m_min?.[i] ?? 0,
    rainMm: daily.precipitation_sum?.[i] ?? 0,
    rainProb: daily.precipitation_probability_max?.[i] ?? 0,
    windKmh: daily.wind_speed_10m_max?.[i] ?? 0,
    uv: daily.uv_index_max?.[i] ?? 0,
  }));

  const today = days[0];
  const summary =
    today.rainProb >= 50
      ? `${today.rainProb}% chance of rain today (~${today.rainMm} mm). ` +
        `Temp ${today.tMin}°C to ${today.tMax}°C.`
      : `Mostly dry today. Temp ${today.tMin}°C to ${today.tMax}°C, ` +
        `wind up to ${today.windKmh} km/h.`;

  return { location: g.name, days, summary };
}
