
import React from 'react';
import { RateLimitState } from '../types';

interface Props {
  state: RateLimitState;
  onMaxChange: (val: number) => void;
}

const RateLimitPanel: React.FC<Props> = ({ state, onMaxChange }) => {
  const usagePercent = (state.requestsInWindow / state.maxRequestsPerMinute) * 100;
  
  return (
    <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-xl">
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
        Rate Limit Engine
      </h3>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
          <p className="text-xs text-slate-500 mb-1">Window Usage</p>
          <p className="text-xl font-mono font-bold">{state.requestsInWindow} / {state.maxRequestsPerMinute}</p>
        </div>
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
          <p className="text-xs text-slate-500 mb-1">Safe Interval</p>
          <p className="text-xl font-mono font-bold">{state.safeIntervalMs}ms</p>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-slate-500">Resource Availability</span>
          <span className={state.remainingRequests < 100 ? "text-red-400" : "text-green-400"}>
            {state.remainingRequests} requests left
          </span>
        </div>
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-500 ${usagePercent > 80 ? 'bg-red-500' : 'bg-blue-500'}`}
            style={{ width: `${Math.min(100, usagePercent)}%` }}
          />
        </div>
      </div>

      <div className="pt-4 border-t border-slate-800">
        <label className="block text-xs font-medium text-slate-400 mb-2">Max Requests / Minute</label>
        <input 
          type="range" 
          min="60" 
          max="2400" 
          step="60"
          value={state.maxRequestsPerMinute}
          onChange={(e) => onMaxChange(parseInt(e.target.value))}
          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
        <div className="flex justify-between text-[10px] text-slate-500 mt-1">
          <span>Safe (60)</span>
          <span>Aggressive (2400)</span>
        </div>
      </div>
    </div>
  );
};

export default RateLimitPanel;
