import React from 'react';
import { motion } from 'framer-motion';
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
    { id: 'single', label: 'Image Diagnostics', icon: ScanSearch },
    { id: 'batch', label: 'Batch Inspection', icon: Layers },
    { id: 'history', label: 'Audit History', icon: History },
    { id: 'benchmark', label: 'Model Benchmark', icon: BarChart3 },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#090e17]/95 backdrop-blur-md">
      {/* Main Header Bar */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-400">
            <ScanSearch className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-base text-white tracking-wide">
                RailVision <span className="text-blue-400 font-bold">AI</span>
              </h1>
              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                Track Fault Diagnostic Engine
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none w-full sm:w-auto">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 whitespace-nowrap ${
                  isActive
                    ? 'text-white bg-blue-600 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
