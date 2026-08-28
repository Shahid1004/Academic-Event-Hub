import { useState } from 'react';
import type { AppSettings, UserProfile, UserRole } from '../types';
import { updateProfile, updateSettings } from '../services/api';
import UserManagement from './UserManagement';

type SettingsTab = 'profile' | 'academic-year' | 'departments' | 'event-types' | 'doc-categories' | 'notifications' | 'users' | 'system';

interface SettingsProps {
  currentUserRole: UserRole;
  profile: UserProfile;
  settings: AppSettings | null;
  onProfileChange: (profile: UserProfile) => void;
  onSettingsChange: (settings: AppSettings) => void;
}

const notificationLabels: Record<string, string> = {
  attendancePending: 'Attendance pending reminder',
  feedbackCompleted: 'Feedback collection completed',
  paymentPending: 'Payment document pending',
  reportGenerated: 'Event report generated',
  documentationCompleted: 'Documentation completed',
  upcomingEvent: 'Upcoming event reminder',
  newEventAssigned: 'New event assigned'
};

const getInitials = (name: string) => name.trim().split(/\s+/).map(word => word[0]).join('').slice(0, 2).toUpperCase() || 'U';

export default function Settings({ currentUserRole, profile, settings, onProfileChange, onSettingsChange }: SettingsProps) {
  const [tab, setTab] = useState<SettingsTab>('profile');
  const [draftProfile, setDraftProfile] = useState(profile);
  const [newYear, setNewYear] = useState('');
  const [newType, setNewType] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const canEditGlobal = currentUserRole === 'admin' || currentUserRole === 'hod';

  const saveProfile = async () => {
    setSaving(true);
    try {
      const saved = await updateProfile(draftProfile);
      onProfileChange(saved);
      setMessage('Profile saved.');
    } catch (error: any) {
      setMessage(error.response?.data?.message || 'Unable to save profile.');
    } finally { setSaving(false); }
  };

  const saveSettings = async (patch: Partial<AppSettings>) => {
    if (!settings) return;
    setSaving(true);
    try {
      const saved = await updateSettings(patch);
      onSettingsChange(saved);
      setMessage('Settings saved.');
    } catch (error: any) {
      setMessage(error.response?.data?.message || 'Unable to save settings.');
    } finally { setSaving(false); }
  };

  const addItem = async (key: 'eventTypes' | 'documentCategories', value: string, clear: (value: string) => void) => {
    if (!settings || !canEditGlobal || !value.trim() || settings[key].includes(value.trim())) return;
    clear('');
    await saveSettings({ [key]: [...settings[key], value.trim()] });
  };

  if (!settings) return <div className="p-6 text-slate-500">Loading settings...</div>;

  const tabs: { id: SettingsTab; label: string; icon: string }[] = [
    { id: 'profile', label: 'Profile', icon: '👤' },
    { id: 'academic-year', label: 'Academic Year', icon: '📅' },
    { id: 'departments', label: 'Departments', icon: '🏢' },
    { id: 'event-types', label: 'Event Types', icon: '🎯' },
    { id: 'doc-categories', label: 'Document Categories', icon: '📁' },
    { id: 'notifications', label: 'Notifications', icon: '🔔' },
    ...(currentUserRole !== 'coordinator' ? [{ id: 'users' as SettingsTab, label: 'User Management', icon: '👥' }] : []),
    { id: 'system', label: 'Appearance', icon: '⚙️' }
  ];
  const inputCls = 'w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50';
  const cardCls = 'bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4';

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold font-heading text-slate-900 mb-6">Settings</h1>
      <div className="flex flex-col lg:flex-row gap-5">
        <div className="w-full lg:w-56 flex-shrink-0">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {tabs.map(item => <button key={item.id} onClick={() => setTab(item.id)} className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left border-b border-slate-50 ${tab === item.id ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}><span>{item.icon}</span><span>{item.label}</span></button>)}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {message && <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

          {tab === 'profile' && <div className={cardCls}>
            <h3 className="font-bold font-heading text-slate-800">Profile Settings</h3>
            <div className="flex items-center gap-4 mb-2"><div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold">{getInitials(draftProfile.name)}</div><div><div className="font-semibold text-slate-800">{draftProfile.name}</div><div className="text-sm text-slate-500">{draftProfile.role} · {draftProfile.department}</div></div></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {([['name', 'Full Name'], ['employeeId', 'Employee ID'], ['email', 'Email'], ['phone', 'Phone'], ['designation', 'Designation']] as const).map(([key, label]) => <div key={key}><label className="block text-xs font-medium text-slate-600 mb-1">{label}</label><input value={draftProfile[key] || ''} onChange={event => setDraftProfile({ ...draftProfile, [key]: event.target.value })} className={inputCls} /></div>)}
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Avatar color</label><select value={draftProfile.avatarColor || 'indigo'} onChange={event => setDraftProfile({ ...draftProfile, avatarColor: event.target.value })} className={inputCls}><option value="indigo">Indigo</option><option value="blue">Blue</option><option value="teal">Teal</option><option value="rose">Rose</option></select></div>
            </div>
            <button disabled={saving} onClick={saveProfile} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium">{saving ? 'Saving...' : 'Save Changes'}</button>
          </div>}

          {tab === 'academic-year' && <div className={cardCls}><h3 className="font-bold font-heading text-slate-800">Academic Year Management</h3><div className="space-y-2">{settings.academicYears.map(year => <div key={year.name} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl"><span className="text-sm font-medium text-slate-700">{year.name}{year.current ? ' (Current)' : ''}</span>{canEditGlobal && <div className="flex gap-2">{!year.current && <button onClick={() => saveSettings({ academicYears: settings.academicYears.map(item => ({ ...item, current: item.name === year.name })) })} className="text-xs text-blue-600 border border-blue-200 px-2 py-1 rounded-lg">Set current</button>}{!year.current && <button onClick={() => saveSettings({ academicYears: settings.academicYears.filter(item => item.name !== year.name) })} className="text-xs text-red-500 border border-red-200 px-2 py-1 rounded-lg">Delete</button>}</div>}</div>)}</div>{canEditGlobal && <div className="flex gap-2"><input value={newYear} onChange={event => setNewYear(event.target.value)} placeholder="2027-28" className={inputCls} /><button onClick={() => { if (newYear.trim()) { saveSettings({ academicYears: [...settings.academicYears, { name: newYear.trim(), current: false }] }); setNewYear(''); } }} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium">Add</button></div>}</div>}

          {tab === 'departments' && <div className={cardCls}><h3 className="font-bold font-heading text-slate-800">Department Management</h3>{settings.departments.map(department => <div key={department.code} className="p-4 bg-slate-50 rounded-xl"><div className="font-semibold text-slate-800">{department.name} <span className="text-xs text-slate-400">({department.code})</span></div><div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3"><input disabled={!canEditGlobal} value={department.hod} placeholder="HOD name" onChange={event => saveSettings({ departments: settings.departments.map(item => item.code === department.code ? { ...item, hod: event.target.value } : item) })} className={inputCls} /><input disabled={!canEditGlobal} type="number" value={department.strength} onChange={event => saveSettings({ departments: settings.departments.map(item => item.code === department.code ? { ...item, strength: Number(event.target.value) } : item) })} className={inputCls} /><span className="text-xs text-slate-500 self-center">Student strength</span></div></div>)}</div>}

          {tab === 'event-types' && <div className={cardCls}><h3 className="font-bold font-heading text-slate-800">Event Types</h3><div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{settings.eventTypes.map(item => <div key={item} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl"><span className="text-sm text-slate-700">{item}</span>{canEditGlobal && <button onClick={() => saveSettings({ eventTypes: settings.eventTypes.filter(type => type !== item) })} className="text-xs text-slate-400 hover:text-red-500">✕</button>}</div>)}</div>{canEditGlobal && <div className="flex gap-2"><input value={newType} onChange={event => setNewType(event.target.value)} placeholder="Add event type" className={inputCls} /><button onClick={() => addItem('eventTypes', newType, setNewType)} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium">Add</button></div>}</div>}

          {tab === 'doc-categories' && <div className={cardCls}><h3 className="font-bold font-heading text-slate-800">Document Categories</h3><div className="space-y-2">{settings.documentCategories.map(item => <div key={item} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl"><span className="text-sm text-slate-700">{item}</span>{canEditGlobal && <button onClick={() => saveSettings({ documentCategories: settings.documentCategories.filter(category => category !== item) })} className="text-xs text-red-500">Delete</button>}</div>)}</div>{canEditGlobal && <div className="flex gap-2"><input value={newCategory} onChange={event => setNewCategory(event.target.value)} placeholder="Add document category" className={inputCls} /><button onClick={() => addItem('documentCategories', newCategory, setNewCategory)} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium">Add</button></div>}</div>}

          {tab === 'notifications' && <div className={cardCls}><h3 className="font-bold font-heading text-slate-800">Notification Settings</h3>{Object.entries(settings.notifications).map(([key, checked]) => <label key={key} className="flex items-center justify-between py-2 border-b border-slate-100"><span className="text-sm text-slate-700">{notificationLabels[key] || key}</span><input type="checkbox" checked={checked} onChange={event => saveSettings({ notifications: { ...settings.notifications, [key]: event.target.checked } })} className="h-4 w-4 accent-indigo-600" /></label>)}</div>}

          {tab === 'users' && currentUserRole !== 'coordinator' && <UserManagement currentUserRole={currentUserRole} />}

          {tab === 'system' && <div className={cardCls}><h3 className="font-bold font-heading text-slate-800">Appearance</h3><div><label className="block text-xs font-medium text-slate-600 mb-1">Color mode</label><select value={settings.theme.mode} onChange={event => saveSettings({ theme: { ...settings.theme, mode: event.target.value as 'light' | 'dark' } })} className={inputCls}><option value="light">Light</option><option value="dark">Dark</option></select></div><div><label className="block text-xs font-medium text-slate-600 mb-1">Contrast</label><select value={settings.theme.contrast} onChange={event => saveSettings({ theme: { ...settings.theme, contrast: event.target.value as 'normal' | 'high' } })} className={inputCls}><option value="normal">Normal contrast</option><option value="high">High contrast</option></select></div><div><label className="block text-xs font-medium text-slate-600 mb-1">Accent color</label><div className="flex gap-2">{(['indigo', 'blue', 'teal', 'rose'] as const).map(accent => <button key={accent} onClick={() => saveSettings({ theme: { ...settings.theme, accent } })} className={`w-9 h-9 rounded-full bg-${accent}-600 ring-2 ${settings.theme.accent === accent ? 'ring-slate-900' : 'ring-transparent'}`} aria-label={`${accent} accent`} />)}</div></div></div>}
        </div>
      </div>
    </div>
  );
}