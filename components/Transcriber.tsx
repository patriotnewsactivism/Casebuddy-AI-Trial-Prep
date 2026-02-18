import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../App';
import { Transcription } from '../types';
import { Mic, Upload, Trash2, Play, Pause, Download, Tag, FileAudio, Clock, Users, Save, Edit2, X, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

const Transcriber = () => {
  const { activeCase } = useContext(AppContext);
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedTranscription, setSelectedTranscription] = useState<Transcription | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState('');
  const [editedNotes, setEditedNotes] = useState('');
  const [newTags, setNewTags] = useState('');
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; fileName: string } | null>(null);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        const base64Content = base64data.split(',')[1];
        resolve(base64Content);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const transcribeWithGemini = async (file: File): Promise<{ text: string; speakers: string[] }> => {
    if (!apiKey) {
      throw new Error('API key not configured. Please set GEMINI_API_KEY in .env.local');
    }

    const base64Audio = await fileToBase64(file);
    const mimeType = file.type || 'audio/mpeg';

    const prompt = `You are a professional legal transcriptionist. Transcribe the following audio file completely and accurately.

IMPORTANT INSTRUCTIONS:
1. Transcribe EVERYTHING spoken in the audio - do not summarize or skip any parts
2. Identify and label different speakers (Speaker 1, Speaker 2, etc.) if multiple voices are present
3. Include timestamps in [MM:SS] format where possible
4. Preserve the exact words spoken - do not correct grammar or paraphrase
5. For unclear sections, indicate [inaudible] or [unclear]
6. Note any background noises or audio quality issues in [brackets]

Format the transcript as:
[00:00] Speaker 1: [text]
[00:05] Speaker 2: [text]
...

If this is a legal proceeding, deposition, interview, or discovery audio, maintain formal transcription standards.

Provide the complete transcription:`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { data: base64Audio, mimeType } },
            { text: prompt }
          ]
        }
      ],
      config: {
        temperature: 0.1,
      }
    });

    const transcriptText = response.text || '';
    const speakerMatches = transcriptText.match(/Speaker \d+/g) || [];
    const speakers = [...new Set(speakerMatches)].map(s => s);

    return { text: transcriptText, speakers };
  };

  // Load transcriptions from localStorage for the active case
  useEffect(() => {
    if (activeCase) {
      const saved = localStorage.getItem(`transcriptions_${activeCase.id}`);
      if (saved) {
        setTranscriptions(JSON.parse(saved));
      } else {
        setTranscriptions([]);
      }
    }
  }, [activeCase]);

  // Save transcriptions to localStorage
  const saveTranscriptions = (updated: Transcription[]) => {
    if (activeCase) {
      localStorage.setItem(`transcriptions_${activeCase.id}`, JSON.stringify(updated));
      setTranscriptions(updated);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file type
      const validTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/m4a', 'audio/ogg', 'audio/webm', 'video/mp4'];
      if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|m4a|ogg|webm|mp4)$/i)) {
        toast.error('Please select a valid audio/video file (MP3, WAV, M4A, OGG, WebM, or MP4)');
        return;
      }

      // Check file size (max 100MB)
      if (file.size > 200 * 1024 * 1024) {
        toast.error('File size must be less than 200MB');
        return;
      }

      setSelectedFile(file);
      toast.info(`Selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    }
  };

  const transcribeAudio = async () => {
    if (!selectedFile || !activeCase) {
      toast.error('Please select a file and ensure a case is active');
      return;
    }

    setIsTranscribing(true);

    try {
      toast.info('Transcribing audio with AI... This may take a few minutes for large files.');
      
      const result = await transcribeWithGemini(selectedFile);

      const newTranscription: Transcription = {
        id: Date.now().toString(),
        caseId: activeCase.id,
        fileName: selectedFile.name,
        text: result.text,
        duration: 0,
        speakers: result.speakers,
        timestamp: Date.now(),
        tags: [],
        notes: ''
      };

      const updated = [...transcriptions, newTranscription];
      saveTranscriptions(updated);

      toast.success('Transcription completed successfully!');
      setSelectedFile(null);

      const fileInput = document.getElementById('audio-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (error) {
      console.error('Transcription error:', error);
      toast.error(`Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleBatchUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (!activeCase) {
      toast.error('Please select a case first');
      e.target.value = '';
      return;
    }

    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/m4a', 'audio/ogg', 'audio/webm', 'video/mp4'];
    const validFiles = files.filter(file => 
      validTypes.includes(file.type) || file.name.match(/\.(mp3|wav|m4a|ogg|webm|mp4)$/i)
    );

    if (validFiles.length === 0) {
      toast.error('No valid audio files selected');
      e.target.value = '';
      return;
    }

    setIsTranscribing(true);
    setBatchProgress({ current: 0, total: validFiles.length, fileName: '' });

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      setBatchProgress({ current: i + 1, total: validFiles.length, fileName: file.name });

      try {
        toast.info(`Transcribing ${file.name} (${i + 1}/${validFiles.length})...`);
        
        const result = await transcribeWithGemini(file);

        const newTranscription: Transcription = {
          id: `${Date.now()}-${i}`,
          caseId: activeCase.id,
          fileName: file.name,
          text: result.text,
          duration: 0,
          speakers: result.speakers,
          timestamp: Date.now(),
          tags: [],
          notes: ''
        };

        const updated = [...transcriptions, newTranscription];
        setTranscriptions(updated);
        saveTranscriptions(updated);
        
        toast.success(`Completed: ${file.name}`);
      } catch (error) {
        console.error(`Failed to transcribe ${file.name}:`, error);
        toast.error(`Failed: ${file.name} - ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    setBatchProgress(null);
    setIsTranscribing(false);
    e.target.value = '';
  };

  const deleteTranscription = (id: string) => {
    if (window.confirm('Are you sure you want to delete this transcription?')) {
      const updated = transcriptions.filter(t => t.id !== id);
      saveTranscriptions(updated);
      if (selectedTranscription?.id === id) {
        setSelectedTranscription(null);
      }
      toast.success('Transcription deleted');
    }
  };

  const startEditing = (transcription: Transcription) => {
    setSelectedTranscription(transcription);
    setEditedText(transcription.text);
    setEditedNotes(transcription.notes || '');
    setNewTags(transcription.tags?.join(', ') || '');
    setIsEditing(true);
  };

  const saveEdits = () => {
    if (!selectedTranscription) return;

    const updated = transcriptions.map(t =>
      t.id === selectedTranscription.id
        ? {
            ...t,
            text: editedText,
            notes: editedNotes,
            tags: newTags.split(',').map(tag => tag.trim()).filter(Boolean)
          }
        : t
    );

    saveTranscriptions(updated);
    setSelectedTranscription(updated.find(t => t.id === selectedTranscription.id) || null);
    setIsEditing(false);
    toast.success('Changes saved');
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditedText('');
    setEditedNotes('');
    setNewTags('');
  };

  const downloadTranscription = (transcription: Transcription) => {
    const content = `TRANSCRIPTION: ${transcription.fileName}
Case: ${activeCase?.title || 'N/A'}
Date: ${new Date(transcription.timestamp).toLocaleString()}
Duration: ${transcription.duration ? `${Math.floor(transcription.duration / 60)}:${String(transcription.duration % 60).padStart(2, '0')}` : 'Unknown'}
Tags: ${transcription.tags?.join(', ') || 'None'}

NOTES:
${transcription.notes || 'No notes'}

TRANSCRIPT:
${transcription.text}
`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${transcription.fileName.replace(/\.[^.]+$/, '')}_transcript.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Transcription downloaded');
  };

  if (!activeCase) {
    return (
      <div className="min-h-screen bg-slate-900 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-12 text-center">
            <FileAudio className="mx-auto mb-4 text-slate-500" size={64} />
            <h2 className="text-2xl font-bold text-white mb-2">No Active Case</h2>
            <p className="text-slate-400">Please select or create a case to use the transcription service.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Mic className="text-gold-500" size={32} />
            <h1 className="text-3xl font-bold text-white font-serif">Audio Transcriber</h1>
          </div>
          <p className="text-slate-400">
            Upload and transcribe audio files for case: <span className="text-gold-400 font-semibold">{activeCase.title}</span>
          </p>
        </div>

        {/* Upload Section */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Upload size={20} />
            Upload Audio File
          </h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="audio-upload" className="block text-sm font-medium text-slate-300 mb-2">
                Select Audio File (MP3, WAV, M4A, OGG, WebM, MP4 - Max 200MB)
              </label>
              <div className="flex gap-3">
                <input
                  id="audio-upload"
                  type="file"
                  accept="audio/*,video/mp4"
                  onChange={handleFileSelect}
                  className="flex-1 text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gold-500 file:text-slate-900 hover:file:bg-gold-600 file:cursor-pointer cursor-pointer bg-slate-700/50 border border-slate-600 rounded-lg"
                />
                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300 hover:text-white transition-colors px-4 py-2 rounded-lg border border-slate-600 hover:border-gold-500 bg-slate-700/50">
                  <Upload size={16} />
                  Batch Upload
                  <input
                    type="file"
                    accept="audio/*,video/mp4"
                    multiple
                    onChange={handleBatchUpload}
                    className="hidden"
                    disabled={isTranscribing}
                  />
                </label>
              </div>
            </div>

            {batchProgress && (
              <div className="bg-slate-700/50 border border-gold-500/30 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Loader2 className="animate-spin text-gold-500" size={20} />
                  <span className="text-white font-medium">Batch Transcription in Progress</span>
                </div>
                <p className="text-sm text-slate-300 mb-2">
                  Processing {batchProgress.current} of {batchProgress.total}: {batchProgress.fileName}
                </p>
                <div className="w-full bg-slate-600 rounded-full h-2">
                  <div 
                    className="bg-gold-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {selectedFile && (
              <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileAudio className="text-gold-400" size={24} />
                    <div>
                      <p className="text-white font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-slate-400">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="text-slate-400 hover:text-red-400 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={transcribeAudio}
              disabled={!selectedFile || isTranscribing}
              className="w-full bg-gold-500 hover:bg-gold-600 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isTranscribing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-slate-900"></div>
                  Transcribing...
                </>
              ) : (
                <>
                  <Mic size={20} />
                  Start Transcription
                </>
              )}
            </button>
          </div>

          <div className="mt-4 p-4 bg-blue-900/20 border border-blue-700/30 rounded-lg">
            <p className="text-sm text-blue-200">
              <strong>AI-Powered Transcription</strong>
              <br />
              Audio files are transcribed using Google's Gemini AI with speaker identification and timestamps. Supports large discovery files, depositions, and interviews.
            </p>
          </div>
        </div>

        {/* Transcriptions List */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* List View */}
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Transcriptions ({transcriptions.length})</h2>

            {transcriptions.length === 0 ? (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center">
                <FileAudio className="mx-auto mb-3 text-slate-600" size={48} />
                <p className="text-slate-400">No transcriptions yet</p>
                <p className="text-sm text-slate-500 mt-1">Upload an audio file to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {transcriptions
                  .sort((a, b) => b.timestamp - a.timestamp)
                  .map(transcription => (
                    <div
                      key={transcription.id}
                      className={`bg-slate-800/50 border rounded-xl p-4 transition-all cursor-pointer ${
                        selectedTranscription?.id === transcription.id
                          ? 'border-gold-500 shadow-lg shadow-gold-500/20'
                          : 'border-slate-700 hover:border-slate-600'
                      }`}
                      onClick={() => setSelectedTranscription(transcription)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="text-white font-semibold flex items-center gap-2">
                            <FileAudio size={16} className="text-gold-400" />
                            {transcription.fileName}
                          </h3>
                          <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                            <Clock size={12} />
                            {new Date(transcription.timestamp).toLocaleString()}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteTranscription(transcription.id);
                          }}
                          className="text-slate-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {transcription.duration && (
                        <p className="text-sm text-slate-400 mb-2">
                          Duration: {Math.floor(transcription.duration / 60)}:{String(transcription.duration % 60).padStart(2, '0')}
                        </p>
                      )}

                      {transcription.tags && transcription.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {transcription.tags.map((tag, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 bg-gold-900/30 text-gold-400 text-xs rounded-full"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      <p className="text-sm text-slate-300 line-clamp-2">
                        {transcription.text.substring(0, 150)}...
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Detail View */}
          <div>
            {selectedTranscription ? (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 sticky top-8">
                <div className="flex items-start justify-between mb-4">
                  <h2 className="text-xl font-bold text-white">Transcription Details</h2>
                  <button
                    onClick={() => setSelectedTranscription(null)}
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4 mb-6">
                  <div>
                    <p className="text-sm text-slate-400 mb-1">File Name</p>
                    <p className="text-white font-medium">{selectedTranscription.fileName}</p>
                  </div>

                  <div>
                    <p className="text-sm text-slate-400 mb-1">Date</p>
                    <p className="text-white">{new Date(selectedTranscription.timestamp).toLocaleString()}</p>
                  </div>

                  {selectedTranscription.speakers && selectedTranscription.speakers.length > 0 && (
                    <div>
                      <p className="text-sm text-slate-400 mb-1 flex items-center gap-1">
                        <Users size={14} />
                        Speakers
                      </p>
                      <p className="text-white">{selectedTranscription.speakers.join(', ')}</p>
                    </div>
                  )}

                  <div>
                    <p className="text-sm text-slate-400 mb-1 flex items-center gap-1">
                      <Tag size={14} />
                      Tags
                    </p>
                    {isEditing ? (
                      <input
                        type="text"
                        value={newTags}
                        onChange={(e) => setNewTags(e.target.value)}
                        placeholder="tag1, tag2, tag3"
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-gold-500"
                      />
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {selectedTranscription.tags && selectedTranscription.tags.length > 0 ? (
                          selectedTranscription.tags.map((tag, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-gold-900/30 text-gold-400 text-sm rounded-full"
                            >
                              {tag}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-500 text-sm">No tags</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-sm text-slate-400 mb-1">Notes</p>
                    {isEditing ? (
                      <textarea
                        value={editedNotes}
                        onChange={(e) => setEditedNotes(e.target.value)}
                        placeholder="Add notes about this transcription..."
                        rows={3}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-gold-500 resize-none"
                      />
                    ) : (
                      <p className="text-white">
                        {selectedTranscription.notes || <span className="text-slate-500">No notes</span>}
                      </p>
                    )}
                  </div>
                </div>

                <div className="border-t border-slate-700 pt-4 mb-4">
                  <p className="text-sm text-slate-400 mb-2">Transcript</p>
                  {isEditing ? (
                    <textarea
                      value={editedText}
                      onChange={(e) => setEditedText(e.target.value)}
                      rows={12}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-gold-500 resize-none font-mono text-sm"
                    />
                  ) : (
                    <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-4 max-h-96 overflow-y-auto">
                      <p className="text-slate-200 whitespace-pre-wrap text-sm leading-relaxed">
                        {selectedTranscription.text}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  {isEditing ? (
                    <>
                      <button
                        onClick={saveEdits}
                        className="flex-1 bg-gold-500 hover:bg-gold-600 text-slate-900 font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <Save size={16} />
                        Save Changes
                      </button>
                      <button
                        onClick={cancelEditing}
                        className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startEditing(selectedTranscription)}
                        className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <Edit2 size={16} />
                        Edit
                      </button>
                      <button
                        onClick={() => downloadTranscription(selectedTranscription)}
                        className="flex-1 bg-gold-500 hover:bg-gold-600 text-slate-900 font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <Download size={16} />
                        Download
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center sticky top-8">
                <FileAudio className="mx-auto mb-3 text-slate-600" size={48} />
                <p className="text-slate-400">Select a transcription to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Transcriber;
