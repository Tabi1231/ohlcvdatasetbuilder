
export type Timeframe = '1m' | '5m' | '1h' | '1d';

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CollectionStats {
  totalRequests: number;
  completedRequests: number;
  totalCandles: number;
  startTime: number;
  lastCandleTimestamp: number | null;
}

export interface RateLimitState {
  requestsInWindow: number;
  maxRequestsPerMinute: number;
  remainingRequests: number;
  safeIntervalMs: number;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

export interface CollectionConfig {
  symbol: string;
  timeframe: Timeframe;
  startDate: string;
  endDate: string;
  delayMs: number;
}
