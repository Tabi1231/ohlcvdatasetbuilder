
import { useState, useCallback, useEffect } from 'react';
import { RateLimitState } from '../types';

export function useRateLimiter(initialMaxPerMinute: number = 1200) {
  const [state, setState] = useState<RateLimitState>({
    requestsInWindow: 0,
    maxRequestsPerMinute: initialMaxPerMinute,
    remainingRequests: initialMaxPerMinute,
    safeIntervalMs: Math.ceil(60000 / initialMaxPerMinute),
  });

  // Simple window reset every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setState(prev => ({
        ...prev,
        requestsInWindow: 0,
        remainingRequests: prev.maxRequestsPerMinute
      }));
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const trackRequest = useCallback(() => {
    setState(prev => {
      const nextCount = prev.requestsInWindow + 1;
      return {
        ...prev,
        requestsInWindow: nextCount,
        remainingRequests: Math.max(0, prev.maxRequestsPerMinute - nextCount)
      };
    });
  }, []);

  const updateMaxRequests = useCallback((newMax: number) => {
    setState(prev => ({
      ...prev,
      maxRequestsPerMinute: newMax,
      remainingRequests: newMax - prev.requestsInWindow,
      safeIntervalMs: Math.ceil(60000 / newMax)
    }));
  }, []);

  return { state, trackRequest, updateMaxRequests };
}
