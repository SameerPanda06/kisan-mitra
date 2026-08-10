import { afterEach, describe, expect, it, vi } from "vitest";
import { getWeather } from "../src/weather.js";

const geoUrl =
  "https://geocoding-api.open-meteo.com/v1/search" +
  "?name=Bhubaneswar&count=1&language=en&format=json&countryCode=IN";

const forecastUrl =
  "https://api.open-meteo.com/v1/forecast" +
  "?latitude=20.2961&longitude=85.8245" +
  "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,uv_index_max" +
  "&timezone=Asia%2FKolkata&forecast_days=3";

const geoBody = { results: [{ latitude: 20.2961, longitude: 85.8245, name: "Bhubaneswar" }] };
const forecastBody = {
  daily: {
    time: ["2026-08-10", "2026-08-11", "2026-08-12"],
    temperature_2m_max: [31.1, 30.2, 29.8],
    temperature_2m_min: [26.2, 25.5, 25.1],
    precipitation_sum: [0, 4.2, 1.1],
    precipitation_probability_max: [10, 70, 40],
    wind_speed_10m_max: [14, 18, 9],
    uv_index_max: [7, 5, 4],
  },
};

function mockFetch(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.startsWith("https://geocoding-api")) {
      return { ok: true, json: async () => geoBody };
    }
    if (url.startsWith("https://api.open-meteo.com")) {
      return { ok: true, json: async () => forecastBody };
    }
    return { ok: false, json: async () => ({}) };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("getWeather", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("geocodes with the India country filter and builds the forecast URL", async () => {
    const fetchMock = mockFetch();
    const report = await getWeather("Bhubaneswar");
    expect(report).not.toBeNull();
    expect(report?.location).toBe("Bhubaneswar");
    const calls = fetchMock.mock.calls.map((c) => c[0]);
    expect(calls[0]).toBe(geoUrl);
    expect(calls[1]).toBe(forecastUrl);
  });

  it("parses three days and builds a rain-aware summary", async () => {
    mockFetch();
    const report = await getWeather("Bhubaneswar");
    expect(report?.days).toHaveLength(3);
    expect(report?.days[1].rainProb).toBe(70);
    expect(report?.days[1].rainMm).toBe(4.2);
    // First day has <50% rain, so the summary is the dry branch.
    expect(report?.summary).toContain("Mostly dry today.");
  });

  it("returns null when geocoding finds nothing", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ results: [] }) }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await getWeather("NotAPlaceOnEarth")).toBeNull();
  });

  it("returns null when the forecast API fails", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.startsWith("https://geocoding-api")
        ? { ok: true, json: async () => geoBody }
        : { ok: false, json: async () => ({}) },
    );
    vi.stubGlobal("fetch", fetchMock);
    expect(await getWeather("Bhubaneswar")).toBeNull();
  });
});
