export interface AdapterResult {
  success: boolean;
  data?: unknown;
  error?: string;
  latencyMs: number;
}

export interface ServiceAdapter {
  /// Human-readable name matching what's stored in ServiceRegistry. Used
  /// by the adapter registry to map services on-chain to executors here.
  readonly name: string;

  /// Method names this adapter handles (e.g. "get_current_weather").
  readonly supportedMethods: readonly string[];

  /// Execute a single service call. Must catch and surface upstream errors
  /// as `success: false` rather than throwing.
  execute(method: string, params: Record<string, unknown>): Promise<AdapterResult>;
}
