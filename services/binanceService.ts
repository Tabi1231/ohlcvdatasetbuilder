
import { Candle, Timeframe } from '../types';

/**
 * Fetches OHLCV data from Binance Public API.
 * Format: [ [Open time, Open, High, Low, Close, Volume, Close time, ...], ... ]
 */
export async function fetchKlines(
  symbol: string,
  interval: Timeframe,
  startTime: number,
  limit: number = 1000,
  retryCount: number = 0
): Promise<Candle[]> {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&startTime=${startTime}&limit=${limit}`;

  try {
    const response = await fetch(url);
    
    if (response.status === 429) {
      const wait = Math.pow(2, retryCount) * 1000;
      console.warn(`Rate limit hit (429). Retrying in ${wait}ms...`);
      await new Promise(resolve => setTimeout(resolve, wait));
      return fetchKlines(symbol, interval, startTime, limit, retryCount + 1);
    }

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return data.map((item: any[]) => ({
      timestamp: item[0],
      open: parseFloat(item[1]),
      high: parseFloat(item[2]),
      low: parseFloat(item[3]),
      close: parseFloat(item[4]),
      volume: parseFloat(item[5]),
    }));
  } catch (error) {
    if (retryCount < 3) {
      const wait = Math.pow(2, retryCount) * 1000;
      await new Promise(resolve => setTimeout(resolve, wait));
      return fetchKlines(symbol, interval, startTime, limit, retryCount + 1);
    }
    throw error;
  }
}
