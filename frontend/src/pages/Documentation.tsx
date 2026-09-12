import { useEffect, useMemo, useRef, useState } from 'react';
import type { EventRecord, Page } from '../types';
import { deleteEventDocument, getEventDocumentBytes, getEventDocuments, getEvents, uploadEventDocument, type EventDocumentRecord } from '../services/api';

interface DocumentationProps { eventId: string; navigate: (page: Page, eventId?: string) => void; }

const categories = [
  'Event Proposal / Permission Letter',
  'Event Circular / Invitation',
  'Resource Person / Guest Documents',
  'Attendance Documents',
  'Feedback Documents',
  'Event Photographs',
  'Supporting Documents',
  'Other'
];

const maxSize = 100 * 1024 * 1024;
const formatSize = (bytes = 0) => bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const formatDate = (value?: string) => value ? new Date(value).toLocaleDateString('en-IN') : '—';

export default function Documentation({ eventId, navigate }: DocumentationProps) {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [selectedId, setSelectedId] = useState(eventId);
  const [eventSearch, setEventSearch] = useState('');
  const [customEventName, setCustomEventName] = useState('');
  const [documents, setDocuments] = useState<EventDocumentRecord[]>([]);
  const [category, setCategory] = useState(categories[0]);
  const [documentName, setDocumentName] = useState('');
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedEvent = useMemo(() => events.find(event => event.id === selectedId), [events, selectedId]);
  const eventOptions = useMemo(() => {
    const search = eventSearch.trim().toLowerCase();
    return search ? events.filter(event => `${event.name} ${event.id}`.toLowerCase().includes(search)) : events;
  }, [events, eventSearch]);

  useEffect(() => { if (eventId) setSelectedId(eventId); }, [eventId]);
  useEffect(() => {
    getEvents().then(data => { setEvents(data); if (!selectedId && data[0]) setSelectedId(data[0].id); }).catch(() => setError('Unable to load events.'));
  }, []);
  useEffect(() => {
    if (!selectedId || selectedId === '__other__') { setDocuments([]); return; }
    setLoading(true); setError('');
    getEventDocuments(selectedId).then(setDocuments).catch(() => { setDocuments([]); setError('Unable to load documents for this event.'); }).finally(() => setLoading(false));
  }, [selectedId]);

  const validate = (file: File) => {
    if (file.size > maxSize) return 'File exceeds the 100 MB upload limit.';
    const name = documentName.trim() || file.name;
    if (documents.some(document => document.name === name && document.category === category)) return 'A document with this name is already uploaded in this category.';
    return '';
  };

  const upload = async (file: File) => {
    if (selectedId === '__other__') { setError('Create the event first, then select its saved event record before uploading documents.'); return; }
    const validation = validate(file); if (validation) { setError(validation); return; }
    setError(''); setProgress(1);
    try {
      const uploaded = await uploadEventDocument(selectedId, file, category, documentName.trim() || file.name, setProgress);
      setDocuments(previous => [...previous, uploaded].sort((a, b) => a.order - b.order));
      setDocumentName('');
    } catch (uploadError) {
      console.error('Document upload failed:', uploadError);
      const responseMessage = uploadError && typeof uploadError === 'object' && 'response' in uploadError
        ? (uploadError.response as { data?: { message?: string } })?.data?.message
        : undefined;
      setError(responseMessage || (uploadError instanceof Error ? uploadError.message : 'Upload failed. Please try again.'));
    } finally { setProgress(0); }
  };

  const preview = async (fileRecord: EventDocumentRecord) => {
    try {
      const bytes = await getEventDocumentBytes(fileRecord.url);
      const url = URL.createObjectURL(new Blob([bytes], { type: fileRecord.mimeType || fileRecord.type }));
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch { setError('Unable to open this document.'); }
  };

  const download = async (fileRecord: EventDocumentRecord) => {
    try {
      const bytes = await getEventDocumentBytes(fileRecord.url);
      const url = URL.createObjectURL(new Blob([bytes], { type: fileRecord.mimeType || fileRecord.type }));
      const link = window.document.createElement('a');
      link.href = url; link.download = fileRecord.name; link.click();
      URL.revokeObjectURL(url);
    } catch { setError('Unable to download this document.'); }
  };

  const remove = async (fileRecord: EventDocumentRecord) => {
    if (!window.confirm(`Delete "${fileRecord.name}"?`)) return;
    try { await deleteEventDocument(fileRecord.id); setDocuments(previous => previous.filter(item => item.id !== fileRecord.id)); }
    catch { setError('Unable to delete this document.'); }
  };

  const inputCls = "w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all";
  const labelCls = "block text-xs font-semibold text-slate-700 mb-1.5";

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 pb-4 border-b border-slate-200/80">
        <button
          onClick={() => navigate('dashboard')}
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
          title="Back to Dashboard"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold font-heading text-slate-900 tracking-tight">Compliance Documentation Vault</h1>
          <p className="text-slate-500 text-xs font-medium mt-0.5">Upload and manage original proof documents, permission letters, photos and certificates for NAAC audit</p>
        </div>
      </div>

      {/* Event Selector */}
      <section className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
        <h2 className="font-bold font-heading text-slate-900 text-sm pb-2 border-b border-slate-100">Select Target Event Record</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Search Events Catalog</label>
            <input
              value={eventSearch}
              onChange={e => setEventSearch(e.target.value)}
              placeholder="Search by event title or event ID..."
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Selected Event</label>
            <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className={inputCls}>
              {eventOptions.length ? eventOptions.map(item => <option key={item.id} value={item.id}>{item.name} ({item.id})</option>) : <option value="">No matching events</option>}
              <option value="__other__">Other (enter event name manually)</option>
            </select>
          </div>
        </div>

        {selectedId === '__other__' && (
          <div className="mt-3">
            <label className={labelCls}>Other Event Title</label>
            <input value={customEventName} onChange={e => setCustomEventName(e.target.value)} placeholder="Enter the event title..." className={inputCls} />
            <p className="text-xs text-amber-600 font-medium mt-1.5">Note: Create the event first so documents link directly to the database ID.</p>
          </div>
        )}

        {selectedEvent && (
          <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-600 font-medium">
            <span className="font-bold text-slate-800">{selectedEvent.name}</span>
            <span>&bull;</span>
            <span>Dept: <strong className="text-indigo-600">{selectedEvent.department}</strong></span>
            <span>&bull;</span>
            <span>Date: <strong>{selectedEvent.date}</strong></span>
            <span>&bull;</span>
            <span className="font-mono text-slate-400">ID: {selectedEvent.id}</span>
          </div>
        )}
      </section>

      {/* Upload Form */}
      <section className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
        <h2 className="font-bold font-heading text-slate-900 text-sm pb-2 border-b border-slate-100">Upload Audit Proof</h2>

        <div className="flex flex-wrap gap-3">
          <select value={category} onChange={e => setCategory(e.target.value)} className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
            {categories.map(item => <option key={item} value={item}>{item}</option>)}
          </select>

          <input
            value={documentName}
            onChange={e => setDocumentName(e.target.value)}
            placeholder="Custom Document Label (optional)"
            className="flex-1 min-w-[220px] px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />

          <button
            disabled={selectedId === '__other__'}
            onClick={() => inputRef.current?.click()}
            className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-500/20 disabled:opacity-50 transition-all whitespace-nowrap"
          >
            Browse & Upload File
          </button>
          <input ref={inputRef} type="file" className="hidden" onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />
        </div>

        {/* Drag & Drop Area */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); e.dataTransfer.files[0] && upload(e.dataTransfer.files[0]); }}
          className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
            dragging ? 'border-indigo-500 bg-indigo-50/60' : 'border-slate-200/80 bg-slate-50/30 hover:border-slate-300'
          }`}
        >
          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <p className="text-xs font-semibold text-slate-700">Drag and drop file here or click Browse</p>
          <p className="text-[11px] text-slate-400 mt-1">PDF, Images, Word, Excel & ZIP files up to 100 MB</p>
        </div>

        {progress > 0 && (
          <div className="space-y-1">
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-600 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-[11px] font-semibold text-indigo-600">Uploading: {progress}%</p>
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
            {error}
          </div>
        )}
      </section>

      {/* Document Table */}
      <section className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <h2 className="font-bold font-heading text-slate-900 text-sm">Uploaded Event Documents ({documents.length})</h2>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs font-medium">
            Loading document repository...
          </div>
        ) : documents.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            No compliance documents uploaded for this event yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  {['Document Name', 'Category', 'File Type', 'Size', 'Uploaded Date', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {documents.map((document, i) => (
                  <tr key={document.id} className={`hover:bg-indigo-50/30 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                    <td className="px-4 py-3.5 font-semibold text-slate-800">{document.originalFilename || document.name}</td>
                    <td className="px-4 py-3.5 text-slate-600 font-medium">{document.category}</td>
                    <td className="px-4 py-3.5 text-slate-500 font-mono text-[11px]">{document.mimeType || document.type || '—'}</td>
                    <td className="px-4 py-3.5 text-slate-500 font-medium">{formatSize(document.size)}</td>
                    <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">{formatDate(document.uploadedAt || document.uploadedDate)}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                        {document.status || 'Uploaded'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => preview(document)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-all"
                        >
                          Preview
                        </button>
                        <button
                          onClick={() => download(document)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-all"
                        >
                          Download
                        </button>
                        <button
                          onClick={() => remove(document)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-all"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
