import { useEffect, useMemo, useRef, useState } from 'react';
import type { EventRecord, Page } from '../types';
import { deleteEventDocument, getEventDocumentBytes, getEventDocuments, getEvents, uploadEventDocument, type EventDocumentRecord } from '../services/api';

interface DocumentationProps { eventId: string; navigate: (page: Page, eventId?: string) => void; }
const categories = [
  'Event Proposal / Permission Letter', 'Event Circular / Invitation', 'Resource Person / Guest Documents',
  'Attendance Documents', 'Feedback Documents', 'Event Photographs', 'Supporting Documents', 'Other'
];
const maxSize = 100 * 1024 * 1024;
const formatSize = (bytes = 0) => bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const formatDate = (value: string) => new Date(value).toLocaleDateString('en-IN');

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
  useEffect(() => { getEvents().then(data => { setEvents(data); if (!selectedId && data[0]) setSelectedId(data[0].id); }).catch(() => setError('Unable to load events.')); }, []);
  useEffect(() => { if (!selectedId || selectedId === '__other__') { setDocuments([]); return; } setLoading(true); setError(''); getEventDocuments(selectedId).then(setDocuments).catch(() => { setDocuments([]); setError('Unable to load documents for this event.'); }).finally(() => setLoading(false)); }, [selectedId]);

  const validate = (file: File) => {
    if (file.size > maxSize) return 'File exceeds the 100 MB upload limit.';
    const name = documentName.trim() || file.name;
    if (documents.some(document => document.name === name && document.category === category)) return 'A document with this name is already uploaded in this category.';
    return '';
  };
  const upload = async (file: File) => {
    if (selectedId === '__other__') {
      setError('Create the event first, then select its saved event record before uploading documents.');
      return;
    }
    const validation = validate(file); if (validation) { setError(validation); return; }
    setError(''); setProgress(1);
    try { const uploaded = await uploadEventDocument(selectedId, file, category, documentName.trim() || file.name, setProgress); setDocuments(previous => [...previous, uploaded].sort((a, b) => a.order - b.order)); setDocumentName(''); }
    catch (uploadError) {
      console.error('Document upload failed:', uploadError);
      const responseMessage = uploadError && typeof uploadError === 'object' && 'response' in uploadError
        ? (uploadError.response as { data?: { message?: string } })?.data?.message
        : undefined;
      setError(responseMessage || (uploadError instanceof Error ? uploadError.message : 'Upload failed. Please try again.'));
    }
    finally { setProgress(0); }
  };
  const preview = async (fileRecord: EventDocumentRecord) => { try { const bytes = await getEventDocumentBytes(fileRecord.url); const url = URL.createObjectURL(new Blob([bytes], { type: fileRecord.mimeType || fileRecord.type })); window.open(url, '_blank', 'noopener,noreferrer'); setTimeout(() => URL.revokeObjectURL(url), 60000); } catch { setError('Unable to open this document.'); } };
  const download = async (fileRecord: EventDocumentRecord) => { try { const bytes = await getEventDocumentBytes(fileRecord.url); const url = URL.createObjectURL(new Blob([bytes], { type: fileRecord.mimeType || fileRecord.type })); const link = window.document.createElement('a'); link.href = url; link.download = fileRecord.name; link.click(); URL.revokeObjectURL(url); } catch { setError('Unable to download this document.'); } };
  const remove = async (fileRecord: EventDocumentRecord) => { if (!window.confirm(`Delete ${fileRecord.name}?`)) return; try { await deleteEventDocument(fileRecord.id); setDocuments(previous => previous.filter(item => item.id !== fileRecord.id)); } catch { setError('Unable to delete this document.'); } };

  return <div className="p-6 space-y-5 min-h-screen bg-slate-50">
    <div><button onClick={() => navigate('dashboard')} className="text-sm text-indigo-600 mb-2">← Back to Dashboard</button><h1 className="text-3xl font-bold text-slate-900">Event Documentation</h1><p className="text-sm text-slate-500 mt-1">Upload and manage original documents and photographs for one selected event.</p></div>
    <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm"><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><label className="text-xs font-semibold text-slate-600">Enter event name<input value={eventSearch} onChange={event => setEventSearch(event.target.value)} placeholder="Type event name or event ID" className="block mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" /></label><label className="text-xs font-semibold text-slate-600">Currently selected event<select value={selectedId} onChange={event => setSelectedId(event.target.value)} className="block mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">{eventOptions.length ? eventOptions.map(item => <option key={item.id} value={item.id}>{item.name} ({item.id})</option>) : <option value="">No matching events</option>}<option value="__other__">Other (enter event name)</option></select></label></div>{selectedId === '__other__' && <div className="mt-3"><label className="text-xs font-semibold text-slate-600">Other event name<input value={customEventName} onChange={event => setCustomEventName(event.target.value)} placeholder="Enter the event name" className="block mt-1 w-full max-w-2xl px-3 py-2 border border-slate-200 rounded-lg text-sm" /></label><p className="text-xs text-amber-600 mt-2">This name is for identification only. Save the event first so its documents can be linked to a real event ID.</p></div>}{selectedEvent && <p className="text-xs text-slate-500 mt-3">{selectedEvent.department} · {selectedEvent.date} · Event ID: {selectedEvent.id}</p>}</section>
    <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4"><div className="flex flex-wrap gap-3"><select value={category} onChange={event => setCategory(event.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">{categories.map(item => <option key={item}>{item}</option>)}</select><input value={documentName} onChange={event => setDocumentName(event.target.value)} placeholder="Document name (optional)" className="px-3 py-2 border border-slate-200 rounded-lg text-sm flex-1 min-w-56" /><button disabled={selectedId === '__other__'} onClick={() => inputRef.current?.click()} className="px-4 py-2 bg-indigo-600 disabled:bg-slate-300 text-white rounded-lg text-sm font-semibold">Browse Files</button><input ref={inputRef} type="file" className="hidden" onChange={event => event.target.files?.[0] && upload(event.target.files[0])} /></div><p className="text-xs text-slate-500">Any file type is accepted. Maximum upload size: 100 MB. Choose <strong>Other</strong> and enter any name when uploading an additional event document.</p><div onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); event.dataTransfer.files[0] && upload(event.dataTransfer.files[0]); }} className={`border-2 border-dashed rounded-xl p-8 text-center ${dragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'}`}><p className="text-sm text-slate-600">Drag and drop a file here</p><p className="text-xs text-slate-400 mt-1">PDF, documents, spreadsheets, archives, images, videos, and other normal file formats</p></div>{progress > 0 && <div><div className="h-2 bg-slate-100 rounded"><div className="h-2 bg-indigo-600 rounded" style={{ width: `${progress}%` }} /></div><p className="text-xs text-slate-500 mt-1">Uploading {progress}%</p></div>}{error && <p className="text-sm text-red-600">{error}</p>}</section>
    <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden"><div className="p-5 border-b border-slate-100 flex justify-between"><h2 className="font-bold text-slate-800">Uploaded Documents and Photos</h2><span className="text-sm text-slate-500">{documents.length} file(s)</span></div>{loading ? <p className="p-8 text-center text-slate-500">Loading documents...</p> : documents.length === 0 ? <p className="p-8 text-center text-slate-500">No documents uploaded</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-slate-50 text-left"><th className="p-3">Document Name</th><th className="p-3">Category</th><th className="p-3">File Type</th><th className="p-3">Size</th><th className="p-3">Uploaded Date</th><th className="p-3">Status</th><th className="p-3">Actions</th></tr></thead><tbody>{documents.map(document => <tr key={document.id} className="border-t border-slate-100"><td className="p-3 font-medium">{document.name}</td><td className="p-3">{document.category}</td><td className="p-3">{document.mimeType || document.type || '—'}</td><td className="p-3">{formatSize(document.size)}</td><td className="p-3">{formatDate(document.uploadedDate)}</td><td className="p-3"><span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs">{document.status}</span></td><td className="p-3 flex gap-2"><button onClick={() => preview(document)} className="text-indigo-600 text-xs">Preview</button><button onClick={() => download(document)} className="text-green-600 text-xs">Download</button><button onClick={() => remove(document)} className="text-red-600 text-xs">Delete</button></td></tr>)}</tbody></table></div>}</section>
  </div>;
}
