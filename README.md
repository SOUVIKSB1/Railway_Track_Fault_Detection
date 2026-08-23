# Railway_Track_Fault_Detection

├── backend/
│   ├── app.py                     # FastAPI REST API + Grad-CAM + SPA Server
│   ├── inspection_history.json    # Diagnostic logs
│   └── requirements.txt           # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.jsx         # Sleek modern navigation
│   │   │   ├── ImageInspector.jsx # Image acquisition & Grad-CAM viewer
│   │   │   ├── BatchInspector.jsx # Batch test bench & CSV exporter
│   │   │   ├── ModelBenchmark.jsx # Interactive benchmark & analytics
│   │   │   └── AuditHistory.jsx   # Diagnostic history & PDF export
│   │   ├── utils/
│   │   │   ├── pdfGenerator.js    # Clean technical diagnostic PDF report
│   │   │   └── soundEffects.js    # Subtle Web Audio feedback
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
├── RAILWAY_DEFECT/
│   ├── railway_model.keras        # EfficientNetV2-B0 model
│   ├── model_metadata.json        # Threshold & metadata
│   └── results/                   # Real training curves & metrics
├── run_app.sh                     # Unified single-command launcher
└── start_dev.sh                   # Live dev server with hot-reload
