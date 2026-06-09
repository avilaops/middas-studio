'use client';

import { useEffect, useState } from 'react';
import { BarChart3, RefreshCw, DollarSign } from 'lucide-react';
import { estimateCost, formatCost } from '@/lib/pricing';

export default function UsageModule() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const r = await fetch(`/api/usage?days=${days}`);
    setData(await r.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, [days]);

  const totals = data?.totals || {};
  const successRate = totals.total_calls
    ? ((totals.success_calls / totals.total_calls) * 100).toFixed(1)
    : '0';

  const maxBar = Math.max(...(data?.timeline?.map((t: any) => +t.calls) || [1]));

  const totalCost = (data?.by_model || []).reduce((sum: number, m: any) =>
    sum + estimateCost(m.model, +m.prompt_tokens || 0, +m.completion_tokens || 0), 0);
  const totalTokens = (data?.by_model || []).reduce((sum: number, m: any) =>
    sum + (+m.total_tokens || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium flex items-center gap-2"><BarChart3 className="w-5 h-5" /> Usage Analytics</h2>
        <div className="flex items-center gap-2">
          <select aria-label="Window" className="input w-32" value={days} onChange={(e) => setDays(+e.target.value)}>
            <option value={1}>Last 24h</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button onClick={load} className="btn-secondary flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Total Calls" value={totals.total_calls || 0} />
        <Stat label="Success" value={totals.success_calls || 0} accent="green" />
        <Stat label="Errors" value={totals.error_calls || 0} accent="red" />
        <Stat label="Success rate" value={`${successRate}%`} />
        <Stat label="Avg latency" value={`${totals.avg_latency_ms || 0}ms`} accent="orange" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Stat label="Total tokens" value={totalTokens.toLocaleString()} />
        <Stat label="Estimated cost" value={formatCost(totalCost)} accent="orange" />
        <Stat label="Active models" value={data?.by_model?.length || 0} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="panel p-4">
          <div className="label">By Module</div>
          <div className="space-y-2 mt-2">
            {data?.by_module?.map((m: any) => (
              <div key={m.module} className="flex items-center justify-between text-sm">
                <span className="badge">{m.module}</span>
                <div className="flex gap-3 text-xs text-gray-500 dark:text-groq-muted">
                  <span>{m.calls} calls</span>
                  <span>{m.avg_ms}ms</span>
                  {m.errors > 0 && <span className="text-red-400">{m.errors} errors</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel p-4">
          <div className="label flex items-center gap-1"><DollarSign className="w-3 h-3" /> Top Models (with cost)</div>
          <div className="space-y-2 mt-2">
            {data?.by_model?.map((m: any) => {
              const cost = estimateCost(m.model, +m.prompt_tokens || 0, +m.completion_tokens || 0);
              return (
                <div key={m.model} className="flex items-center justify-between text-sm border-b border-gray-200 dark:border-groq-border/30 pb-1">
                  <span className="font-mono text-xs truncate" title={m.model}>{m.model}</span>
                  <div className="text-xs text-gray-500 dark:text-groq-muted flex gap-2 shrink-0">
                    <span>{m.calls} calls</span>
                    <span>{(+m.total_tokens || 0).toLocaleString()} tk</span>
                    <span className="text-groq-orange">{formatCost(cost)}</span>
                  </div>
                </div>
              );
            })}
            {!data?.by_model?.length && <div className="text-xs text-gray-500 dark:text-groq-muted">No data</div>}
          </div>
        </div>
      </div>

      <div className="panel p-4">
        <div className="label">Timeline ({data?.timeline?.length || 0} buckets)</div>
        <div className="flex items-end gap-1 h-40 mt-3">
          {data?.timeline?.map((t: any, i: number) => (
            <div key={i} className="flex-1 group relative bg-groq-orange/30 hover:bg-groq-orange transition-colors"
              style={{ height: `${(+t.calls / maxBar) * 100}%`, minHeight: '2px' }}>
              <div className="hidden group-hover:block absolute -top-12 left-1/2 -translate-x-1/2 panel p-2 text-xs whitespace-nowrap z-10">
                {new Date(t.bucket).toLocaleString()}<br />
                {t.calls} calls · {t.avg_ms}ms
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: any; accent?: string }) {
  const color = accent === 'green' ? 'text-green-400' : accent === 'red' ? 'text-red-400' : accent === 'orange' ? 'text-groq-orange' : '';
  return (
    <div className="panel p-4">
      <div className="text-xs text-gray-500 dark:text-groq-muted uppercase">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
    </div>
  );
}
