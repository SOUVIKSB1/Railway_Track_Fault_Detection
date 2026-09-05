import React from 'react';
import { 
  ScanSearch, 
  Layers, 
  History, 
  BarChart3, 
  Activity
} from 'lucide-react';

export default function Header({
  activeTab,
  setActiveTab,
  systemStatus
}) {
  const navTabs = [
    { id: 'single', label: 'Image Diagnostics', shortLabel: 'Diagnostics', icon: ScanSearch },
    { id: 'batch', label: 'Batch Test Bench', shortLabel: 'Batch Test', icon: Layers },
    { id: 'history', label: 'Audit History', shortLabel: 'History', icon: History },
    { id: 'benchmark', label: 'Model Benchmark', shortLabel: 'Benchmark', icon: BarChart3 },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-[#090c15]/95 backdrop-blur-md shadow-lg shadow-black/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="py-3 sm:py-3.5 flex items-center justify-between gap-4">
          {/* Brand Identity */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-800/90 border border-slate-700/80 text-slate-200 shadow-sm flex-shrink-0">
              <ScanSearch className="w-5 h-5 text-emerald-400" />
            </div>

            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-2">
                <span className="font-bold text-base sm:text-lg text-white tracking-tight leading-snug">
                  RailVision <span className="text-emerald-400 font-extrabold">AI</span>
                </span>
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-slate-800/90 text-slate-300 border border-slate-700">
                  LiteRT
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 hidden sm:block leading-tight">
                Railway Track Defect Diagnostic System
              </p>
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden md:flex items-center space-x-1.5 bg-slate-900/90 p-1.5 rounded-xl border border-slate-800">
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all duration-150 whitespace-nowrap min-h-[38px] ${
                    isActive
                      ? 'text-white bg-slate-800 shadow-sm border border-slate-700/80 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Status Badge */}
          <div className="flex items-center gap-2 text-xs font-mono">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-emerald-400 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="hidden sm:inline font-medium">ONLINE • LiteRT Engine</span>
              <span className="sm:hidden font-medium">ONLINE</span>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Scrollbar */}
        <div className="md:hidden pb-3 pt-1 overflow-x-auto scrollbar-none flex items-center gap-2">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 min-h-[40px] ${
                  isActive
                    ? 'text-white bg-slate-800 shadow-sm border border-slate-700 font-semibold'
                    : 'text-slate-400 bg-slate-900/80 border border-slate-800 hover:text-slate-200'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span>{tab.shortLabel || tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
