import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  CollectionConfig, 
  Candle, 
  LogEntry, 
  CollectionStats, 
  Timeframe 
} from './types';
import { SYMBOLS, TIMEFRAMES, BINANCE_LIMIT, TIMEFRAME_TO_MS } from './constants';
import { fetchKlines } from './services/binanceService';
import { useRateLimiter } from './hooks/useRateLimiter';
import RateLimitPanel from './components/RateLimitPanel';

const App: React.FC = () => {
  const [config, setConfig] = useState<CollectionConfig>({
    symbol: 'BTCUSDT',
    timeframe: '1h',
    startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    delayMs: 100,
  });

  const [isCollecting, setIsCollecting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [dataset, setDataset] = useState<Candle[]>([]);
  const [stats, setStats] = useState<CollectionStats | null>(null);

  const { state: rateLimit, trackRequest, updateMaxRequests } = useRateLimiter(1200);
  
  const datasetRef = useRef<Candle[]>([]);
  const isPausedRef = useRef(false);

  const addLog = (message: string, level: LogEntry['level'] = 'info') => {
    const newLog: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      level,
      message,
    };
    setLogs(prev => [newLog, ...prev].slice(0, 100));
  };

  const calculateEstimation = () => {
    const start = new Date(config.startDate).getTime();
    const end = new Date(config.endDate).getTime();
    const totalDuration = Math.max(0, end - start);
    const interval = TIMEFRAME_TO_MS[config.timeframe];
    const totalCandles = Math.floor(totalDuration / interval);
    const totalRequests = Math.ceil(totalCandles / BINANCE_LIMIT);
    
    const effectiveDelay = Math.max(config.delayMs, rateLimit.safeIntervalMs);
    const estTimeMs = totalRequests * effectiveDelay;
    const estMinutes = Math.floor(estTimeMs / 60000);
    const estSeconds = Math.floor((estTimeMs % 60000) / 1000);

    return { totalCandles, totalRequests, estMinutes, estSeconds };
  };

  const est = calculateEstimation();

  const handleStart = async () => {
    setIsCollecting(true);
    setIsPaused(false);
    isPausedRef.current = false;
    datasetRef.current = [];
    setDataset([]);
    
    const startTime = new Date(config.startDate).getTime();
    const endTime = new Date(config.endDate).getTime();
    
    setStats({
      totalRequests: est.totalRequests,
      completedRequests: 0,
      totalCandles: 0,
      startTime: Date.now(),
      lastCandleTimestamp: null,
    });

    addLog(`Starting collection for ${config.symbol} (${config.timeframe})`, 'success');
    
    let currentStartTime = startTime;
    let requestsDone = 0;

    try {
      while (currentStartTime < endTime) {
        if (!isCollecting && requestsDone > 0) break; 
        
        while (isPausedRef.current) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        const throttledDelay = Math.max(config.delayMs, rateLimit.safeIntervalMs);
        await new Promise(resolve => setTimeout(resolve, throttledDelay));

        trackRequest();
        const batch = await fetchKlines(config.symbol, config.timeframe, currentStartTime, BINANCE_LIMIT);
        
        if (batch.length === 0) break;

        const filteredBatch = batch.filter(c => c.timestamp <= endTime);
        const lastTs = datasetRef.current.length > 0 ? datasetRef.current[datasetRef.current.length - 1].timestamp : -1;
        const newCandles = filteredBatch.filter(c => c.timestamp > lastTs);

        datasetRef.current = [...datasetRef.current, ...newCandles];
        requestsDone++;

        setStats(prev => prev ? ({
          ...prev,
          completedRequests: requestsDone,
          totalCandles: datasetRef.current.length,
          lastCandleTimestamp: datasetRef.current[datasetRef.current.length - 1].timestamp
        }) : null);

        if (requestsDone % 5 === 0 || filteredBatch.length < BINANCE_LIMIT) {
            setDataset([...datasetRef.current]);
            addLog(`Fetched ${datasetRef.current.length} candles...`);
        }

        currentStartTime = batch[batch.length - 1].timestamp + TIMEFRAME_TO_MS[config.timeframe];
        if (filteredBatch.length < BINANCE_LIMIT) break;
      }

      addLog(`Collection completed. Total candles: ${datasetRef.current.length}`, 'success');
      setDataset([...datasetRef.current]);
    } catch (err: any) {
      addLog(`Error during collection: ${err.message}`, 'error');
    } finally {
      setIsCollecting(false);
    }
  };

  const handleStop = () => {
    setIsCollecting(false);
    setIsPaused(false);
    isPausedRef.current = false;
    addLog('Collection stopped by user.', 'warn');
  };

  const togglePause = () => {
    const newState = !isPaused;
    setIsPaused(newState);
    isPausedRef.current = newState;
    addLog(newState ? 'Collection paused.' : 'Collection resumed.', 'info');
  };

  const downloadCSV = () => {
    if (dataset.length === 0) return;
    const headers = ['date', 'time', 'open', 'high', 'low', 'close', 'volume'];
    const rows = dataset.map(c => {
      const dt = new Date(c.timestamp);
      const dateStr = dt.toISOString().split('T')[0];
      const timeStr = dt.toISOString().split('T')[1].substring(0, 5);
      return [dateStr, timeStr, c.open, c.high, c.low, c.close, c.volume].join(',');
    });
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${config.symbol}_${config.timeframe}_dataset.csv`;
    link.click();
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
          Historical Crypto Data Platform
        </h1>
        <p className="text-slate-400 text-sm mt-1 italic">World-class sequential OHLCV dataset extractor for ML Research</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-6">
          <section className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-xl">
            <h2 className="text-lg font-semibold mb-6 border-b border-slate-800 pb-2">Configuration</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1 uppercase">Trading Pair</label>
                <select 
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={config.symbol}
                  onChange={(e) => setConfig(prev => ({ ...prev, symbol: e.target.value }))}
                  disabled={isCollecting}
                >
                  {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1 uppercase">Timeframe</label>
                <select 
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={config.timeframe}
                  onChange={(e) => setConfig(prev => ({ ...prev, timeframe: e.target.value as Timeframe }))}
                  disabled={isCollecting}
                >
                  {TIMEFRAMES.map(tf => <option key={tf.value} value={tf.value}>{tf.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1 uppercase">Start Date</label>
                  <input 
                    type="date" 
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-slate-200"
                    value={config.startDate}
                    onChange={(e) => setConfig(prev => ({ ...prev, startDate: e.target.value }))}
                    disabled={isCollecting}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1 uppercase">End Date</label>
                  <input 
                    type="date" 
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-slate-200"
                    value={config.endDate}
                    onChange={(e) => setConfig(prev => ({ ...prev, endDate: e.target.value }))}
                    disabled={isCollecting}
                  />
                </div>
              </div>
              <div className="pt-4 space-y-3">
                {!isCollecting ? (
                  <button onClick={handleStart} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors shadow-lg shadow-blue-900/20">
                    Start Collection
                  </button>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={togglePause} className="py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg">
                      {isPaused ? 'Resume' : 'Pause'}
                    </button>
                    <button onClick={handleStop} className="py-2.5 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg">
                      Cancel
                    </button>
                  </div>
                )}
                {dataset.length > 0 && !isCollecting && (
                  <button onClick={downloadCSV} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2">
                    Download CSV ({dataset.length} rows)
                  </button>
                )}
              </div>
            </div>
            <div className="mt-6 p-3 bg-slate-950/50 border border-slate-800 rounded-lg">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-slate-500">Estimated Requests:</span>
                <span className="text-xs font-mono text-blue-400">{est.totalRequests}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500">Estimated Time:</span>
                <span className="text-xs font-mono text-blue-400">~{est.estMinutes}m {est.estSeconds}s</span>
              </div>
            </div>
          </section>
          <RateLimitPanel state={rateLimit} onMaxChange={updateMaxRequests} />
        </div>
        <div className="lg:col-span-2 space-y-6 flex flex-col h-full">
          <section className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-xl">
             <div className="flex justify-between items-end mb-4">
                <div>
                  <h2 className="text-lg font-semibold">Active Session</h2>
                  <p className="text-sm text-slate-500">{stats ? `${config.symbol} ${config.timeframe}` : 'No active session'}</p>
                </div>
                {stats && (
                  <div className="text-right">
                    <span className="text-2xl font-mono font-bold text-blue-400">
                      {stats.totalRequests > 0 ? Math.round((stats.completedRequests / stats.totalRequests) * 100) : 0}%
                    </span>
                  </div>
                )}
             </div>
             <div className="h-3 bg-slate-800 rounded-full overflow-hidden mb-6">
                <div 
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${stats && stats.totalRequests > 0 ? (stats.completedRequests / stats.totalRequests) * 100 : 0}%` }}
                />
             </div>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
               <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                 <p className="text-[10px] text-slate-500 uppercase">Requests</p>
                 <p className="text-lg font-mono">{stats?.completedRequests || 0} / {stats?.totalRequests || 0}</p>
               </div>
               <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                 <p className="text-[10px] text-slate-500 uppercase">Candles Collected</p>
                 <p className="text-lg font-mono">{stats?.totalCandles?.toLocaleString() || 0}</p>
               </div>
               <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg md:col-span-2">
                 <p className="text-[10px] text-slate-500 uppercase">Current Marker</p>
                 <p className="text-xs font-mono truncate">
                   {stats?.lastCandleTimestamp ? new Date(stats.lastCandleTimestamp).toLocaleString() : '---'}
                 </p>
               </div>
             </div>
          </section>
          <section className="bg-slate-900 border border-slate-800 flex-1 rounded-xl shadow-xl flex flex-col min-h-[400px]">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 rounded-t-xl">
              <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400">Operation Logs</h3>
              <button onClick={() => setLogs([])} className="text-[10px] text-slate-500 hover:text-slate-300 uppercase underline">
                Clear Console
              </button>
            </div>
            <div className="p-2 overflow-y-auto flex-1 font-mono text-xs space-y-1 bg-slate-950/40">
              {logs.length === 0 && (
                <div className="h-full flex items-center justify-center text-slate-700 italic">
                  Waiting for input...
                </div>
              )}
              {logs.map(log => (
                <div key={log.id} className="flex gap-3 py-1 px-2 hover:bg-slate-800/30 rounded border-l-2 border-transparent">
                  <span className="text-slate-600 flex-shrink-0">[{log.timestamp.toLocaleTimeString()}]</span>
                  <span className={`flex-1 ${log.level === 'error' ? 'text-red-400' : ''} ${log.level === 'warn' ? 'text-amber-400' : ''} ${log.level === 'success' ? 'text-emerald-400' : ''} ${log.level === 'info' ? 'text-blue-300' : ''}`}>
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default App;
