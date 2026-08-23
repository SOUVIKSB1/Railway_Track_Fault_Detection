import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  ScanSearch, 
  Layers, 
  History, 
  BarChart3, 
  Volume2, 
  VolumeX, 
  Clock, 
  Cpu, 
  ShieldCheck
} from 'lucide-react';
import { soundFx } from '../utils/soundEffects';

export default function Header({
  activeTab,
  setActiveTab,
  systemStatus
}) {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSoundToggle = () => {
    const newState = soundFx.toggleSound();
    setSoundEnabled(newState);
    if (newState) soundFx.playClick();
  };

  const navTabs = [
    { id: 'single', label: 'Image Diagnostics', icon: ScanSearch, badge: 'Grad-CAM' },
    { id: 'batch', label: 'Batch Test Bench', icon: Layers, badge: 'Evaluation' },
    { id: 'history', label: 'Diagnostic History', icon: History, badge: 'Logs' },
    { id: 'benchmark', label: 'Model Benchmark', icon: BarChart3, badge: '94.74% Acc' },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#090e17]/95 backdrop-blur-md transition-colors duration-300">
      {/* Top Status Bar */}
      <div className="bg-[#060911] px-4 py-1.5 text-xs border-b border-slate-800/60">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-slate-400">
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span className="font-semibold text-slate-200">RAILVISION AI</span>
            <span className="text-slate-600">|</span>
            <span className="text-blue-400">Deep Learning Track Fault Diagnostic Engine</span>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>MODEL ACTIVE (GPU)</span>
            </div>

            <div className="flex items-center gap-1 text-slate-400">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <span>{timeStr}</span>
            </div>

            <button
              onClick={handleSoundToggle}
              title={soundEnabled ? 'Mute Audio' : 'Enable Audio'}
              className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition p-1 rounded hover:bg-slate-800/50"
            >
              {soundEnabled ? (
                <Volume2 className="w-3.5 h-3.5 text-blue-400" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 text-slate-600" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Header Bar */}
      <div className="max-w-7xl mx-auto px-4 py-3.5 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-900 border border-blue-400/30 shadow-md shadow-blue-500/10">
            <ScanSearch className="w-5 h-5 text-white" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-bold text-lg text-white tracking-wide">
                RailVision <span className="text-blue-400">AI</span>
              </h1>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                v2.0 Core
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Automated Railway Structural Defect Detection & Explainable AI Localization
            </p>
          </div>
        </div>

        {/* Quick Specs Pill */}
        <div className="flex items-center gap-2.5">
          <div className="hidden lg:flex items-center gap-3 bg-slate-900/80 px-3.5 py-1.5 rounded-xl border border-slate-800 text-xs font-mono text-slate-300">
            <span>Model: <strong className="text-blue-400">EfficientNetV2-B0</strong></span>
            <span className="text-slate-600">|</span>
            <span>Accuracy: <strong className="text-emerald-400">94.74%</strong></span>
            <span className="text-slate-600">|</span>
            <span>Cutoff: <strong className="text-amber-400">72%</strong></span>
          </div>

          <button
            onClick={() => { soundFx.playClick(); setActiveTab('benchmark'); }}
            className="flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-xl bg-blue-950/70 hover:bg-blue-900/70 border border-blue-700/50 text-blue-300 hover:text-white transition shadow-sm font-medium"
          >
            <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
            <span>Benchmark Metrics</span>
          </button>
        </div>
      </div>

      {/* Modern Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4">
        <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto pb-2 scrollbar-none">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  soundFx.playClick();
                  setActiveTab(tab.id);
                }}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
                  isActive
                    ? 'text-white bg-gradient-to-r from-blue-600 to-indigo-700 shadow-md shadow-blue-900/40 border border-blue-400/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-200' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-medium ${
                    isActive ? 'bg-blue-500/40 text-white border border-blue-400/40' : 'bg-slate-900 text-slate-400 border border-slate-800'
                  }`}>
                    {tab.badge}
                  </span>
                )}
                {isActive && (
                  <motion.div
                    layoutId="activeNavIndicator"
                    className="absolute -bottom-2 left-0 right-0 h-0.5 bg-blue-400 rounded-full"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
