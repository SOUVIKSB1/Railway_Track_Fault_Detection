import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  UploadCloud, 
  Camera, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  HelpCircle, 
  Download, 
  FileText, 
  Layers, 
  RefreshCw, 
  Zap, 
  Cpu, 
  Eye, 
  ArrowRight,
  Info,
  ShieldAlert,
  XCircle,
  FileWarning,
  Check
} from 'lucide-react';
import { soundFx } from '../utils/soundEffects';
import { generateInspectionPDF } from '../utils/pdfGenerator';

export default function ImageInspector({ onInspectionComplete }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [viewMode, setViewMode] = useState('split'); // 'split', 'wipe', 'overlay', 'original', 'gradcam'
  const [selectedColormap, setSelectedColormap] = useState('turbo'); // 'turbo', 'jet'
  const [wipePos, setWipePos] = useState(50);
  const [sampleFilter, setSampleFilter] = useState('all'); // 'all', 'Defective', 'Moderate', 'Safe'
  const [samples, setSamples] = useState([]);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Fetch benchmark dataset samples
  useEffect(() => {
    fetch('/api/samples')
      .then(res => res.json())
      .then(data => {
        if (data.samples) setSamples(data.samples);
      })
      .catch(err => console.log('Samples load error:', err));
  }, []);

  const handleDragOver = (e) => e.preventDefault();

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelected = (file) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please upload a valid image file (JPEG, PNG, WebP).');
      return;
    }
    setErrorMsg(null);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setResult(null);
    soundFx.playClick();
  };

  const handleAnalyze = async () => {
    if (!selectedFile && !previewUrl) return;
    
    setIsLoading(true);
    setErrorMsg(null);
    soundFx.playScanPing();

    try {
      let response;
      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        response = await fetch('/api/predict', {
          method: 'POST',
          body: formData,
        });
      } else if (previewUrl && previewUrl.startsWith('data:')) {
        response = await fetch('/api/predict-base64', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_base64: previewUrl,
            filename: 'camera_capture.jpg'
          }),
        });
      } else if (previewUrl && previewUrl.startsWith('blob:')) {
        const blobRes = await fetch(previewUrl);
        const blob = await blobRes.blob();
        const file = new File([blob], 'captured_image.jpg', { type: 'image/jpeg' });
        const formData = new FormData();
        formData.append('file', file);
        response = await fetch('/api/predict', {
          method: 'POST',
          body: formData,
        });
      }

      if (!response || !response.ok) {
        throw new Error('Inference request failed. Please check backend server.');
      }

      const data = await response.json();
      setResult(data);

      if (data.is_rejected) {
        soundFx.playWarningTone();
      } else if (data.is_defective) {
        soundFx.playWarningTone();
      } else if (!data.is_uncertain) {
        soundFx.playPassChime();
      }

      if (onInspectionComplete) onInspectionComplete(data);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Error occurred during model inference.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectSample = async (sample) => {
    soundFx.playClick();
    setIsLoading(true);
    setErrorMsg(null);
    setResult(null);

    try {
      const imgRes = await fetch(sample.url);
      const blob = await imgRes.blob();
      const file = new File([blob], sample.filename, { type: blob.type || 'image/jpeg' });
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/predict', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setResult(data);
        if (data.is_rejected) soundFx.playWarningTone();
        else if (data.is_defective) soundFx.playWarningTone();
        else if (!data.is_uncertain) soundFx.playPassChime();
      }
    } catch (err) {
      console.error('Error analyzing sample:', err);
      setErrorMsg('Failed to process sample image.');
    } finally {
      setIsLoading(false);
    }
  };

  const startCamera = async () => {
    try {
      setIsCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) videoRef.current.srcObject = stream;
      soundFx.playClick();
    } catch (err) {
      setErrorMsg('Camera access unavailable or permission denied.');
      setIsCameraActive(false);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setPreviewUrl(dataUrl);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `webcam_${Date.now()}.jpg`, { type: 'image/jpeg' });
        setSelectedFile(file);
      }
    }, 'image/jpeg', 0.92);

    stopCamera();
    soundFx.playScanPing();
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
    }
    setIsCameraActive(false);
  };

  const resetAll = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setResult(null);
    setErrorMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    soundFx.playClick();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Image Acquisition & Dataset Samples (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Main Upload Card */}
          <div className="railway-glass-card rounded-2xl p-5 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-sm tracking-wide text-white flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-blue-400" />
                Image Acquisition
              </h2>
              <span className="text-[11px] font-mono text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
                224x224 RGB Input
              </span>
            </div>

            {/* Hidden Input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => e.target.files && e.target.files[0] && handleFileSelected(e.target.files[0])}
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
            />

            {/* Webcam Live Frame */}
            {isCameraActive ? (
              <div className="relative rounded-2xl overflow-hidden bg-black aspect-video border border-blue-500/50">
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                <canvas ref={canvasRef} className="hidden" />
                <div className="absolute bottom-3 inset-x-0 flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={capturePhoto}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition"
                  >
                    <Camera className="w-4 h-4" />
                    Capture Photo
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* Dropzone or Preview */
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => !previewUrl && fileInputRef.current?.click()}
                className={`group relative rounded-2xl border-2 border-dashed transition duration-200 text-center cursor-pointer overflow-hidden ${
                  previewUrl
                    ? 'border-slate-700 bg-black/40 p-2'
                    : 'border-slate-700 hover:border-blue-500/80 bg-slate-950/40 hover:bg-slate-900/40 p-6'
                }`}
              >
                {previewUrl ? (
                  <div className="relative rounded-xl overflow-hidden aspect-video bg-black flex items-center justify-center">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-full h-full object-contain"
                    />
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-xs font-semibold text-white gap-2"
                    >
                      <RefreshCw className="w-4 h-4 text-blue-400" />
                      Click to Replace Image
                    </div>
                  </div>
                ) : (
                  <div className="py-8 space-y-3">
                    <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-950/60 border border-blue-800/50 flex items-center justify-center text-blue-400 group-hover:scale-110 transition">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Upload Railway Track Image
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Drag & drop file or browse from local filesystem
                      </p>
                    </div>
                    <div className="pt-1">
                      <span className="text-[11px] px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                        Browse Image
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={startCamera}
                disabled={isLoading}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-slate-200 text-xs font-semibold transition"
              >
                <Camera className="w-4 h-4 text-blue-400" />
                <span>Webcam Capture</span>
              </button>

              <button
                type="button"
                onClick={handleAnalyze}
                disabled={isLoading || (!selectedFile && !previewUrl)}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition shadow ${
                  isLoading || (!selectedFile && !previewUrl)
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20'
                }`}
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 fill-current text-white" />
                    <span>Run Diagnostic</span>
                  </>
                )}
              </button>
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* Curated Dataset Benchmark Samples */}
          <div className="railway-glass-card rounded-2xl p-4 border border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Dataset Benchmark Gallery
                </h3>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[10px]">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'Defective', label: 'Defective', color: 'text-rose-400' },
                  { id: 'Moderate', label: 'Moderate', color: 'text-amber-400' },
                  { id: 'Safe', label: 'Safe', color: 'text-emerald-400' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setSampleFilter(tab.id)}
                    className={`px-2 py-0.5 rounded-md font-medium transition ${
                      sampleFilter === tab.id
                        ? 'bg-blue-600 text-white font-bold shadow'
                        : `${tab.color || 'text-slate-400'} hover:text-slate-200`
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Filtered Sample Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[300px] overflow-y-auto pr-1">
              {samples
                .filter((s) => sampleFilter === 'all' || s.category === sampleFilter)
                .map((s) => {
                  const isDef = s.category === 'Defective';
                  const isMod = s.category === 'Moderate';
                  return (
                    <button
                      key={s.id}
                      onClick={() => handleSelectSample(s)}
                      disabled={isLoading}
                      className="group relative aspect-[4/3] rounded-xl overflow-hidden border border-slate-800 hover:border-blue-500 transition text-left bg-black shadow"
                    >
                      <img
                        src={s.url}
                        alt={s.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent"></div>
                      
                      <div className="absolute top-1.5 left-1.5">
                        <span
                          className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shadow ${
                            isDef
                              ? 'bg-rose-600 text-white'
                              : isMod
                              ? 'bg-amber-600 text-white'
                              : 'bg-emerald-600 text-white'
                          }`}
                        >
                          {isDef ? 'DEFECTIVE' : isMod ? 'MODERATE' : 'SAFE'}
                        </span>
                      </div>

                      <div className="absolute bottom-1.5 left-1.5 right-1.5">
                        <span className="text-[10px] text-slate-200 font-medium line-clamp-1 group-hover:text-blue-300 transition">
                          {s.title}
                        </span>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Right Column: Diagnostic Output & Rejection Details (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {result ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5"
            >
              {/* IF REJECTED: Render High-Visibility Out-Of-Domain Rejection & Guidelines Panel */}
              {result.is_rejected ? (
                <div className="space-y-5">
                  {/* Rejection Header Card */}
                  <div className="p-6 rounded-2xl border bg-rose-950/40 border-rose-500/70 shadow-xl shadow-rose-950/40 space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-rose-600 text-white shrink-0 shadow-lg shadow-rose-600/30">
                          <XCircle className="w-7 h-7" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40">
                              REJECTED • OUT-OF-DOMAIN
                            </span>
                            <span className="text-xs text-slate-400 font-mono">
                              {result.inspection_token}
                            </span>
                          </div>
                          <h3 className="text-xl font-display font-bold text-white mt-1.5">
                            Non-Railway Image Detected
                          </h3>
                          <p className="text-xs text-rose-200 mt-1 leading-relaxed max-w-xl">
                            {result.rejection_reason || 'The uploaded image does not match the visual or geometric characteristics of railway tracks or rail infrastructure.'}
                          </p>
                        </div>
                      </div>

                      <div className="text-right bg-black/60 px-4 py-2.5 rounded-xl border border-rose-800/60 shrink-0">
                        <div className="text-[10px] text-slate-400 font-medium">Domain Gate</div>
                        <div className="text-xs font-mono font-bold text-rose-400">
                          REJECTED (0.0%)
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          Latency: {result.inference_latency_ms || 12} ms
                        </div>
                      </div>
                    </div>

                    {/* Semantic Match Score Gauge */}
                    <div className="p-3 bg-black/40 rounded-xl border border-rose-900/50 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                          Track Structural Match Score
                        </span>
                        <span className="font-mono text-rose-400 font-bold">
                          {result.semantic_similarity !== undefined ? `${result.semantic_similarity}%` : '0.0%'} (Threshold: 40.0%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                        <div 
                          className="bg-rose-500 h-full rounded-full transition-all duration-500" 
                          style={{ width: `${Math.min(100, Math.max(2, result.semantic_similarity || 0))}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  {/* Input Image Review & Requirements Panel */}
                  <div className="railway-glass-card rounded-2xl p-6 border border-slate-800 space-y-5">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <h4 className="font-display font-bold text-sm text-white flex items-center gap-2">
                        <FileWarning className="w-4 h-4 text-amber-400" />
                        Image Acquisition Requirements & Standards
                      </h4>
                      <span className="text-[11px] text-slate-400 font-mono">
                        Standard Operating Procedure
                      </span>
                    </div>

                    {/* Side-by-side: Uploaded Image vs Requirements */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                      {/* Uploaded Non-Track Image */}
                      <div className="md:col-span-5 space-y-2">
                        <div className="text-xs font-semibold text-slate-300">
                          Uploaded Input:
                        </div>
                        <div className="relative aspect-video rounded-xl overflow-hidden bg-black border border-rose-800/80">
                          <img
                            src={result.original_image || previewUrl}
                            alt="Rejected Upload"
                            className="w-full h-full object-contain"
                          />
                          <div className="absolute inset-0 bg-rose-950/20 flex items-center justify-center">
                            <span className="bg-rose-600/90 text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded shadow">
                              NON-RAILWAY
                            </span>
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-400 italic">
                          File: {result.filename || 'uploaded_image.jpg'}
                        </p>
                      </div>

                      {/* Requirements Checklist */}
                      <div className="md:col-span-7 space-y-3 text-xs">
                        <div className="text-xs font-semibold text-slate-300">
                          Accepted Input Criteria:
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-start gap-2.5 p-2.5 bg-slate-900/60 rounded-xl border border-slate-800">
                            <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                            <div>
                              <strong className="text-slate-200 block">Railway Track Infrastructure:</strong>
                              <span className="text-slate-400">Photo must show steel rails, sleepers/ties, fishplates, ballast, or track switch assemblies.</span>
                            </div>
                          </div>

                          <div className="flex items-start gap-2.5 p-2.5 bg-slate-900/60 rounded-xl border border-slate-800">
                            <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                            <div>
                              <strong className="text-slate-200 block">Perspective & Clarity:</strong>
                              <span className="text-slate-400">Top-down or linear rail angle with clear focus and good natural or artificial lighting.</span>
                            </div>
                          </div>

                          <div className="flex items-start gap-2.5 p-2.5 bg-rose-950/30 rounded-xl border border-rose-900/40">
                            <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                            <div>
                              <strong className="text-rose-300 block">Prohibited Inputs:</strong>
                              <span className="text-slate-400">Portraits/faces, animals, vehicles, indoor rooms, screenshots, or arbitrary household objects.</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="pt-2 flex flex-wrap items-center gap-3 border-t border-slate-800">
                      <button
                        onClick={() => {
                          resetAll();
                          setTimeout(() => fileInputRef.current?.click(), 100);
                        }}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition shadow"
                      >
                        <UploadCloud className="w-4 h-4" />
                        <span>Upload Authentic Railway Track Image</span>
                      </button>

                      <button
                        onClick={() => {
                          if (samples.length > 0) handleSelectSample(samples[0]);
                        }}
                        className="flex items-center gap-1.5 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold transition text-xs"
                      >
                        <Sparkles className="w-4 h-4 text-blue-400" />
                        <span>Try Sample Track</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* IF VALID TRACK: Render Complete Diagnostic & Grad-CAM Heatmap Views */
                <div className="space-y-5">
                  {/* Status Banner */}
                  <div className={`p-5 rounded-2xl border transition-all ${
                    result.safety_assessment?.status === 'HEALTHY'
                      ? 'bg-emerald-950/20 border-emerald-500/40'
                      : result.safety_assessment?.status === 'UNCERTAIN'
                      ? 'bg-amber-950/20 border-amber-500/40'
                      : 'bg-rose-950/30 border-rose-500/50'
                  }`}>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
                          result.safety_assessment?.status === 'HEALTHY'
                            ? 'bg-emerald-500 text-white'
                            : result.safety_assessment?.status === 'UNCERTAIN'
                            ? 'bg-amber-500 text-white'
                            : 'bg-rose-600 text-white'
                        }`}>
                          {result.safety_assessment?.status === 'HEALTHY' ? (
                            <CheckCircle2 className="w-6 h-6" />
                          ) : result.safety_assessment?.status === 'UNCERTAIN' ? (
                            <HelpCircle className="w-6 h-6" />
                          ) : (
                            <AlertTriangle className="w-6 h-6" />
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase ${
                              result.safety_assessment?.status === 'HEALTHY'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : result.safety_assessment?.status === 'UNCERTAIN'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            }`}>
                              {result.safety_assessment?.severity_level || result.prediction_class}
                            </span>
                            <span className="text-xs text-slate-400 font-mono">
                              {result.inspection_token}
                            </span>
                          </div>

                          <h3 className="text-lg font-display font-bold text-white mt-1">
                            {result.safety_assessment?.badge || result.prediction_class}
                          </h3>
                        </div>
                      </div>

                      <div className="text-right bg-black/40 px-3.5 py-2 rounded-xl border border-slate-800">
                        <div className="text-[10px] text-slate-400 font-medium">Confidence Score</div>
                        <div className="text-2xl font-mono font-bold text-white">
                          {result.confidence}%
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Latency: {result.inference_latency_ms} ms
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Explainable AI Visual Panel (Grad-CAM++) */}
                  <div className="railway-glass-card rounded-2xl p-5 border border-slate-800 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="font-display font-bold text-sm text-white flex items-center gap-2">
                          <Layers className="w-4 h-4 text-blue-400" />
                          Grad-CAM++ Spatial Attention Localization
                        </h3>
                        <p className="text-xs text-slate-400">
                          Higher-order gradient activations on layer <code className="text-blue-300 font-mono text-[11px]">top_conv</code> (7×7×1280)
                        </p>
                      </div>

                      {/* Colormap & Mode Controls */}
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Colormap Selector */}
                        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-[11px]">
                          <button
                            onClick={() => setSelectedColormap('turbo')}
                            className={`px-2 py-0.5 rounded-lg font-medium transition ${
                              selectedColormap === 'turbo'
                                ? 'bg-indigo-600 text-white font-semibold shadow'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            Turbo Spectrum
                          </button>
                          <button
                            onClick={() => setSelectedColormap('jet')}
                            className={`px-2 py-0.5 rounded-lg font-medium transition ${
                              selectedColormap === 'jet'
                                ? 'bg-blue-600 text-white font-semibold shadow'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            Thermal Jet
                          </button>
                        </div>

                        {/* View Mode Switcher */}
                        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
                          {['split', 'wipe', 'overlay', 'original'].map((mode) => (
                            <button
                              key={mode}
                              onClick={() => setViewMode(mode)}
                              className={`px-2.5 py-1 rounded-lg font-medium capitalize transition ${
                                viewMode === mode
                                  ? 'bg-blue-600 text-white font-semibold shadow'
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              {mode}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Viewport */}
                    {(() => {
                      const activeHeatmap = selectedColormap === 'jet' 
                        ? (result.gradcam_jet_image || result.gradcam_image)
                        : (result.gradcam_image || result.gradcam_jet_image);

                      return (
                        <div className="relative rounded-xl overflow-hidden bg-black border border-slate-800">
                          {viewMode === 'split' ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2">
                              <div className="relative rounded-lg overflow-hidden bg-black aspect-square">
                                <img
                                  src={result.original_image}
                                  alt="Input Track"
                                  className="w-full h-full object-cover"
                                />
                                <span className="absolute bottom-2 left-2 bg-black/75 px-2 py-0.5 rounded text-[10px] font-mono text-slate-300">
                                  Optical Input
                                </span>
                              </div>

                              <div className="relative rounded-lg overflow-hidden bg-black aspect-square">
                                {activeHeatmap ? (
                                  <img
                                    src={activeHeatmap}
                                    alt="Grad-CAM Heatmap"
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">
                                    Heatmap unavailable
                                  </div>
                                )}
                                <span className="absolute bottom-2 left-2 bg-black/75 px-2 py-0.5 rounded text-[10px] font-mono text-blue-300">
                                  Grad-CAM++ Attention ({selectedColormap.toUpperCase()})
                                </span>
                              </div>
                            </div>
                          ) : viewMode === 'wipe' ? (
                            <div className="relative aspect-video max-h-[400px] flex items-center justify-center bg-black select-none overflow-hidden group">
                              <img
                                src={result.original_image}
                                alt="Original Track"
                                className="absolute inset-0 w-full h-full object-contain"
                              />
                              <div 
                                className="absolute inset-0 overflow-hidden"
                                style={{ width: `${wipePos}%` }}
                              >
                                <img
                                  src={activeHeatmap || result.original_image}
                                  alt="Grad-CAM Overlay"
                                  className="absolute inset-0 w-full h-full object-contain max-w-none"
                                  style={{ width: '100%' }}
                                />
                              </div>

                              {/* Wipe Divider Line */}
                              <div 
                                className="absolute top-0 bottom-0 w-0.5 bg-blue-400 shadow-lg shadow-blue-500 cursor-ew-resize flex items-center justify-center"
                                style={{ left: `${wipePos}%` }}
                              >
                                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-[9px] font-mono shadow-md border border-white/40">
                                  ↔
                                </div>
                              </div>

                              {/* Wipe Slider Control */}
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={wipePos}
                                onChange={(e) => setWipePos(Number(e.target.value))}
                                className="absolute bottom-3 left-6 right-6 opacity-60 hover:opacity-100 transition cursor-ew-resize accent-blue-500"
                              />

                              <span className="absolute top-2 left-2 bg-black/75 px-2 py-0.5 rounded text-[10px] font-mono text-blue-300">
                                Grad-CAM++ Wipe Comparison
                              </span>
                            </div>
                          ) : viewMode === 'overlay' ? (
                            <div className="relative aspect-video max-h-[380px] flex items-center justify-center bg-black">
                              <img
                                src={activeHeatmap || result.original_image}
                                alt="Grad-CAM Overlay"
                                className="h-full object-contain"
                              />
                              <span className="absolute bottom-2 left-2 bg-black/75 px-2 py-0.5 rounded text-[10px] font-mono text-emerald-300">
                                Grad-CAM++ ({selectedColormap.toUpperCase()})
                              </span>
                            </div>
                          ) : (
                            <div className="relative aspect-video max-h-[380px] flex items-center justify-center bg-black">
                              <img
                                src={result.original_image}
                                alt="Input Track"
                                className="h-full object-contain"
                              />
                              <span className="absolute bottom-2 left-2 bg-black/75 px-2 py-0.5 rounded text-[10px] font-mono text-slate-300">
                                Optical Input
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Assessment & Action Card */}
                  <div className="railway-glass-card rounded-2xl p-5 border border-slate-800 space-y-4 text-xs">
                    <div className="border-b border-slate-800 pb-3">
                      <h3 className="font-display font-bold text-sm text-white">
                        Scientific Assessment & Engineering Directives
                      </h3>
                    </div>

                    <div className="space-y-3">
                      <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                        <span className="text-[10px] font-mono uppercase text-blue-400 font-bold block mb-1">
                          Structural Assessment:
                        </span>
                        <p className="text-slate-300 leading-relaxed">
                          {result.safety_assessment?.scientific_assessment || 'Inference complete.'}
                        </p>
                      </div>

                      <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                        <span className="text-[10px] font-mono uppercase text-blue-400 font-bold block mb-1">
                          Engineering Recommendation:
                        </span>
                        <p className="text-slate-300 leading-relaxed">
                          {result.safety_assessment?.engineering_recommendation || 'Follow standard protocol.'}
                        </p>
                      </div>
                    </div>

                    {/* Export Report Actions */}
                    <div className="pt-2 flex flex-wrap items-center gap-3">
                      <button
                        onClick={() => generateInspectionPDF(result)}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition shadow"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download Technical Report (PDF)</span>
                      </button>

                      <button
                        onClick={() => {
                          const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `RailVision_Diagnostic_${result.inspection_token}.json`;
                          a.click();
                          soundFx.playClick();
                        }}
                        className="flex items-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-semibold transition text-xs"
                      >
                        <FileText className="w-4 h-4 text-blue-400" />
                        <span>Export JSON</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <div className="railway-glass-card rounded-2xl p-10 border border-slate-800 text-center space-y-4 flex flex-col items-center justify-center min-h-[420px]">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-blue-400">
                <Cpu className="w-8 h-8 text-blue-400" />
              </div>
              <div className="max-w-md space-y-1.5">
                <h3 className="text-base font-display font-bold text-white">
                  Awaiting Track Image Input
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Upload an image from your device, capture via webcam, or select a pre-loaded dataset sample on the left to compute real-time structural defect diagnostics and Grad-CAM visual heatmaps.
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-medium text-xs transition"
                >
                  <Eye className="w-4 h-4 text-blue-400" />
                  <span>Browse Test Image</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
