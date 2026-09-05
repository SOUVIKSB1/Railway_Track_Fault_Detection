import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Header from './components/Header';
import ImageInspector from './components/ImageInspector';
import BatchInspector from './components/BatchInspector';
import AuditHistory from './components/AuditHistory';
import ModelBenchmark from './components/ModelBenchmark';

export default function App() {
  const [activeTab, setActiveTab] = useState('single');
  const [systemStatus, setSystemStatus] = useState(null);

  useEffect(() => {
    fetch('/api/status')
      .then(res => res.json())
      .then(data => setSystemStatus(data))
      .catch(err => console.log('Status check error:', err));
  }, []);

  return (
    <div className="min-h-screen flex flex-col font-sans bg-[#090c15] text-slate-100 antialiased selection:bg-emerald-600 selection:text-white">
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        systemStatus={systemStatus}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full track-bg-pattern pb-12">
        <AnimatePresence mode="wait">
          {activeTab === 'single' && (
            <motion.div
              key="single"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.14 }}
            >
              <ImageInspector />
            </motion.div>
          )}

          {activeTab === 'batch' && (
            <motion.div
              key="batch"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.14 }}
            >
              <BatchInspector />
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.14 }}
            >
              <AuditHistory />
            </motion.div>
          )}

          {activeTab === 'benchmark' && (
            <motion.div
              key="benchmark"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.14 }}
            >
              <ModelBenchmark />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Modern Minimal Footer */}
      <footer className="border-t border-slate-800/80 bg-[#070910] py-5 px-4 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="font-medium text-slate-300">
              RailVision AI • Railway Track Defect Diagnostic System v2.2
            </span>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-slate-400 font-mono">
            <span>EfficientNetV2-B0</span>
            <span>•</span>
            <span>Analytical CAM Explainability</span>
            <span>•</span>
            <span className="text-emerald-400 font-semibold">97.33% Accuracy</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
