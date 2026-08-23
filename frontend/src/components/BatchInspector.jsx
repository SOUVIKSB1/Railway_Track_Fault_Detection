import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  FolderUp, 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle, 
  RefreshCw, 
  Layers, 
  FileSpreadsheet,
  BarChart3
} from 'lucide-react';
import { soundFx } from '../utils/soundEffects';

export default function BatchInspector() {
  const [files, setFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [batchResult, setBatchResult] = useState(null);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState(null);
  const fileInputRef = useRef(null);

  const handleFilesSelected = (selectedFiles) => {
    const valid = Array.from(selectedFiles).filter(f => f.type.startsWith('image/')).slice(0, 30);
    if (valid.length === 0) {
      setErrorMsg('Please select valid image files.');
      return;
    }
    setErrorMsg(null);
    setFiles(valid);
    setBatchResult(null);
    soundFx.playClick();
  };

  const handleRunBatch = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    setErrorMsg(null);
    setProgress(20);
    soundFx.playScanPing();

    try {
      const formData = new FormData();
      files.forEach(f => formData.append('files', f));

      setProgress(50);
      const res = await fetch('/api/batch-predict', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) throw new Error('Batch evaluation failed.');
      const data = await res.json();
      setProgress(100);
      setBatchResult(data);
      soundFx.playPassChime();
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Error executing batch evaluation.');
    } finally {
      setIsProcessing(false);
    }
  };

  const exportCSV = () => {
    if (!batchResult) return;
    soundFx.playClick();
    const headers = ['Sample ID', 'Filename', 'Classification', 'Confidence (%)', 'Severity', 'Latency (ms)'];
    const rows = batchResult.results.map(r => [
      r.inspection_token,
      r.filename,
      r.prediction_class,
      r.confidence,
      r.safety_assessment.severity_level,
      r.inference_latency_ms
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `IITR_Batch_Evaluation_${batchResult.batch_id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Batch Header */}
      <div className="railway-glass-card rounded-2xl p-6 border border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-mono font-bold bg-blue-950 text-blue-300 px-2 py-0.5 rounded border border-blue-800 uppercase">
              Quantitative Model Evaluation
            </span>
            <h2 className="font-display font-bold text-lg text-white mt-1 flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-400" />
              Batch Dataset Test Bench
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Upload multiple track test images simultaneously (up to 30 images) to compute dataset-wide classification metrics, defect distribution, and inference latency statistics.
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
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold transition"
            >
              <FolderUp className="w-4 h-4 text-blue-400" />
              <span>Select Images ({files.length}/30)</span>
            </button>

            <button
              onClick={handleRunBatch}
              disabled={isProcessing || files.length === 0}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition shadow ${
                isProcessing || files.length === 0
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20'
              }`}
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                  <span>Evaluating ({progress}%)...</span>
                </>
              ) : (
                <>
                  <BarChart3 className="w-3.5 h-3.5 text-white" />
                  <span>Run Batch Evaluation</span>
                </>
              )}
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Summary Metrics */}
      {batchResult && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="railway-glass-card rounded-2xl p-4 border border-slate-800 text-center">
              <span className="text-xs text-slate-400 font-medium">Total Samples Evaluated</span>
              <div className="text-2xl font-mono font-bold text-white mt-1">
                {batchResult.total_samples}
              </div>
            </div>

            <div className="railway-glass-card rounded-2xl p-4 border border-emerald-800/40 text-center bg-emerald-950/20">
              <span className="text-xs text-emerald-400 font-medium flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Healthy Rails
              </span>
              <div className="text-2xl font-mono font-bold text-emerald-300 mt-1">
                {batchResult.healthy_count}
              </div>
            </div>

            <div className="railway-glass-card rounded-2xl p-4 border border-rose-800/40 text-center bg-rose-950/20">
              <span className="text-xs text-rose-400 font-medium flex items-center justify-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Defects Detected
              </span>
              <div className="text-2xl font-mono font-bold text-rose-400 mt-1">
                {batchResult.defective_count}
              </div>
            </div>

            <div className="railway-glass-card rounded-2xl p-4 border border-slate-800 text-center">
              <span className="text-xs text-slate-400 font-medium">Average Latency</span>
              <div className="text-2xl font-mono font-bold text-blue-400 mt-1">
                {batchResult.average_latency_ms} ms
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-sm text-white">
              Evaluation Log Records ({batchResult.results.length} samples)
            </h3>

            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold transition"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Export CSV Benchmark</span>
            </button>
          </div>

          <div className="railway-glass-card rounded-2xl border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#0b1222] text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
                  <tr>
                    <th className="p-3.5">#</th>
                    <th className="p-3.5">Filename</th>
                    <th className="p-3.5">Classification</th>
                    <th className="p-3.5">Confidence</th>
                    <th className="p-3.5">Severity</th>
                    <th className="p-3.5">Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {batchResult.results.map((r, i) => {
                    const isDef = r.is_defective;
                    const isUnc = r.is_uncertain;
                    return (
                      <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-3.5 font-mono text-slate-500">{i + 1}</td>
                        <td className="p-3.5 font-mono font-semibold text-white truncate max-w-xs">{r.filename}</td>
                        <td className="p-3.5">
                          <span className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full text-[10px] font-mono ${
                            isUnc
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : isDef
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          }`}>
                            {r.prediction_class}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono font-bold text-slate-200">
                          {r.confidence}%
                        </td>
                        <td className="p-3.5 font-mono text-slate-300">
                          {r.safety_assessment.severity_level}
                        </td>
                        <td className="p-3.5 font-mono text-slate-400">
                          {r.inference_latency_ms} ms
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
