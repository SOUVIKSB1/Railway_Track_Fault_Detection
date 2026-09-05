import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Download, 
  Trash2, 
  RefreshCw, 
  History,
  Clock,
  ShieldAlert,
  CheckCircle2
} from 'lucide-react';
import { generateInspectionPDF } from '../utils/pdfGenerator';

function formatAuditTimestamp(isoString) {
  if (!isoString) return 'Just now';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  } catch {
    return isoString;
  }
}

export default function AuditHistory() {
  const [history, setHistory] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [isLoading, setIsLoading] = useState(false);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/history');
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleClearHistory = async () => {
    if (!window.confirm('Clear all stored diagnostic audit logs?')) return;
    try {
      await fetch('/api/history', { method: 'DELETE' });
      setHistory([]);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredHistory = history.filter((item) => {
    const matchesSearch = 
      (item.inspection_token || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.filename || '').toLowerCase().includes(searchTerm.toLowerCase());

    if (filterStatus === 'ALL') return matchesSearch;
    if (filterStatus === 'DEFECTIVE') return matchesSearch && item.status === 'DEFECTIVE';
    if (filterStatus === 'HEALTHY') return matchesSearch && item.status === 'HEALTHY';
    return matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="railway-glass-card rounded-2xl p-6 border border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              Audit Logs & Records
            </span>
            <h2 className="text-base font-bold text-white mt-1.5 flex items-center gap-2">
              <History className="w-5 h-5 text-emerald-400" />
              Diagnostic Audit Trail
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Historical record of evaluated railway track samples with accurate local inspection timestamps and technical report downloads.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchHistory}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            {history.length > 0 && (
              <button
                onClick={handleClearHistory}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 text-rose-300 text-xs font-semibold transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Logs</span>
              </button>
            )}
          </div>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Sample ID or Filename..."
              className="w-full pl-9 pr-4 py-2 bg-slate-900 text-white text-xs rounded-xl border border-slate-700 focus:outline-none focus:border-slate-500 placeholder:text-slate-500"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
            {['ALL', 'HEALTHY', 'DEFECTIVE'].map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                  filterStatus === st
                    ? 'bg-slate-800 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="railway-glass-card rounded-2xl border border-slate-800 overflow-hidden">
        {filteredHistory.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs space-y-2">
            <Clock className="w-8 h-8 mx-auto opacity-40 text-slate-400" />
            <p className="text-slate-300 font-semibold">No diagnostic logs recorded yet</p>
            <p className="text-slate-500">Run an image inspection to automatically log experiment results.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Sample ID</th>
                  <th className="p-3.5">Inspection Time</th>
                  <th className="p-3.5">Filename</th>
                  <th className="p-3.5">Classification</th>
                  <th className="p-3.5">Severity</th>
                  <th className="p-3.5">Confidence</th>
                  <th className="p-3.5 text-right">Report</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredHistory.map((item, idx) => {
                  const isDef = item.status === 'DEFECTIVE';
                  return (
                    <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-3.5 font-mono font-bold text-slate-200">
                        {item.inspection_token}
                      </td>
                      <td className="p-3.5 text-slate-300 font-mono text-[11px] whitespace-nowrap">
                        {formatAuditTimestamp(item.timestamp)}
                      </td>
                      <td className="p-3.5 text-white font-mono truncate max-w-xs">
                        {item.filename}
                      </td>
                      <td className="p-3.5">
                        <span className={`inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded text-[10px] font-mono ${
                          isDef
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono">
                        <span className={isDef ? 'text-rose-400' : 'text-emerald-400'}>
                          {item.severity_level}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono font-bold text-slate-200">
                        {item.confidence}%
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => generateInspectionPDF(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs transition"
                          title="Download Technical Report (PDF)"
                        >
                          <Download className="w-3.5 h-3.5 text-slate-400" />
                          <span>PDF</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
