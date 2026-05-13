import type { ServiceAdapter } from "./types.js";
import { OpenWeatherAdapter } from "./openweather.js";

const adapters: Map<string, ServiceAdapter> = new Map();

function register(adapter: ServiceAdapter) {
  adapters.set(adapter.name.toLowerCase(), adapter);
}

register(new OpenWeatherAdapter());

/// Look up by on-chain service name. Case-insensitive so registries with
/// loose naming conventions still resolve.
export function getAdapter(serviceName: string): ServiceAdapter | null {
  return adapters.get(serviceName.toLowerCase()) ?? null;
}

export function listAdapterNames(): string[] {
  return Array.from(adapters.values()).map((a) => a.name);
}
