import type { ServiceAdapter, AdapterResult } from "./types.js";
import { config } from "../config.js";

export class OpenWeatherAdapter implements ServiceAdapter {
  readonly name = "OpenWeather";
  readonly supportedMethods = ["get_current_weather", "get_forecast"] as const;

  async execute(method: string, params: Record<string, unknown>): Promise<AdapterResult> {
    const start = Date.now();
    try {
      if (method === "get_current_weather") {
        return await this.getCurrentWeather(params, start);
      }
      if (method === "get_forecast") {
        return await this.getForecast(params, start);
      }
      return {
        success: false,
        error: `Unsupported method: ${method}`,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        latencyMs: Date.now() - start,
      };
    }
  }

  private async getCurrentWeather(
    params: Record<string, unknown>,
    start: number,
  ): Promise<AdapterResult> {
    const city = typeof params.city === "string" ? params.city : null;
    if (!city) {
      return {
        success: false,
        error: "Missing required parameter: city",
        latencyMs: Date.now() - start,
      };
    }

    const url = new URL("https://api.openweathermap.org/data/2.5/weather");
    url.searchParams.set("q", city);
    url.searchParams.set("appid", config.apiKeys.openWeather());
    url.searchParams.set("units", typeof params.units === "string" ? params.units : "metric");

    const res = await fetch(url.toString());
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return {
        success: false,
        error: (body as any)?.message ?? `OpenWeather returned HTTP ${res.status}`,
        latencyMs: Date.now() - start,
      };
    }

    const data: any = await res.json();
    return {
      success: true,
      data: {
        city,
        temperature: data.main?.temp,
        description: data.weather?.[0]?.description,
        humidity: data.main?.humidity,
        pressure: data.main?.pressure,
        wind_speed: data.wind?.speed,
      },
      latencyMs: Date.now() - start,
    };
  }

  private async getForecast(
    params: Record<string, unknown>,
    start: number,
  ): Promise<AdapterResult> {
    const city = typeof params.city === "string" ? params.city : null;
    if (!city) {
      return {
        success: false,
        error: "Missing required parameter: city",
        latencyMs: Date.now() - start,
      };
    }

    const url = new URL("https://api.openweathermap.org/data/2.5/forecast");
    url.searchParams.set("q", city);
    url.searchParams.set("appid", config.apiKeys.openWeather());
    url.searchParams.set("units", typeof params.units === "string" ? params.units : "metric");
    url.searchParams.set("cnt", "8"); // 24 hours, 3-hour steps

    const res = await fetch(url.toString());
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return {
        success: false,
        error: (body as any)?.message ?? `OpenWeather forecast returned HTTP ${res.status}`,
        latencyMs: Date.now() - start,
      };
    }

    const data: any = await res.json();
    return {
      success: true,
      data: {
        city,
        forecast: (data.list ?? []).map((p: any) => ({
          time: p.dt_txt,
          temperature: p.main?.temp,
          description: p.weather?.[0]?.description,
        })),
      },
      latencyMs: Date.now() - start,
    };
  }
}
