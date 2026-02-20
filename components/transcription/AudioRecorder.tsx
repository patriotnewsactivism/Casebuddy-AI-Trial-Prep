import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, RotateCcw, AlertCircle, Download, Save } from 'lucide-react';
import { TranscriptionStatus } from '../../types';
import { formatTime } from '../../utils/audioUtils';
import { downloadFile, generateFilename } from '../../utils/transcriptionFileUtils';

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
  status: TranscriptionStatus;
  autoDownload: boolean;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({ onRecordingComplete, status, autoDownload }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const startRecording = async () => {
    setError(null);
    setAudioBlob(null);
    chunksRef.current = [];
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        onRecordingComplete(blob);
        if (autoDownload) downloadFile(blob, generateFilename('Evidence_Audio', 'webm'), 'audio/webm');
        stopVisualizer();
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerIntervalRef.current = window.setInterval(() => setRecordingTime(prev => prev + 1), 1000);
      startVisualizer(stream);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setError("Could not access microphone. Please ensure permissions are granted.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };

  const resetRecording = () => { setAudioBlob(null); setRecordingTime(0); setError(null); };
  const handleManualDownload = () => { if (audioBlob) downloadFile(audioBlob, generateFilename('Evidence_Audio', 'webm'), 'audio/webm'); };

  const startVisualizer = (stream: MediaStream) => {
    if (!canvasRef.current) return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    audioContextRef.current = new AudioContextClass();
    sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
    analyserRef.current = audioContextRef.current.createAnalyser();
    analyserRef.current.fftSize = 256;
    sourceRef.current.connect(analyserRef.current);
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      if (!analyserRef.current) return;
      animationFrameRef.current = requestAnimationFrame(draw);
      analyserRef.current.getByteFrequencyData(dataArray);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const barHeight = dataArray[i] / 2;
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
        gradient.addColorStop(0, '#d97706');
        gradient.addColorStop(1, '#fbbf24');
        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };
    draw();
  };

  const stopVisualizer = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current) audioContextRef.current.close();
  };

  useEffect(() => { return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); stopVisualizer(); }; }, []);

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-slate-800/50 rounded-2xl border border-slate-700 border-dashed min-h-[400px]">
      {error && <div className="mb-6 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-200 flex items-center gap-2"><AlertCircle size={20} /><span>{error}</span></div>}
      <div className={`relative w-full max-w-md h-32 mb-8 transition-opacity duration-300 ${isRecording ? 'opacity-100' : 'opacity-20'}`}>
        <canvas ref={canvasRef} width={400} height={128} className="w-full h-full rounded-lg" />
        {!isRecording && !audioBlob && <div className="absolute inset-0 flex items-center justify-center text-slate-500 font-mono text-sm">Awaiting Audio Input...</div>}
      </div>
      <div className="mb-8 font-mono text-5xl font-light text-slate-200 tracking-wider">{formatTime(recordingTime)}</div>
      <div className="flex items-center gap-6">
        {!isRecording && !audioBlob && (
          <button onClick={startRecording} className="group relative flex items-center justify-center w-20 h-20 rounded-full bg-gold-500 hover:bg-gold-600 transition-all duration-300 shadow-lg shadow-gold-500/30 hover:scale-105">
            <Mic size={32} className="text-slate-900 group-hover:animate-pulse" />
          </button>
        )}
        {isRecording && (
          <button onClick={stopRecording} className="group relative flex items-center justify-center w-20 h-20 rounded-full bg-red-500 hover:bg-red-400 transition-all duration-300 shadow-lg shadow-red-500/30 hover:scale-105">
            <Square size={32} className="text-white fill-current" />
            <span className="absolute top-0 right-0 w-4 h-4 bg-red-400 rounded-full animate-ping"></span>
          </button>
        )}
        {audioBlob && !isRecording && (
          <>
            <button onClick={resetRecording} className="flex items-center justify-center w-14 h-14 rounded-full bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white transition-all border border-slate-600" disabled={status === TranscriptionStatus.PROCESSING}><RotateCcw size={20} /></button>
            <button onClick={handleManualDownload} className="flex items-center justify-center w-14 h-14 rounded-full bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 hover:text-white transition-all border border-emerald-600/30"><Save size={20} /></button>
          </>
        )}
      </div>
      {audioBlob && <audio controls src={URL.createObjectURL(audioBlob)} className="mt-8 w-full max-w-md h-10 opacity-70" />}
      {autoDownload && isRecording && <div className="mt-4 text-xs text-emerald-500 flex items-center gap-1 animate-pulse"><Download size={12} /> Auto-save enabled</div>}
    </div>
  );
};

export default AudioRecorder;
