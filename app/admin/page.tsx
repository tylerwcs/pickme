'use client';

import { useState, useEffect, useRef } from 'react';
import Papa from 'papaparse';
import { Participant, ChannelMessage } from '@/types';
import { MOCK_PARTICIPANTS } from '@/lib/data';

export default function AdminPage() {
  const [participants, setParticipants] = useState<Participant[]>(MOCK_PARTICIPANTS);
  const [winnerCount, setWinnerCount] = useState(1);
  const [gridColumns, setGridColumns] = useState(0); // 0 = Auto
  const [duration, setDuration] = useState(5); // Default 5 seconds
  const [backgroundColor, setBackgroundColor] = useState('#2563eb'); // Default Blue
  const [removeWinners, setRemoveWinners] = useState(true);
  const [isRolling, setIsRolling] = useState(false);
  const [channel, setChannel] = useState<BroadcastChannel | null>(null);
  const [pendingWinners, setPendingWinners] = useState<Participant[]>([]);

  const pendingWinnersRef = useRef<Participant[]>([]);

  const [headers, setHeaders] = useState<string[]>(['Staff ID', 'Name', 'Company']);
  const [history, setHistory] = useState<{ timestamp: string; winners: Participant[] }[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Participant | null>(null);

  useEffect(() => {
    const bc = new BroadcastChannel('lucky_draw_channel');
    setChannel(bc);
    // Initial sync of settings if needed
    return () => bc.close();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Spacebar to toggle rolling
      // Prevent default scrolling behavior if Space is pressed
      if (e.code === 'Space' && document.activeElement === document.body) {
        e.preventDefault();
        if (!isRolling) {
          handleStart();
        } else {
          handleStop();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRolling, winnerCount, gridColumns, duration, backgroundColor, removeWinners, participants]); // Dependencies for handleStart/Stop closure

  const handleTogglePredetermined = (id: string, checked: boolean) => {
    setParticipants(prev => prev.map(p => 
        p.id === id ? { ...p, isPredetermined: checked } : p
    ));
  };

  const handleStart = async () => {
    // Select winners logic
    // 1. Separate predetermined winners and normal participants
    const predetermined = participants.filter(p => p.isPredetermined);
    const others = participants.filter(p => !p.isPredetermined);
    
    let selected: Participant[] = [];

    // 2. Add predetermined winners first (up to winnerCount)
    if (predetermined.length > 0) {
        selected = [...predetermined.slice(0, winnerCount)];
    }

    // 3. Fill remaining spots with random selection from others
    const remainingCount = winnerCount - selected.length;
    if (remainingCount > 0) {
        const shuffledOthers = [...others].sort(() => 0.5 - Math.random());
        selected = [...selected, ...shuffledOthers.slice(0, remainingCount)];
    }

    // 4. Shuffle the final selected list so predetermined winners aren't always first
    // Note: The rolling animation will eventually stop on these.
    // If we want specific boxes to be predetermined, we can map them directly.
    // But for now, just ensuring they are IN the winner list is enough.
    // However, if grid position matters, we might want to shuffle.
    // Let's shuffle so it looks natural.
    selected = selected.sort(() => 0.5 - Math.random());

    pendingWinnersRef.current = selected;
    setPendingWinners(selected);
    
    setIsRolling(true);
    
    if (channel) {
        channel.postMessage({ type: 'START_ROLL', count: winnerCount, gridColumns, duration, backgroundColor, removeWinners, pool: participants, headers });
    }

    // Sync via API
    await fetch('/api/draw-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          type: 'START_ROLL', 
          count: winnerCount, 
          gridColumns, 
          duration, 
          backgroundColor, 
          removeWinners,
          pool: participants,
          headers
        } as ChannelMessage),
    });

    // Auto-stop after duration
    if (duration > 0) {
      setTimeout(() => {
        stopRolling();
      }, duration * 1000);
    }
  };

  const stopRolling = async () => {
    // We need to use the ref for winners because state might be stale in closure
    const winners = pendingWinnersRef.current;
    
    setIsRolling(false);
    
    const newHistoryItem = {
      timestamp: new Date().toLocaleTimeString(),
      winners
    };
    setHistory(prev => [newHistoryItem, ...prev]);

    if (removeWinners) {
        setParticipants(prev => prev.filter(p => !winners.some(w => w.id === p.id)));
    } else {
        // If not removing, clear the predetermined flag so they don't auto-win next time?
        // Usually good practice.
        setParticipants(prev => prev.map(p => 
            winners.some(w => w.id === p.id) ? { ...p, isPredetermined: false } : p
        ));
    }
    
    if (channel) {
        channel.postMessage({ type: 'STOP_ROLL', winners });
    }

    await fetch('/api/draw-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'STOP_ROLL', winners } as ChannelMessage),
    });
  };

  const handleStop = () => {
    stopRolling();
  };

  const handleReset = () => {
    if (!channel) return;
    setIsRolling(false);
    setPendingWinners([]);
    // Do not clear history on reset, unless explicitly requested. 
    // Usually reset clears the display, not the history log.
    channel.postMessage({ type: 'RESET' });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      
      if (file.name.endsWith('.csv')) {
        Papa.parse(content, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const parsedData = results.data as any[];
            if (parsedData.length === 0) return;

            // Get headers from first row
            const fileHeaders = Object.keys(parsedData[0]).filter(h => h && h.trim() !== '');
            const limitedHeaders = fileHeaders.slice(0, 3); // Limit to 3 columns
            
            if (limitedHeaders.length === 0) {
                alert('No valid headers found.');
                return;
            }

            setHeaders(limitedHeaders);

            const validParticipants: Participant[] = parsedData.map((row, index) => {
                const data: Record<string, string> = {};
                limitedHeaders.forEach(h => {
                    data[h] = String(row[h] || '').trim();
                });
                return {
                    id: `csv-${index}-${Math.random().toString(36).substr(2, 9)}`,
                    data
                };
            });
            
            if (validParticipants.length > 0) {
              setParticipants(validParticipants);
              alert(`Loaded ${validParticipants.length} participants with columns: ${limitedHeaders.join(', ')}`);
            } else {
              alert('No valid participants found.');
            }
          },
          error: (err: Error) => {
            alert('Failed to parse CSV: ' + err.message);
          }
        });
      } else {
        // JSON logic... assuming array of objects
        try {
          const data = JSON.parse(content);
          if (Array.isArray(data) && data.length > 0) {
            const fileHeaders = Object.keys(data[0]).slice(0, 3);
            setHeaders(fileHeaders);
            
            const validParticipants: Participant[] = data.map((row, index) => ({
                id: `json-${index}-${Math.random().toString(36).substr(2, 9)}`,
                data: row
            }));

            setParticipants(validParticipants);
            alert(`Loaded ${data.length} participants with keys: ${fileHeaders.join(', ')}`);
          }
        } catch (err) {
          alert('Failed to parse JSON');
        }
      }
    };
    reader.readAsText(file);
  };

  const handleBackgroundChange = (color: string) => {
    setBackgroundColor(color);
    if (channel) {
      channel.postMessage({ type: 'UPDATE_BACKGROUND', color });
    }
  };

  const PASTEL_COLORS = [
    { name: 'Red', value: '#dc2626' }, // red-600
    { name: 'Blue', value: '#2563eb' }, // blue-600
    { name: 'Green', value: '#16a34a' }, // green-600
    { name: 'Pastel Gradient', value: 'linear-gradient(to bottom right, #fbcfe8, #c4b5fd)' }, // pink-200 to violet-300
    { name: 'Black', value: '#000000' },
    { name: 'White', value: '#ffffff' },
  ];

  const handleRemoveParticipant = (id: string) => {
    if (confirm('Are you sure you want to remove this participant?')) {
      setParticipants(prev => prev.filter(p => p.id !== id));
    }
  };

  const handleEditParticipant = (participant: Participant) => {
    setEditingId(participant.id);
    setEditForm({ ...participant });
  };

  const handleSaveEdit = () => {
    if (!editForm) return;
    setParticipants(prev => prev.map(p => p.id === editingId ? editForm : p));
    setEditingId(null);
    setEditForm(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const handleClearAll = () => {
    if (confirm('Are you sure you want to clear ALL participants? This cannot be undone.')) {
      setParticipants([]);
    }
  };

  const filteredParticipants = participants.filter(p => 
    Object.values(p.data).some(val => val.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-[1400px] mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">Admin Control Panel</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Settings (Smaller) */}
          <div className="space-y-6 lg:col-span-1">
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-xl font-semibold mb-6 text-gray-700 border-b pb-2">Draw Configuration</h2>
              
              <div className="mb-6">
                <label className="block text-gray-600 font-medium mb-2">Theme Color:</label>
                <div className="flex flex-wrap gap-3">
                  {PASTEL_COLORS.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => handleBackgroundChange(color.value)}
                      className={`w-10 h-10 rounded-full border shadow-sm transition-transform hover:scale-110 ${
                        backgroundColor === color.value ? 'ring-2 ring-blue-500 ring-offset-2' : ''
                      }`}
                      style={{ background: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 mb-6">
                <div>
                  <label className="block text-gray-600 font-medium mb-1">Winners:</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="50"
                    value={winnerCount}
                    onChange={(e) => setWinnerCount(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black"
                    disabled={isRolling}
                  />
                </div>
                
                <div>
                  <label className="block text-gray-600 font-medium mb-1">Columns (0=Auto):</label>
                  <input 
                    type="number" 
                    min="0" 
                    max="7"
                    value={gridColumns}
                    onChange={(e) => setGridColumns(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black"
                    disabled={isRolling}
                  />
                </div>

                <div>
                  <label className="block text-gray-600 font-medium mb-1">Duration (s):</label>
                  <input 
                    type="number" 
                    min="0" 
                    max="60"
                    value={duration}
                    onChange={(e) => setDuration(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black"
                    disabled={isRolling}
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={removeWinners}
                    onChange={(e) => setRemoveWinners(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    disabled={isRolling}
                  />
                  <span className="text-gray-700 font-medium select-none">Remove winners from pool</span>
                </label>
              </div>

              <div className="flex gap-4 pt-4 border-t">
                {!isRolling ? (
                  <button 
                    onClick={handleStart}
                    title="Shortcut: Spacebar"
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition shadow-md flex flex-col items-center justify-center"
                  >
                    <span>Start Rolling</span>
                    <span className="text-[10px] font-normal opacity-80 mt-0.5">(Spacebar)</span>
                  </button>
                ) : (
                  <button 
                    onClick={handleStop}
                    title="Shortcut: Spacebar"
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition shadow-md flex flex-col items-center justify-center"
                  >
                    <span>Stop & Reveal</span>
                    <span className="text-[10px] font-normal opacity-80 mt-0.5">(Spacebar)</span>
                  </button>
                )}
                
                <button 
                  onClick={handleReset}
                  disabled={isRolling}
                  className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-700 transition font-medium"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Draw History Section */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-700 border-b pb-2">Draw History</h2>
              <div className="space-y-4 max-h-[400px] overflow-y-auto">
                {history.length > 0 ? (
                  history.map((record, idx) => (
                    <div key={idx} className="border rounded-lg p-3 bg-gray-50 text-sm">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-gray-700">Time: {record.timestamp}</span>
                        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">{record.winners.length} Winners</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {record.winners.map((w, i) => (
                          <span key={i} className="bg-white border text-gray-600 px-2 py-0.5 rounded text-xs" title={JSON.stringify(w.data)}>
                            {Object.values(w.data)[1] || Object.values(w.data)[0]}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-gray-400 italic text-center py-4">No draws yet.</div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Data Management (Bigger) */}
          <div className="bg-white rounded-xl shadow-md p-6 flex flex-col h-full lg:col-span-2">
            <h2 className="text-xl font-semibold mb-6 text-gray-700 border-b pb-2">Participants Management</h2>
            
            <div className="flex flex-col gap-4 mb-6">
              <div className="flex gap-2">
                <label className="flex-1 cursor-pointer bg-blue-50 hover:bg-blue-100 text-blue-700 transition rounded-lg border border-blue-200 p-4 text-center group">
                  <div className="font-semibold">Import List</div>
                  <div className="text-xs text-blue-500 mt-1">JSON or CSV</div>
                  <input 
                    type="file" 
                    accept=".json,.csv" 
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
                
                <button 
                  onClick={handleClearAll}
                  className="px-4 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition"
                  title="Clear All Data"
                >
                  <span className="text-2xl">🗑️</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input 
                    type="text" 
                    placeholder="Search participants..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black"
                  />
                  <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
                </div>
                <div className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-2 rounded-lg">
                  Total: {participants.length}
                </div>
              </div>
            </div>
            
            <div className="border rounded-lg bg-white overflow-hidden shadow-inner flex-1 min-h-[400px]">
              <div className="overflow-y-auto h-full max-h-[600px]">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider bg-gray-50">Win</th>
                      {headers.map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider bg-gray-50">{h}</th>
                      ))}
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider bg-gray-50">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredParticipants.length > 0 ? (
                      filteredParticipants.map((participant) => (
                        <tr key={participant.id} className="hover:bg-blue-50 transition-colors">
                          {editingId === participant.id && editForm ? (
                            <>
                              <td className="px-2 py-2"></td>
                              {headers.map(h => (
                                <td key={h} className="px-2 py-2">
                                    <input 
                                    value={editForm.data[h] || ''} 
                                    onChange={e => setEditForm({
                                        ...editForm, 
                                        data: { ...editForm.data, [h]: e.target.value }
                                    })}
                                    className="w-full border rounded px-2 py-1 text-sm text-black focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </td>
                              ))}
                              <td className="px-2 py-2 text-right space-x-1 whitespace-nowrap">
                                <button onClick={handleSaveEdit} className="text-green-600 hover:bg-green-100 p-1 rounded transition">✅</button>
                                <button onClick={handleCancelEdit} className="text-gray-500 hover:bg-gray-100 p-1 rounded transition">❌</button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                <input 
                                  type="checkbox" 
                                  checked={!!participant.isPredetermined} 
                                  onChange={(e) => handleTogglePredetermined(participant.id, e.target.checked)}
                                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                                />
                              </td>
                              {headers.map(h => (
                                <td key={h} className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                    {participant.data[h]}
                                </td>
                              ))}
                              <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                                <button 
                                  onClick={() => handleEditParticipant(participant)}
                                  className="text-blue-600 hover:text-blue-900 mr-3 transition"
                                  title="Edit"
                                >
                                  ✏️
                                </button>
                                <button 
                                  onClick={() => handleRemoveParticipant(participant.id)}
                                  className="text-red-600 hover:text-red-900 transition"
                                  title="Delete"
                                >
                                  🗑️
                                </button>
                              </td>
                            </>
                          )}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={headers.length + 2} className="px-6 py-8 text-center text-gray-400 italic">
                          {participants.length === 0 ? 'No participants loaded.' : 'No matches found.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        
        <div className="text-xs text-gray-400 mt-6 text-center">
          Note: Open the Display Page in a separate tab. Changes made here are reflected immediately.
        </div>
      </div>
    </div>
  );
}

