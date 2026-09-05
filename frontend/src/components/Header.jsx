import React from 'react';
import { 
  ScanSearch, 
  Layers, 
  History, 
  BarChart3, 
  ShieldCheck,
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
    <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-[#0b0f19]/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <div className="h-14 sm:h-16 flex items-center justify-between gap-3">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-slate-800 border border-slate-700/60 text-slate-200 shadow-sm">
              <ScanSearch className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-semibold text-sm sm:text-base text-white tracking-tight">
                  RailVision <span className="text-emerald-400 font-bold">AI</span>
                </h1>
                <span className="text-[9px] sm:text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-slate-800/80 text-slate-300 border border-slate-700/60">
                  LiteRT
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 hidden sm:block">
                Railway Track Defect Diagnostic Engine
              </p>
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden md:flex items-center space-x-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 whitespace-nowrap ${
                    isActive
                      ? 'text-white bg-slate-800 shadow-sm border border-slate-700/60 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Status Badge */}
          <div className="flex items-center gap-2 text-xs font-mono">
            <div className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-emerald-400 text-[10px] sm:text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="hidden sm:inline">ONLINE • LiteRT Engine</span>
              <span className="sm:hidden">ONLINE</span>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Bar (Horizontal Scrolling Tabs) */}
        <div className="md:hidden pb-2.5 pt-0.5 overflow-x-auto scrollbar-none flex items-center gap-1.5">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 min-h-[36px] ${
                  isActive
                    ? 'text-white bg-slate-800 shadow-sm border border-slate-700/60 font-semibold'
                    : 'text-slate-400 bg-slate-900/60 border border-slate-800/60 hover:text-slate-200'
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
