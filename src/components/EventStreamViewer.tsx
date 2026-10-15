import React, { useState, useEffect } from 'react';
import { Radio, Pause, Play, Trash2, ArrowUpRight, Code, ShieldCheck } from 'lucide-react';
import { WikiEvent } from '../types';
import { api } from '../api';
import { subscribeToFirestoreEvents } from '../firebase';

interface EventStreamViewerProps {
  onNavigateArticle: (slug: string) => void;
}

export const EventStreamViewer: React.FC<EventStreamViewerProps> = ({ onNavigateArticle }) => {
  const [events, setEvents] = useState<WikiEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [paused, setPaused] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<WikiEvent | null>(null);
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    // 1. Subscribe to Firebase Firestore real-time events
    const unsubFirestore = subscribeToFirestoreEvents(cloudEvents => {
      if (!paused && cloudEvents.length > 0) {
        setEvents(cloudEvents);
        setConnected(true);
      }
    });

    // 2. Setup SSE connection to EventGate microservice as secondary stream
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/v1/events/stream');
      eventSource.onopen = () => setConnected(true);
      eventSource.onmessage = (e) => {
        if (paused) return;
        try {
          const parsed = JSON.parse(e.data);
          if (parsed.type === 'connected') return;
          setEvents(prev => {
            if (prev.some(x => x.id === parsed.id)) return prev;
            return [parsed as WikiEvent, ...prev.slice(0, 99)];
          });
        } catch {
          // Ignore parse errors
        }
      };
      eventSource.onerror = () => {
        // Keeps connected true if firestore is active
      };
    } catch {
      // EventSource failed
    }

    return () => {
      unsubFirestore();
      if (eventSource) eventSource.close();
    };
  }, [paused]);

  const filteredEvents = filterType === 'all'
    ? events
    : events.filter(e => e.type === filterType);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-emerald-600 animate-pulse" />
            <h1 className="text-xl font-semibold text-slate-900">
              Wikimedia EventStreams & EventGate Real-time Bus
            </h1>
          </div>
          <div className="text-xs text-slate-500 font-sans mt-0.5">
            Streaming via Server-Sent Events (SSE) on topic: <code className="font-mono text-slate-700">mediawiki.recentchange</code>
          </div>
        </div>

        {/* Live Status and Stream Actions */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            <span className={connected ? 'text-emerald-700 font-medium' : 'text-rose-700'}>
              {connected ? 'BROKER CONNECTED' : 'DISCONNECTED'}
            </span>
          </div>

          <button
            onClick={() => setPaused(!paused)}
            className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded text-xs font-medium text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {paused ? <Play className="w-3.5 h-3.5 text-emerald-600" /> : <Pause className="w-3.5 h-3.5 text-amber-600" />}
            {paused ? 'Resume Stream' : 'Pause Stream'}
          </button>

          <button
            onClick={() => setEvents([])}
            className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded text-xs font-medium text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-slate-400" />
            Clear Feed
          </button>
        </div>
      </div>

      {/* Filter bar (Segmented controls) */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Filter Topic:</span>
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded">
          {['all', 'edit', 'new', 'rollback'].map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1 font-medium rounded transition-colors uppercase text-[11px] ${
                filterType === type ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-slate-400 font-mono">
          Buffer: {filteredEvents.length} events
        </span>
      </div>

      {/* Main Grid: Stream Feed + JSON Inspection Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Stream List */}
        <div className="lg:col-span-7 space-y-2">
          {filteredEvents.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-slate-200 rounded text-xs text-slate-400">
              No recent change events captured. Edit an article to emit events!
            </div>
          ) : (
            filteredEvents.map(evt => {
              const isSelected = selectedEvent?.id === evt.id;
              const typeColor =
                evt.type === 'new'
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                  : evt.type === 'rollback'
                  ? 'text-rose-700 bg-rose-50 border-rose-200'
                  : 'text-blue-700 bg-blue-50 border-blue-200';

              return (
                <div
                  key={evt.id}
                  onClick={() => setSelectedEvent(evt)}
                  className={`p-3 bg-white border rounded transition-all cursor-pointer ${
                    isSelected ? 'border-blue-600 ring-2 ring-blue-100' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] uppercase font-mono font-bold px-1.5 py-0.5 rounded border ${typeColor}`}>
                        {evt.type}
                      </span>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          onNavigateArticle(evt.page_title.replace(/\s+/g, '_'));
                        }}
                        className="font-semibold text-sm text-slate-900 hover:text-blue-600 hover:underline text-left"
                      >
                        {evt.page_title}
                      </button>
                    </div>

                    <span className="text-[11px] font-mono text-slate-400">
                      {new Date(evt.meta.dt).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 italic mt-1 line-clamp-1">
                    &ldquo;{evt.comment || 'No summary'}&rdquo;
                  </div>

                  {/* Zero-Pill Unboxed Metadata (strict adherence to frontend-design constitution) */}
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mt-2 font-mono">
                    <span className="font-semibold text-slate-700 font-sans">{evt.user_text}</span>
                    <span aria-hidden="true">·</span>
                    <span>{evt.rev_len} bytes</span>
                    <span aria-hidden="true">·</span>
                    <span>sha1: {evt.rev_sha1}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-slate-400">rev: {evt.rev_id}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Schema Inspector & Details */}
        <div className="lg:col-span-5">
          <div className="sticky top-28 border border-slate-200 rounded bg-slate-900 text-slate-100 p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2 mb-3">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Code className="w-3.5 h-3.5 text-blue-400" />
                EventGate Payload Inspector
              </span>
              <span className="text-[10px] font-mono text-emerald-400">JSONSchema v2.0</span>
            </div>

            {selectedEvent ? (
              <div>
                <div className="text-[11px] text-slate-400 mb-2 font-mono">
                  Payload for event ID: <span className="text-blue-300">{selectedEvent.id}</span>
                </div>
                <pre className="text-[11px] font-mono bg-slate-950 p-3 rounded border border-slate-800 overflow-x-auto max-h-[460px] text-emerald-300 leading-tight">
                  {JSON.stringify(selectedEvent, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-500 font-sans">
                Select any event card on the left to inspect its complete JSON payload and Wikimedia EventStreams metadata.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
