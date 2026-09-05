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
    { id: 'single', label: 'Image Diagnostics', icon: ScanSearch },
    { id: 'batch', label: 'Batch Test Bench', icon: Layers },
    { id: 'history', label: 'Audit History', icon: History },
    { id: 'benchmark', label: 'Model Benchmark', icon: BarChart3 },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-[#0b0f19]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-slate-800 border border-slate-700/60 text-slate-200 shadow-sm">
            <ScanSearch className="w-5 h-5 text-emerald-400" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-base text-white tracking-tight">
                RailVision <span className="text-emerald-400 font-bold">AI</span>
              </h1>
              <span className="hidden sm:inline-block text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-slate-700/60">
                v2.2
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Railway Track Defect Diagnostic Engine
            </p>
          </div>
        </div>

        {/* Center Navigation Tabs */}
        <nav className="flex items-center space-x-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
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

        {/* Right Status Badge */}
        <div className="hidden md:flex items-center gap-2 text-xs font-mono">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-emerald-400 text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>ONLINE • LiteRT Engine</span>
          </div>
        </div>
      </div>
    </header>
  );
}
