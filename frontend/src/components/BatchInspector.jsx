import React, { useState, useRef } from 'react';
import { 
  FolderUp, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Layers, 
  FileSpreadsheet,
  Download,
  Zap
} from 'lucide-react';

export default function BatchInspector() {
  const [files, setFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [batchResult, setBatchResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const fileInputRef = useRef(null);

  const handleFilesSelected = (selectedFiles) => {
    const valid = Array.from(selectedFiles).filter(f => f.type.startsWith('image/')).slice(0, 50);
    if (valid.length === 0) {
      setErrorMsg('Please select valid image files.');
      return;
    }
    setErrorMsg(null);
    setFiles(valid);
    setBatchResult(null);
  };

  const handleRunBatch = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      files.forEach(f => formData.append('files', f));

      const res = await fetch('/api/batch-predict', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) throw new Error('Batch evaluation failed.');
      const data = await res.json();
      setBatchResult(data);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Error executing batch evaluation.');
    } finally {
      setIsProcessing(false);
    }
  };

  const exportCSV = () => {
    if (!batchResult) return;
    const headers = ['Sample ID', 'Filename', 'Classification', 'Confidence (%)', 'Severity', 'Latency (ms)'];
    const rows = batchResult.results.map(r => [
      r.inspection_token,
      r.filename,
      r.prediction_class,
      r.confidence,
      r.safety_assessment?.severity_level || 'NOMINAL',
      r.inference_latency_ms
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `RailVision_Batch_Evaluation_${batchResult.batch_id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Batch Header */}
      <div className="railway-glass-card rounded-2xl p-6 border border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              High-Speed Bulk Test Bench
            </span>
            <h2 className="text-base font-bold text-white mt-1.5 flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-400" />
              Batch Dataset Test Bench
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Upload multiple track images simultaneously (up to 50 images) for high-speed automated evaluation.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept="image/*"
              onChange={(e) => e.target.files && handleFilesSelected(e.target.files)}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition"
            >
              <FolderUp className="w-4 h-4 text-emerald-400" />
              <span>Select Images ({files.length})</span>
            </button>

            {files.length > 0 && (
              <button
                onClick={handleRunBatch}
                disabled={isProcessing}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white text-xs font-semibold transition shadow-sm"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing Batch...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>Run Batch Evaluation</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {errorMsg && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Batch Results Overview */}
      {batchResult && (
        <div className="space-y-6">
          {/* 4 Metric Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="railway-glass-card rounded-xl p-4 border border-slate-800">
              <span className="text-slate-400 text-xs font-mono">Total Images</span>
              <p className="text-xl font-bold text-white mt-1">{batchResult.total_samples}</p>
              <span className="text-[11px] text-slate-500 font-mono">Evaluated</span>
            </div>

            <div className="railway-glass-card rounded-xl p-4 border border-slate-800">
              <span className="text-rose-400 text-xs font-mono">Defective Detected</span>
              <p className="text-xl font-bold text-rose-400 mt-1">{batchResult.defective_count}</p>
              <span className="text-[11px] text-rose-400/80 font-mono">{batchResult.dataset_defect_rate}% Defect Rate</span>
            </div>

            <div className="railway-glass-card rounded-xl p-4 border border-slate-800">
              <span className="text-emerald-400 text-xs font-mono">Healthy Track</span>
              <p className="text-xl font-bold text-emerald-400 mt-1">{batchResult.healthy_count}</p>
              <span className="text-[11px] text-emerald-400/80 font-mono">Nominal Continuous</span>
            </div>

            <div className="railway-glass-card rounded-xl p-4 border border-slate-800">
              <span className="text-slate-300 text-xs font-mono">Average Latency</span>
              <p className="text-xl font-bold text-slate-200 mt-1">{batchResult.average_latency_ms}ms</p>
              <span className="text-[11px] text-emerald-400 font-mono">Total: {batchResult.total_batch_latency_ms}ms</span>
            </div>
          </div>

          {/* Results Table */}
          <div className="railway-glass-card rounded-2xl border border-slate-800 overflow-hidden">
            <div className="p-4 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-semibold text-white">
                Detailed Evaluation Records
              </span>
              <button
                onClick={exportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700"
              >
                <Download className="w-3.5 h-3.5 text-slate-400" />
                <span>Export CSV Report</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">Filename</th>
                    <th className="p-3">Classification</th>
                    <th className="p-3">Severity Level</th>
                    <th className="p-3">Confidence</th>
                    <th className="p-3 text-right">Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {batchResult.results.map((r, idx) => {
                    const isDef = r.is_defective;
                    return (
                      <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-3 font-mono text-slate-500">{idx + 1}</td>
                        <td className="p-3 text-white font-mono truncate max-w-xs">{r.filename}</td>
                        <td className="p-3">
                          <span className={`inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded text-[10px] font-mono ${
                            isDef
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}>
                            {r.prediction_class}
                          </span>
                        </td>
                        <td className="p-3 font-mono">
                          <span className={isDef ? 'text-rose-400' : 'text-emerald-400'}>
                            {r.safety_assessment?.severity_level || 'NOMINAL'}
                          </span>
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-200">{r.confidence}%</td>
                        <td className="p-3 text-right font-mono text-slate-400">{r.inference_latency_ms}ms</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
