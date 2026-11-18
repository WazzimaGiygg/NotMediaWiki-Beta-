import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Play,
  Pause,
  Video,
  Download,
  RotateCcw,
  Volume2,
  VolumeX,
  ArrowLeft,
  Monitor,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  SlidersHorizontal,
} from 'lucide-react';
import { api } from '../api';
import {
  PromoAspectRatio,
  PromoScene,
  WikiConfigSnapshot,
  buildConfigSnapshot,
  buildDefaultPromoScenes,
  getCanvasDimensions,
  pickSupportedWebmMimeType,
  renderPromoFrame,
} from '../utils/promoVideoEngine';

export interface PromoVideoStudioProps {
  onBack: () => void;
}

export const PromoVideoStudio: React.FC<PromoVideoStudioProps> = ({ onBack }) => {
  const [aspectRatio, setAspectRatio] = useState<PromoAspectRatio>('16:9');
  const [includeAudio, setIncludeAudio] = useState<boolean>(true);
  const [configSnapshot, setConfigSnapshot] = useState<WikiConfigSnapshot>({
    totalArticles: 12,
    activeExtensionsCount: 8,
    activeExtensionNames: [],
    hasMaintenanceExtension: true,
    hasExternalRedirector: true,
    hasSupportExtension: true,
  });
  const [scenes, setScenes] = useState<PromoScene[]>(() =>
    buildDefaultPromoScenes({
      totalArticles: 12,
      activeExtensionsCount: 8,
      activeExtensionNames: [],
      hasMaintenanceExtension: true,
      hasExternalRedirector: true,
      hasSupportExtension: true,
    })
  );
  const [selectedSceneIdx, setSelectedSceneIdx] = useState<number>(0);

  // Playback & Recording State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Load real live Wiki configuration (articles + active extensions)
  useEffect(() => {
    let mounted = true;
    Promise.all([
      api.getArticles().catch(() => []),
      api.getExtensions().catch(() => []),
    ]).then(([articles, extensions]) => {
      if (!mounted) return;
      const snap = buildConfigSnapshot(articles.length, extensions);
      setConfigSnapshot(snap);
      setScenes(buildDefaultPromoScenes(snap));
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Cleanup object URLs & animation frames on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
      if (recordedVideoUrl) {
        URL.revokeObjectURL(recordedVideoUrl);
      }
    };
  }, [recordedVideoUrl]);

  const totalDurationSec = useMemo(
    () => scenes.reduce((acc, s) => acc + Math.max(2, s.durationSec), 0),
    [scenes]
  );

  const resolveSceneAtTime = useCallback(
    (timeSec: number) => {
      let elapsed = 0;
      for (let i = 0; i < scenes.length; i++) {
        const dur = Math.max(2, scenes[i].durationSec);
        if (timeSec <= elapsed + dur || i === scenes.length - 1) {
          return {
            scene: scenes[i],
            sceneIndex: i,
            localProgress: Math.max(0, Math.min(1, (timeSec - elapsed) / dur)),
          };
        }
        elapsed += dur;
      }
      return { scene: scenes[0], sceneIndex: 0, localProgress: 0 };
    },
    [scenes]
  );

  // Draw static/scrubbed frame whenever time, scene, or aspect ratio changes
  const drawAtTime = useCallback(
    (timeSec: number) => {
      const canvas = canvasRef.current;
      if (!canvas || scenes.length === 0) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const { width, height } = getCanvasDimensions(aspectRatio);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const { scene, sceneIndex, localProgress } = resolveSceneAtTime(timeSec);
      const globalProgress = totalDurationSec > 0 ? timeSec / totalDurationSec : 0;

      renderPromoFrame(
        ctx,
        width,
        height,
        scene,
        localProgress,
        globalProgress,
        sceneIndex,
        scenes.length,
        aspectRatio
      );
    },
    [aspectRatio, resolveSceneAtTime, scenes.length, totalDurationSec]
  );

  useEffect(() => {
    if (!isPlaying && !isRecording) {
      drawAtTime(currentTimeSec);
    }
  }, [currentTimeSec, drawAtTime, isPlaying, isRecording, scenes, aspectRatio]);

  const startAmbientSoundtrack = (durationSec: number): MediaStreamTrack | null => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return null;

      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      const dest = ctx.createMediaStreamDestination();
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.001, ctx.currentTime);
      masterGain.gain.linearRampToValueAtTime(0.14, ctx.currentTime + 1.0);
      masterGain.gain.setValueAtTime(0.14, Math.max(ctx.currentTime + 1.1, ctx.currentTime + durationSec - 1.2));
      masterGain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + durationSec);

      masterGain.connect(dest);
      masterGain.connect(ctx.destination);

      // Subtle warm editorial chord progression (C minor / Ab / Eb / Bb)
      const chords = [
        [130.81, 196.0, 261.63, 311.13],
        [103.83, 155.56, 207.65, 261.63],
        [155.56, 233.08, 311.13, 392.0],
        [116.54, 174.61, 233.08, 293.66],
      ];
      const stepSec = 4;
      const totalSteps = Math.ceil(durationSec / stepSec);

      for (let s = 0; s < totalSteps; s++) {
        const chord = chords[s % chords.length];
        const startT = ctx.currentTime + s * stepSec;
        const endT = Math.min(ctx.currentTime + durationSec, startT + stepSec);

        chord.forEach(freq => {
          const osc = ctx.createOscillator();
          const noteGain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, startT);

          noteGain.gain.setValueAtTime(0.001, startT);
          noteGain.gain.linearRampToValueAtTime(0.18 / chord.length, startT + 0.4);
          noteGain.gain.linearRampToValueAtTime(0.001, endT);

          osc.connect(noteGain);
          noteGain.connect(masterGain);
          osc.start(startT);
          osc.stop(endT + 0.05);
        });
      }

      return dest.stream.getAudioTracks()[0] || null;
    } catch {
      return null;
    }
  };

  const stopAudio = () => {
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  };

  const handleTogglePreview = () => {
    if (isRecording) return;

    if (isPlaying) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      stopAudio();
      setIsPlaying(false);
      return;
    }

    const startOffset = currentTimeSec >= totalDurationSec - 0.1 ? 0 : currentTimeSec;
    setIsPlaying(true);
    setStatusMessage(null);

    if (includeAudio) {
      startAmbientSoundtrack(Math.max(1, totalDurationSec - startOffset));
    }

    const startedAt = performance.now() - startOffset * 1000;

    const tick = (now: number) => {
      const elapsedSec = (now - startedAt) / 1000;
      if (elapsedSec >= totalDurationSec) {
        drawAtTime(totalDurationSec);
        setCurrentTimeSec(totalDurationSec);
        setIsPlaying(false);
        stopAudio();
        return;
      }

      drawAtTime(elapsedSec);
      setCurrentTimeSec(elapsedSec);
      const { sceneIndex } = resolveSceneAtTime(elapsedSec);
      setSelectedSceneIdx(sceneIndex);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  };

  const handleRecordAndExport = () => {
    if (isRecording) return;
    const canvas = canvasRef.current;
    if (!canvas || typeof canvas.captureStream !== 'function' || typeof MediaRecorder === 'undefined') {
      setStatusMessage({
        type: 'error',
        text: 'Seu navegador não suporta gravação de Canvas via MediaRecorder. Utilize Chrome, Edge ou Firefox atualizado.',
      });
      return;
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    stopAudio();
    setIsPlaying(false);
    setIsRecording(true);
    setCurrentTimeSec(0);
    setStatusMessage({
      type: 'info',
      text: `Renderizando vídeo comercial (${aspectRatio}, ${totalDurationSec.toFixed(1)}s) em tempo real...`,
    });

    if (recordedVideoUrl) {
      URL.revokeObjectURL(recordedVideoUrl);
      setRecordedVideoUrl(null);
    }

    // Ensure canvas starts cleanly on frame 0
    drawAtTime(0);

    const videoStream = canvas.captureStream(30);
    const combinedTracks: MediaStreamTrack[] = [...videoStream.getVideoTracks()];

    if (includeAudio) {
      const audioTrack = startAmbientSoundtrack(totalDurationSec);
      if (audioTrack) {
        combinedTracks.push(audioTrack);
      }
    }

    const stream = new MediaStream(combinedTracks);
    const mimeType = pickSupportedWebmMimeType();
    const chunks: BlobPart[] = [];

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 4_500_000,
      });
    } catch {
      recorder = new MediaRecorder(stream);
    }

    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = e => {
      if (e.data && e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    recorder.onstop = () => {
      stopAudio();
      const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
      const url = URL.createObjectURL(blob);
      setRecordedVideoUrl(url);
      setIsRecording(false);
      setStatusMessage({
        type: 'success',
        text: `Vídeo comercial WebM pronto (${(blob.size / (1024 * 1024)).toFixed(2)} MB). Clique em "Baixar Vídeo (.webm)" para salvar.`,
      });
    };

    recorder.start(250);
    const startedAt = performance.now();

    const recordTick = (now: number) => {
      const elapsedSec = (now - startedAt) / 1000;
      if (elapsedSec >= totalDurationSec) {
        drawAtTime(totalDurationSec);
        setCurrentTimeSec(totalDurationSec);
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
        return;
      }

      drawAtTime(elapsedSec);
      setCurrentTimeSec(elapsedSec);
      const { sceneIndex } = resolveSceneAtTime(elapsedSec);
      setSelectedSceneIdx(sceneIndex);
      rafRef.current = requestAnimationFrame(recordTick);
    };

    rafRef.current = requestAnimationFrame(recordTick);
  };

  const handleDownloadWebm = () => {
    if (!recordedVideoUrl) return;
    const a = document.createElement('a');
    a.href = recordedVideoUrl;
    a.download = `notmediawiki-comercial-${aspectRatio.replace(':', 'x')}-${new Date().toISOString().slice(0, 10)}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleSelectScene = (index: number) => {
    setSelectedSceneIdx(index);
    let offset = 0;
    for (let i = 0; i < index; i++) {
      offset += Math.max(2, scenes[i].durationSec);
    }
    // Position at 35% of the scene so animations are fully visible in preview
    const previewTime = offset + Math.max(2, scenes[index].durationSec) * 0.35;
    setCurrentTimeSec(previewTime);
    drawAtTime(previewTime);
  };

  const handleUpdateScene = (index: number, patch: Partial<PromoScene>) => {
    setScenes(prev => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const handleResetScenes = () => {
    setScenes(buildDefaultPromoScenes(configSnapshot));
    setSelectedSceneIdx(0);
    setCurrentTimeSec(1.5);
    setStatusMessage({
      type: 'info',
      text: 'Roteiro restaurado com base nas configurações reais do NotMediaWiki.',
    });
  };

  const activeScene = scenes[selectedSceneIdx] || scenes[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6" data-testid="promo-video-studio">
      {/* Studio Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 inline-flex items-center gap-1.5 mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar para a Enciclopédia</span>
          </button>
          <h1 className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Estúdio de Vídeo Comercial e Divulgação
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Renderização 100% gratuita no navegador (HTML5 Canvas + WebM) · Baseado nas {configSnapshot.activeExtensionsCount} extensões ativas e {configSnapshot.totalArticles} artigos de core.wazzimagiygg.com
          </p>
        </div>

        {/* Format & Audio Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setAspectRatio('16:9')}
              disabled={isRecording}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                aspectRatio === '16:9'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>16:9 YouTube</span>
            </button>
            <button
              type="button"
              onClick={() => setAspectRatio('9:16')}
              disabled={isRecording}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                aspectRatio === '9:16'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>9:16 Reels / Shorts</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIncludeAudio(v => !v)}
            disabled={isRecording}
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer"
          >
            {includeAudio ? (
              <Volume2 className="w-3.5 h-3.5 text-blue-600" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>{includeAudio ? 'Trilha Sonora Ativa' : 'Sem Áudio'}</span>
          </button>
        </div>
      </div>

      {/* Inline Status Banner */}
      {statusMessage && (
        <div
          role="status"
          className={`p-3 rounded-lg border text-xs font-medium flex items-center justify-between gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : statusMessage.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
              : 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : statusMessage.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            ) : (
              <Video className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-xs opacity-70 hover:opacity-100 cursor-pointer"
            aria-label="Fechar aviso"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Two-Column Studio Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Focal Anchor: Live Canvas Stage & Export Controls */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-950 rounded-lg border border-slate-800 p-4 flex flex-col items-center justify-center">
            <canvas
              ref={canvasRef}
              className={`rounded border border-slate-800 bg-slate-950 shadow-lg ${
                aspectRatio === '9:16'
                  ? 'max-h-[540px] w-auto aspect-[9/16]'
                  : 'w-full h-auto aspect-video'
              }`}
            />

            {/* Timeline Scrubber */}
            <div className="w-full mt-4 space-y-2">
              <input
                type="range"
                min={0}
                max={totalDurationSec}
                step={0.1}
                value={Math.min(currentTimeSec, totalDurationSec)}
                disabled={isRecording}
                onChange={e => {
                  const val = parseFloat(e.target.value);
                  setCurrentTimeSec(val);
                  const { sceneIndex } = resolveSceneAtTime(val);
                  setSelectedSceneIdx(sceneIndex);
                }}
                aria-label="Linha do tempo do vídeo"
                className="w-full accent-blue-600 cursor-pointer"
              />
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 tabular-nums">
                <span>{currentTimeSec.toFixed(1)}s</span>
                <span>
                  Cena {selectedSceneIdx + 1} de {scenes.length} · Total {totalDurationSec.toFixed(1)}s
                </span>
              </div>
            </div>

            {/* Primary Transport & Export Controls */}
            <div className="w-full mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTogglePreview}
                  disabled={isRecording}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{isPlaying ? 'Pausar Prévia' : 'Pré-visualizar'}</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleRecordAndExport}
                  disabled={isRecording}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>{isRecording ? 'Gravando WebM...' : 'Gerar Vídeo (.WebM)'}</span>
                </button>

                {recordedVideoUrl && (
                  <button
                    type="button"
                    onClick={handleDownloadWebm}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Baixar Vídeo (.webm)</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Rendered Video Replay Box */}
          {recordedVideoUrl && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Vídeo Comercial Renderizado
                </h2>
                <button
                  type="button"
                  onClick={handleDownloadWebm}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Salvar arquivo .webm</span>
                </button>
              </div>
              <video
                src={recordedVideoUrl}
                controls
                className={`rounded border border-slate-200 dark:border-slate-700 bg-black mx-auto ${
                  aspectRatio === '9:16' ? 'max-h-[420px]' : 'w-full'
                }`}
              />
            </div>
          )}
        </div>

        {/* Right Panel: Storyboard & Scene Editor */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Roteiro do Comercial ({scenes.length} Cenas)
              </h2>
            </div>
            <button
              type="button"
              onClick={handleResetScenes}
              disabled={isRecording}
              className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 inline-flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restaurar padrão</span>
            </button>
          </div>

          {/* Scene Selector Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {scenes.map((scene, idx) => (
              <button
                key={scene.id}
                type="button"
                onClick={() => handleSelectScene(idx)}
                disabled={isRecording}
                className={`px-2.5 py-2 rounded text-left text-xs border transition-colors cursor-pointer truncate ${
                  selectedSceneIdx === idx
                    ? 'bg-slate-900 dark:bg-blue-600 text-white border-slate-900 dark:border-blue-600 font-semibold'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <span className="font-mono opacity-75 mr-1">0{idx + 1}.</span>
                <span>{scene.headline.slice(0, 18)}...</span>
              </button>
            ))}
          </div>

          {/* Active Scene Editor Form */}
          {activeScene && (
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Subtítulo superior (Kicker)
                </label>
                <input
                  type="text"
                  value={activeScene.kicker}
                  disabled={isRecording}
                  onChange={e => handleUpdateScene(selectedSceneIdx, { kicker: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Título principal da cena
                </label>
                <input
                  type="text"
                  value={activeScene.headline}
                  disabled={isRecording}
                  onChange={e => handleUpdateScene(selectedSceneIdx, { headline: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Texto de apoio
                </label>
                <textarea
                  rows={3}
                  value={activeScene.subtitle}
                  disabled={isRecording}
                  onChange={e => handleUpdateScene(selectedSceneIdx, { subtitle: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {!activeScene.comparison && (
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Pontos em destaque (um por linha)
                  </label>
                  <textarea
                    rows={4}
                    value={activeScene.bullets.join('\n')}
                    disabled={isRecording}
                    onChange={e =>
                      handleUpdateScene(selectedSceneIdx, {
                        bullets: e.target.value.split('\n').filter(line => line.trim().length > 0),
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}

              <div className="flex items-center justify-between gap-4 pt-1">
                <label className="font-medium text-slate-700 dark:text-slate-300">
                  Duração da cena: <span className="font-mono tabular-nums">{activeScene.durationSec}s</span>
                </label>
                <input
                  type="range"
                  min={3}
                  max={10}
                  step={0.5}
                  value={activeScene.durationSec}
                  disabled={isRecording}
                  onChange={e =>
                    handleUpdateScene(selectedSceneIdx, {
                      durationSec: parseFloat(e.target.value),
                    })
                  }
                  className="w-36 accent-blue-600 cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PromoVideoStudio;
