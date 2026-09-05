import React, { useState, useRef, useEffect } from 'react';
import { 
  UploadCloud, 
  Camera, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  Download, 
  RefreshCw, 
  ShieldAlert, 
  XCircle,
  Ban,
  Clock,
  Activity,
  Cpu
} from 'lucide-react';
import { generateInspectionPDF } from '../utils/pdfGenerator';

export default function ImageInspector({ onInspectionComplete }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0.0);
  const [result, setResult] = useState(null);
  const [viewMode, setViewMode] = useState('split'); // 'split', 'overlay', 'original'
  const [selectedColormap, setSelectedColormap] = useState('turbo'); // 'turbo', 'jet'
  const [samples, setSamples] = useState([]);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const timerRef = useRef(null);
  const resultRef = useRef(null);

  // Client-side image compression to prevent large 4K/8K image upload crashes
  const compressImageFile = async (file, maxDimension = 1400, quality = 0.88) => {
    return new Promise((resolve) => {
      if (!file || file.size < 800 * 1024) {
        resolve(file);
        return;
      }
      const img = new Image();
      const reader = new FileReader();
      reader.onload = (e) => {
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressed = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(compressed);
              } else {
                resolve(file);
              }
            },
            'image/jpeg',
            quality
          );
        };
        img.onerror = () => resolve(file);
        img.src = e.target.result;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  };

  useEffect(() => {
    fetch('/api/samples')
      .then(res => res.json())
      .then(data => {
        if (data.samples) setSamples(data.samples);
      })
      .catch(err => console.log('Samples load error:', err));
  }, []);

  // Smooth auto-scroll down to results on mobile/desktop when result is produced
  useEffect(() => {
    if (result && resultRef.current) {
      setTimeout(() => {
        resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    }
  }, [result]);

  // Live timer effect during processing
  useEffect(() => {
    if (isLoading) {
      setElapsedSeconds(0.0);
      const startTime = performance.now();
      timerRef.current = setInterval(() => {
        setElapsedSeconds(((performance.now() - startTime) / 1000).toFixed(1));
      }, 100);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isLoading]);

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
  };

  const handleAnalyze = async () => {
    if (!selectedFile && !previewUrl) return;
    
    setIsLoading(true);
    setErrorMsg(null);

    try {
      let response;
      if (selectedFile) {
        // Automatically optimize/compress large user uploads before sending
        const optimizedFile = await compressImageFile(selectedFile);
        const formData = new FormData();
        formData.append('file', optimizedFile);
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
        const rawFile = new File([blob], 'captured_image.jpg', { type: 'image/jpeg' });
        const optimizedFile = await compressImageFile(rawFile);
        const formData = new FormData();
        formData.append('file', optimizedFile);
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
      if (onInspectionComplete) onInspectionComplete(data);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Error occurred during model inference.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectSample = async (sample) => {
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
      const res = await fetch('/api/predict', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Inference failed for sample.');
      const data = await res.json();
      setResult(data);
      if (onInspectionComplete) onInspectionComplete(data);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Error loading sample image.');
    } finally {
      setIsLoading(false);
    }
  };

  const startCamera = async () => {
    setIsCameraActive(true);
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Camera access denied or unavailable.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setPreviewUrl(dataUrl);
    setSelectedFile(null);
    setResult(null);
    stopCamera();
  };

  const getProcessingPhaseText = (sec) => {
    const s = parseFloat(sec);
    if (s < 0.3) return 'Standardizing input image tensor...';
    if (s < 0.7) return 'Extracting 128-D convolutional feature vectors...';
    if (s < 1.1) return 'Computing Grad-CAM explainability localization...';
    return 'Finalizing safety diagnosis & report...';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
      {/* Top Section: Upload & 3 Curated Benchmark Samples */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Upload / Camera Dropzone */}
        <div className="lg:col-span-7 railway-glass-card rounded-2xl p-5 sm:p-6 border border-slate-800 flex flex-col justify-between space-y-5">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                Input Image
              </h2>
              <div className="flex items-center gap-2">
                {!isCameraActive ? (
                  <button
                    onClick={startCamera}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition min-h-[36px]"
                  >
                    <Camera className="w-3.5 h-3.5 text-slate-400" />
                    <span>Camera</span>
                  </button>
                ) : (
                  <button
                    onClick={stopCamera}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-rose-950/60 border border-rose-800/40 text-rose-300 transition min-h-[36px]"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Upload high-resolution track photograph or capture live camera feed.
            </p>
          </div>

          {/* Camera Feed or Dropzone */}
          {isCameraActive ? (
            <div className="relative rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center border border-slate-700">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
              <canvas ref={canvasRef} className="hidden" />
              <button
                onClick={capturePhoto}
                className="absolute bottom-4 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg transition flex items-center gap-1.5"
              >
                <Camera className="w-4 h-4" />
                <span>Capture Frame</span>
              </button>
            </div>
          ) : (
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => !isLoading && fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-4 sm:p-6 text-center cursor-pointer transition-colors duration-150 flex flex-col items-center justify-center min-h-[220px] sm:min-h-[250px] overflow-hidden ${
                previewUrl ? 'border-slate-700 bg-slate-900/40' : 'border-slate-700/80 hover:border-slate-600 bg-slate-900/20'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => e.target.files && handleFileSelected(e.target.files[0])}
                accept="image/*"
                className="hidden"
              />

              {/* Processing Overlay with Laser Scanner and Live Timer */}
              {isLoading && (
                <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-4 space-y-3">
                  <div className="laser-scan-line"></div>
                  
                  <div className="w-12 h-12 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-center shadow-lg shadow-emerald-900/30">
                    <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
                  </div>

                  <div className="text-center space-y-1">
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-xs font-bold text-white tracking-wide uppercase">
                        Analyzing Track Diagnostics
                      </span>
                      <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/60">
                        {elapsedSeconds}s
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono">
                      {getProcessingPhaseText(elapsedSeconds)}
                    </p>
                  </div>

                  <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-400 rounded-full skeleton-shimmer w-full"></div>
                  </div>
                </div>
              )}

              {previewUrl ? (
                <div className="relative w-full max-h-56 sm:max-h-64 flex items-center justify-center">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="max-h-56 sm:max-h-64 rounded-lg object-contain border border-slate-800 shadow"
                  />
                  {!isLoading && (
                    <span className="absolute bottom-2 right-2 text-[10px] font-mono bg-slate-950/80 px-2 py-0.5 rounded text-slate-300 border border-slate-800">
                      Click to change
                    </span>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="w-12 h-12 rounded-xl bg-slate-800/80 flex items-center justify-center mx-auto text-slate-300 border border-slate-700/50">
                    <UploadCloud className="w-6 h-6 text-slate-400" />
                  </div>
                  <div className="text-xs">
                    <span className="text-emerald-400 font-medium">Click to upload</span> or drag and drop
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-slate-500">Supports JPG, PNG, WebP up to 25MB</p>
                </div>
              )}
            </div>
          )}

          {errorMsg && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
            <span className="text-[11px] text-slate-400 font-mono truncate">
              {selectedFile ? selectedFile.name : (previewUrl ? 'Image Loaded' : 'No image chosen')}
            </span>

            <button
              onClick={handleAnalyze}
              disabled={isLoading || (!selectedFile && !previewUrl)}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-semibold transition shadow-sm flex items-center justify-center gap-2 min-h-[42px]"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Analyzing ({elapsedSeconds}s)...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Run Diagnostics</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right: Exactly 3 Curated Benchmark Samples */}
        <div className="lg:col-span-5 railway-glass-card rounded-2xl p-4 sm:p-5 border border-slate-800 flex flex-col justify-between space-y-3 bg-[#0c101d]/90">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                Benchmark Samples
              </span>
              <span className="text-[10px] font-mono text-emerald-400">3 Curated Tests</span>
            </div>
            <h3 className="text-sm font-semibold text-white mt-1.5">
              Quick Test Verification
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
              Tap any validated benchmark image below for instant AI diagnostic evaluation:
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {samples.map((sample, idx) => {
              const isDef = sample.category === 'Defective';
              const isMod = sample.category === 'Moderate';

              return (
                <button
                  key={sample.id || idx}
                  onClick={() => handleSelectSample(sample)}
                  disabled={isLoading}
                  className="w-full text-left p-2.5 sm:p-3 rounded-xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800/90 hover:border-slate-700 transition-all flex items-center gap-3 group active:scale-[0.99] touch-manipulation"
                >
                  <img
                    src={sample.url}
                    alt={sample.title}
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg object-cover border border-slate-700/70 flex-shrink-0 shadow-sm"
                  />
                  <div className="flex-1 min-w-0 pr-1">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
                        isDef 
                          ? 'bg-rose-950/60 text-rose-300 border-rose-800/60'
                          : (isMod 
                              ? 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                              : 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60')
                      }`}>
                        {isDef ? 'CRITICAL DEFECT' : (isMod ? 'NOMINAL TURNOUT' : 'HEALTHY TRACK')}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 group-hover:text-emerald-400 transition hidden sm:inline">
                        Test →
                      </span>
                    </div>
                    <h4 className="text-xs sm:text-sm font-semibold text-slate-200 truncate group-hover:text-white">
                      {sample.title}
                    </h4>
                    <p className="text-[10px] sm:text-[11px] text-slate-400 truncate mt-0.5">
                      {sample.subtitle || (isDef ? 'Structural Fracture' : (isMod ? 'Rail Switch Joint' : 'Continuous Welded'))}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="p-2.5 sm:p-3 rounded-xl bg-slate-900/40 border border-slate-800/60 text-[10px] sm:text-[11px] text-slate-400 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0"></span>
            <span><span className="font-semibold text-slate-300">LiteRT Engine:</span> Real-world tracks, joints, wheels, and fasteners supported.</span>
          </div>
        </div>
      </div>

      {/* Results View */}
      {result && (
        <div ref={resultRef} className="railway-glass-card rounded-2xl p-5 sm:p-6 border border-slate-800 space-y-6">
          {/* Header Status Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl border ${
                result.is_rejected 
                  ? 'bg-rose-950/40 border-rose-800/50 text-rose-400'
                  : (result.is_defective 
                      ? 'bg-rose-950/40 border-rose-800/50 text-rose-400' 
                      : (result.is_uncertain 
                          ? 'bg-amber-950/40 border-amber-800/50 text-amber-400' 
                          : 'bg-emerald-950/40 border-emerald-800/50 text-emerald-400'))
              }`}>
                {result.is_rejected ? (
                  <Ban className="w-5 h-5" />
                ) : (result.is_defective ? (
                  <ShieldAlert className="w-5 h-5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                ))}
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    {result.safety_assessment?.badge || result.prediction_class}
                  </h3>
                  {!result.is_rejected && (
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {result.confidence}% Confidence
                    </span>
                  )}
                </div>
                <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                  Sample ID: <span className="font-mono text-slate-300">{result.inspection_token}</span> • Latency: <span className="font-mono text-emerald-400">{result.inference_latency_ms}ms</span>
                </p>
              </div>
            </div>

            {!result.is_rejected && (
              <button
                onClick={() => generateInspectionPDF(result)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700 w-full sm:w-auto justify-center min-h-[38px]"
              >
                <Download className="w-3.5 h-3.5 text-slate-400" />
                <span>Export PDF Report</span>
              </button>
            )}
          </div>

          {/* If Image is Rejected (Non-Railway Image) */}
          {result.is_rejected ? (
            <div className="p-5 sm:p-6 rounded-xl bg-rose-950/20 border border-rose-800/40 space-y-4">
              <div className="flex items-start gap-3">
                <Ban className="w-6 h-6 text-rose-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-rose-300">
                    Non-Railway Image Rejected
                  </h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    {result.rejection_reason || result.safety_assessment?.scientific_assessment}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-rose-900/30">
                <div className="space-y-1">
                  <span className="text-[11px] font-mono text-slate-400 block">SEMANTIC TRACK SIMILARITY</span>
                  <div className="text-lg font-mono font-bold text-rose-400">
                    {result.semantic_similarity}% <span className="text-xs text-slate-500 font-normal">(Required &ge; 32.0%)</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] font-mono text-slate-400 block">RECOMMENDATION</span>
                  <p className="text-xs text-slate-300">
                    {result.safety_assessment?.engineering_recommendation}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Diagnostic Display Area for Authentic Track Images */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Visualizer */}
              <div className="lg:col-span-7 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
                    {[
                      { id: 'split', label: 'Side by Side' },
                      { id: 'overlay', label: 'Grad-CAM' },
                      { id: 'original', label: 'Original' },
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        onClick={() => setViewMode(mode.id)}
                        className={`px-3 py-1 rounded font-medium transition ${
                          viewMode === mode.id
                            ? 'bg-slate-800 text-white font-semibold'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>

                  {result.gradcam_image && (
                    <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
                      <button
                        onClick={() => setSelectedColormap('turbo')}
                        className={`px-2.5 py-1 rounded text-[11px] font-mono transition ${
                          selectedColormap === 'turbo' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400'
                        }`}
                      >
                        Turbo
                      </button>
                      <button
                        onClick={() => setSelectedColormap('jet')}
                        className={`px-2.5 py-1 rounded text-[11px] font-mono transition ${
                          selectedColormap === 'jet' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400'
                        }`}
                      >
                        Jet
                      </button>
                    </div>
                  )}
                </div>

                {/* Display Canvas */}
                <div className="rounded-xl overflow-hidden bg-slate-950 border border-slate-800 p-2 flex items-center justify-center min-h-[260px] sm:min-h-[300px]">
                  {viewMode === 'split' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
                      <div className="relative aspect-square bg-black rounded-lg overflow-hidden border border-slate-800">
                        <img
                          src={result.original_image}
                          alt="Original"
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute bottom-2 left-2 text-[10px] font-mono bg-slate-950/80 px-2 py-0.5 rounded text-slate-300 border border-slate-800">
                          Input Track
                        </span>
                      </div>
                      <div className="relative aspect-square bg-black rounded-lg overflow-hidden border border-slate-800">
                        <img
                          src={selectedColormap === 'turbo' ? result.gradcam_image : (result.gradcam_jet_image || result.gradcam_image)}
                          alt="GradCAM Overlay"
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute bottom-2 left-2 text-[10px] font-mono bg-slate-950/80 px-2 py-0.5 rounded text-slate-300 border border-slate-800">
                          Grad-CAM Heatmap
                        </span>
                      </div>
                    </div>
                  )}

                  {viewMode === 'overlay' && (
                    <div className="relative aspect-video max-h-80 w-full bg-black rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center">
                      <img
                        src={selectedColormap === 'turbo' ? result.gradcam_image : (result.gradcam_jet_image || result.gradcam_image)}
                        alt="GradCAM Overlay"
                        className="max-h-80 w-full object-contain"
                      />
                    </div>
                  )}

                  {viewMode === 'original' && (
                    <div className="relative aspect-video max-h-80 w-full bg-black rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center">
                      <img
                        src={result.original_image}
                        alt="Original"
                        className="max-h-80 w-full object-contain"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Diagnostic Details & Engineering Advice */}
              <div className="lg:col-span-5 space-y-4">
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
                  <h4 className="text-xs font-mono font-semibold text-slate-300 uppercase tracking-wide">
                    Safety Assessment
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {result.safety_assessment?.scientific_assessment}
                  </p>
                  <div className="pt-2.5 border-t border-slate-800/80">
                    <span className="text-[11px] font-semibold text-slate-400 block mb-1">
                      Engineering Recommendation:
                    </span>
                    <p className="text-xs text-slate-300">
                      {result.safety_assessment?.engineering_recommendation}
                    </p>
                  </div>
                </div>

                {/* Confidence Breakdown */}
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                  <h4 className="text-xs font-mono font-semibold text-slate-300 uppercase tracking-wide">
                    Model Confidence
                  </h4>
                  
                  <div className="space-y-2.5">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-rose-400 font-medium">Defective Track Probability</span>
                        <span className="font-mono text-slate-200">{result.confidence_scores?.Defective || 0}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-rose-500 rounded-full transition-all duration-300"
                          style={{ width: `${result.confidence_scores?.Defective || 0}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-emerald-400 font-medium">Healthy Rail Probability</span>
                        <span className="font-mono text-slate-200">{result.confidence_scores?.Non_Defective || 0}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                          style={{ width: `${result.confidence_scores?.Non_Defective || 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
