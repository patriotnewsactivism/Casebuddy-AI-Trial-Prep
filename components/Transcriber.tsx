import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../App';
import { Transcription } from '../types';
import { Mic, Upload, Trash2, Play, Pause, Download, Tag, FileAudio, Clock, Users, Save, Edit2, X } from 'lucide-react';
import { toast } from 'react-toastify';

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
      const validTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/m4a', 'audio/ogg', 'audio/webm'];
      if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|m4a|ogg|webm)$/i)) {
        toast.error('Please select a valid audio file (MP3, WAV, M4A, OGG, or WebM)');
        return;
      }

      // Check file size (max 100MB)
      if (file.size > 100 * 1024 * 1024) {
        toast.error('File size must be less than 100MB');
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
      const formData = new FormData();
      formData.append('audio', selectedFile);
      formData.append('caseId', activeCase.id);

      // Call the transcription service
      // NOTE: This assumes the transcribe.casebuddy.live service has an API endpoint
      // You'll need to adjust this URL based on the actual API structure
      const response = await fetch('https://transcribe.casebuddy.live/api/transcribe', {
        method: 'POST',
        body: formData,
        // Add authentication headers if needed
        // headers: { 'Authorization': `Bearer ${yourToken}` }
      });

      if (!response.ok) {
        throw new Error(`Transcription failed: ${response.statusText}`);
      }

      const result = await response.json();

      // Create new transcription record
      const newTranscription: Transcription = {
        id: Date.now().toString(),
        caseId: activeCase.id,
        fileName: selectedFile.name,
        text: result.text || result.transcript || '',
        duration: result.duration,
        speakers: result.speakers || [],
        timestamp: Date.now(),
        tags: [],
        notes: ''
      };

      const updated = [...transcriptions, newTranscription];
      saveTranscriptions(updated);

      toast.success('Transcription completed successfully!');
      setSelectedFile(null);

      // Reset file input
      const fileInput = document.getElementById('audio-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (error) {
      console.error('Transcription error:', error);

      // Fallback: For demo purposes, create a placeholder transcription
      // Remove this in production when the API is fully implemented
      toast.warning('Transcription service unavailable. Creating placeholder for testing.');

      const placeholderTranscription: Transcription = {
        id: Date.now().toString(),
        caseId: activeCase.id,
        fileName: selectedFile.name,
        text: `[Placeholder transcription for ${selectedFile.name}]\n\nThis is a demo transcription. In production, this would contain the actual transcribed text from the audio file.\n\nTo enable real transcription:\n1. Ensure the transcribe.casebuddy.live service is running\n2. Configure the API endpoint in this component\n3. Add authentication if required`,
        duration: 0,
        speakers: ['Speaker 1', 'Speaker 2'],
        timestamp: Date.now(),
        tags: ['demo'],
        notes: 'Placeholder - replace with real transcription service'
      };

      const updated = [...transcriptions, placeholderTranscription];
      saveTranscriptions(updated);
      setSelectedFile(null);
    } finally {
      setIsTranscribing(false);
    }
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
                Select Audio File (MP3, WAV, M4A, OGG, WebM - Max 100MB)
              </label>
              <input
                id="audio-upload"
                type="file"
                accept="audio/*"
                onChange={handleFileSelect}
                className="block w-full text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gold-500 file:text-slate-900 hover:file:bg-gold-600 file:cursor-pointer cursor-pointer bg-slate-700/50 border border-slate-600 rounded-lg"
              />
            </div>

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
              <strong>Powered by transcribe.casebuddy.live</strong>
              <br />
              Your audio files are securely processed and transcribed using advanced speech-to-text AI.
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
