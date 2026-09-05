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
  ArrowRight
} from 'lucide-react';
import { generateInspectionPDF } from '../utils/pdfGenerator';

export default function ImageInspector({ onInspectionComplete }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [viewMode, setViewMode] = useState('split'); // 'split', 'overlay', 'original'
  const [selectedColormap, setSelectedColormap] = useState('turbo'); // 'turbo', 'jet'
  const [samples, setSamples] = useState([]);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

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
  };

  const handleAnalyze = async () => {
    if (!selectedFile && !previewUrl) return;
    
    setIsLoading(true);
    setErrorMsg(null);

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

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* Top Section: Upload & 3 Curated Benchmark Samples */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        {/* Left: Upload / Camera Dropzone */}
        <div className="lg:col-span-7 railway-glass-card rounded-2xl p-4 sm:p-6 border border-slate-800 flex flex-col justify-between space-y-4">
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
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition min-h-[36px]"
                  >
                    <Camera className="w-3.5 h-3.5 text-slate-400" />
                    <span>Camera</span>
                  </button>
                ) : (
                  <button
                    onClick={stopCamera}
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-rose-950/60 border border-rose-800/40 text-rose-300 transition min-h-[36px]"
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
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-4 sm:p-6 text-center cursor-pointer transition-colors duration-150 flex flex-col items-center justify-center min-h-[190px] sm:min-h-[220px] ${
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

              {previewUrl ? (
                <div className="relative w-full max-h-52 sm:max-h-56 flex items-center justify-center">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="max-h-52 sm:max-h-56 rounded-lg object-contain border border-slate-800 shadow"
                  />
                  <span className="absolute bottom-2 right-2 text-[10px] font-mono bg-slate-950/80 px-2 py-0.5 rounded text-slate-300 border border-slate-800">
                    Click to change
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-slate-800/80 flex items-center justify-center mx-auto text-slate-300 border border-slate-700/50">
                    <UploadCloud className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400" />
                  </div>
                  <div className="text-xs">
                    <span className="text-emerald-400 font-medium">Click to upload</span> or drag and drop
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-slate-500">Supports JPG, PNG, WebP</p>
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

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
            <span className="text-[11px] text-slate-400 font-mono truncate">
              {selectedFile ? selectedFile.name : (previewUrl ? 'Image Selected' : 'No image chosen')}
            </span>

            <button
              onClick={handleAnalyze}
              disabled={isLoading || (!selectedFile && !previewUrl)}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-semibold transition shadow-sm flex items-center justify-center gap-2 min-h-[40px]"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Analyzing...</span>
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
        <div className="lg:col-span-5 railway-glass-card rounded-2xl p-4 sm:p-6 border border-slate-800 flex flex-col justify-between space-y-3">
          <div>
            <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              Benchmark Samples
            </span>
            <h3 className="text-sm font-semibold text-white mt-1.5">
              Quick Test Verification
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Select one of the 3 validated benchmark images for instant evaluation:
            </p>
          </div>

          <div className="space-y-2.5">
            {samples.map((sample, idx) => {
              const isDef = sample.category === 'Defective';
              const isMod = sample.category === 'Moderate';

              return (
                <button
                  key={sample.id || idx}
                  onClick={() => handleSelectSample(sample)}
                  disabled={isLoading}
                  className="w-full text-left p-2.5 sm:p-3 rounded-xl bg-slate-900/70 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 transition flex items-center gap-3 group min-h-[56px]"
                >
                  <img
                    src={sample.url}
                    alt={sample.title}
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg object-cover border border-slate-700/60 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        isDef ? 'bg-rose-400' : (isMod ? 'bg-amber-400' : 'bg-emerald-400')
                      }`} />
                      <h4 className="text-xs font-semibold text-slate-200 truncate group-hover:text-white">
                        {sample.title}
                      </h4>
                    </div>
                    <p className="text-[10px] sm:text-[11px] text-slate-400 truncate mt-0.5">
                      {sample.subtitle || (isDef ? 'Structural Fracture' : (isMod ? 'Rail Switch Joint' : 'Continuous Welded'))}
                    </p>
                    <span className="text-[10px] font-mono text-emerald-400/90 mt-0.5 inline-block">
                      Click to Test →
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800/60 text-[10px] sm:text-[11px] text-slate-400">
            <span className="font-semibold text-slate-300">Note:</span> Instant inference uses LiteRT engine (<span className="text-emerald-400 font-mono">&lt; 100ms</span>). Non-railway images are automatically rejected.
          </div>
        </div>
      </div>

      {/* Results View */}
      {result && (
        <div className="railway-glass-card rounded-2xl p-4 sm:p-6 border border-slate-800 space-y-6">
          {/* Header Status Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl border ${
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
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700 w-full sm:w-auto justify-center min-h-[36px]"
              >
                <Download className="w-3.5 h-3.5 text-slate-400" />
                <span>Export PDF Report</span>
              </button>
            )}
          </div>

          {/* If Image is Rejected (Non-Railway Image) */}
          {result.is_rejected ? (
            <div className="p-4 sm:p-6 rounded-xl bg-rose-950/20 border border-rose-800/40 space-y-4">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-rose-900/30">
                <div className="space-y-1">
                  <span className="text-[11px] font-mono text-slate-400 block">SEMANTIC TRACK SIMILARITY</span>
                  <div className="text-lg font-mono font-bold text-rose-400">
                    {result.semantic_similarity}% <span className="text-xs text-slate-500 font-normal">(Required &ge; 72.0%)</span>
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
                        className={`px-2.5 py-1 rounded font-medium transition ${
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
                        className={`px-2 py-0.5 rounded text-[11px] font-mono transition ${
                          selectedColormap === 'turbo' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400'
                        }`}
                      >
                        Turbo
                      </button>
                      <button
                        onClick={() => setSelectedColormap('jet')}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono transition ${
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
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
                  <div className="pt-2 border-t border-slate-800/80">
                    <span className="text-[11px] font-semibold text-slate-400 block mb-1">
                      Recommendation:
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
                  
                  <div className="space-y-2">
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
