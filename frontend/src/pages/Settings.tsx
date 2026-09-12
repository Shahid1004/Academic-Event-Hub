import React, { useState } from 'react';
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
      setMessage('Profile saved successfully.');
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
      setMessage('Settings updated successfully.');
    } catch (error: any) {
      setMessage(error.response?.data?.message || 'Unable to save settings.');
    } finally { setSaving(false); }
  };

  const addItem = async (key: 'eventTypes' | 'documentCategories', value: string, clear: (value: string) => void) => {
    if (!settings || !canEditGlobal || !value.trim() || settings[key].includes(value.trim())) return;
    clear('');
    await saveSettings({ [key]: [...settings[key], value.trim()] });
  };

  if (!settings) return (
    <div className="p-8 text-center text-slate-400 font-medium text-xs">
      Loading settings configuration...
    </div>
  );

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'profile', label: 'My Account Profile', icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
    },
    {
      id: 'academic-year', label: 'Academic Years', icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      id: 'departments', label: 'Departments', icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h5m-5 0V11m0 0H9m4 0h2" />
        </svg>
      )
    },
    {
      id: 'event-types', label: 'Event Taxonomy', icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 11h.01M7 15h.01M11 7h8M11 11h8M11 15h8" />
        </svg>
      )
    },
    {
      id: 'doc-categories', label: 'Document Categories', icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      )
    },
    {
      id: 'notifications', label: 'Notifications', icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      )
    },
    ...(currentUserRole !== 'coordinator' ? [{
      id: 'users' as SettingsTab, label: 'User Directory', icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      )
    }] : []),
    {
      id: 'system', label: 'System Theme', icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        </svg>
      )
    }
  ];

  const inputCls = "w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all";
  const labelCls = "block text-xs font-semibold text-slate-700 mb-1.5";
  const cardCls = "bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-5";

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-heading text-slate-900 tracking-tight">System & Account Settings</h1>
        <p className="text-slate-500 text-sm mt-0.5 font-medium">Configure profile preferences, academic years, taxonomies, and system theme</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Navigation Sidebar */}
        <div className="w-full lg:w-60 shrink-0">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-2 space-y-1">
            {tabs.map(item => (
              <button
                key={item.id}
                onClick={() => { setTab(item.id); setMessage(''); }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  tab === item.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <span className={tab === item.id ? 'text-white' : 'text-slate-400'}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Settings Content Body */}
        <div className="flex-1 min-w-0">
          {message && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 font-medium flex items-center justify-between shadow-sm animate-in fade-in duration-200">
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {message}
              </span>
              <button onClick={() => setMessage('')} className="text-emerald-600 hover:text-emerald-900">✕</button>
            </div>
          )}

          {/* Profile Settings */}
          {tab === 'profile' && (
            <div className={cardCls}>
              <div className="pb-3 border-b border-slate-100">
                <h3 className="font-bold font-heading text-slate-900 text-sm">Personal User Profile</h3>
                <p className="text-xs text-slate-400 mt-0.5">Manage your personal credentials and contact info</p>
              </div>

              <div className="flex items-center gap-4 bg-slate-50/60 p-4 rounded-xl border border-slate-100">
                <div className="w-14 h-14 bg-gradient-to-tr from-indigo-600 to-indigo-400 rounded-2xl flex items-center justify-center text-white text-xl font-bold font-heading shadow-md shadow-indigo-500/20">
                  {getInitials(draftProfile.name)}
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-base">{draftProfile.name}</div>
                  <div className="text-xs text-slate-500 font-medium mt-0.5">
                    Role: <span className="text-indigo-600 font-semibold uppercase">{draftProfile.role}</span> &bull; {draftProfile.department} Department
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {([
                  ['name', 'Full Name'],
                  ['employeeId', 'Employee ID / Staff No.'],
                  ['email', 'Email Address'],
                  ['phone', 'Mobile Phone Number'],
                  ['designation', 'Academic Designation']
                ] as const).map(([key, label]) => (
                  <div key={key}>
                    <label className={labelCls}>{label}</label>
                    <input
                      value={draftProfile[key] || ''}
                      onChange={e => setDraftProfile({ ...draftProfile, [key]: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                ))}
                <div>
                  <label className={labelCls}>Avatar Theme</label>
                  <select
                    value={draftProfile.avatarColor || 'indigo'}
                    onChange={e => setDraftProfile({ ...draftProfile, avatarColor: e.target.value })}
                    className={inputCls}
                  >
                    <option value="indigo">Indigo Accent</option>
                    <option value="blue">Blue Accent</option>
                    <option value="teal">Teal Accent</option>
                    <option value="rose">Rose Accent</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  disabled={saving}
                  onClick={saveProfile}
                  className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-500/20 transition-all disabled:opacity-50"
                >
                  {saving ? 'Saving Profile...' : 'Save Profile Changes'}
                </button>
              </div>
            </div>
          )}

          {/* Academic Years */}
          {tab === 'academic-year' && (
            <div className={cardCls}>
              <div className="pb-3 border-b border-slate-100">
                <h3 className="font-bold font-heading text-slate-900 text-sm">Academic Years Configuration</h3>
                <p className="text-xs text-slate-400 mt-0.5">Manage active academic sessions and designate current year</p>
              </div>

              <div className="space-y-2.5">
                {settings.academicYears.map(year => (
                  <div key={year.name} className="flex items-center justify-between p-3.5 bg-slate-50/60 rounded-xl border border-slate-200/60">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-bold text-slate-800">{year.name}</span>
                      {year.current && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          Active / Current Year
                        </span>
                      )}
                    </div>

                    {canEditGlobal && (
                      <div className="flex items-center gap-2">
                        {!year.current && (
                          <button
                            onClick={() => saveSettings({ academicYears: settings.academicYears.map(item => ({ ...item, current: item.name === year.name })) })}
                            className="px-2.5 py-1 text-[11px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-all"
                          >
                            Set Current
                          </button>
                        )}
                        {!year.current && (
                          <button
                            onClick={() => saveSettings({ academicYears: settings.academicYears.filter(item => item.name !== year.name) })}
                            className="px-2.5 py-1 text-[11px] font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-all"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {canEditGlobal && (
                <div className="flex gap-2.5 pt-3 border-t border-slate-100">
                  <input
                    value={newYear}
                    onChange={e => setNewYear(e.target.value)}
                    placeholder="e.g. 2027-28"
                    className={inputCls}
                  />
                  <button
                    onClick={() => {
                      if (newYear.trim()) {
                        saveSettings({ academicYears: [...settings.academicYears, { name: newYear.trim(), current: false }] });
                        setNewYear('');
                      }
                    }}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all whitespace-nowrap"
                  >
                    Add Academic Year
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Departments */}
          {tab === 'departments' && (
            <div className={cardCls}>
              <div className="pb-3 border-b border-slate-100">
                <h3 className="font-bold font-heading text-slate-900 text-sm">Department Configuration</h3>
                <p className="text-xs text-slate-400 mt-0.5">Manage department details, HOD designations, and enrolled student capacity</p>
              </div>

              <div className="space-y-4">
                {settings.departments.map(department => (
                  <div key={department.code} className="p-4 bg-slate-50/60 rounded-xl border border-slate-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-slate-900 text-sm">
                        {department.name} <span className="text-xs text-slate-400 font-mono">({department.code})</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Head of Department (HOD)</label>
                        <input
                          disabled={!canEditGlobal}
                          value={department.hod}
                          onChange={e => saveSettings({ departments: settings.departments.map(item => item.code === department.code ? { ...item, hod: e.target.value } : item) })}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Total Student Strength</label>
                        <input
                          disabled={!canEditGlobal}
                          type="number"
                          value={department.strength}
                          onChange={e => saveSettings({ departments: settings.departments.map(item => item.code === department.code ? { ...item, strength: Number(e.target.value) } : item) })}
                          className={inputCls}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Event Types */}
          {tab === 'event-types' && (
            <div className={cardCls}>
              <div className="pb-3 border-b border-slate-100">
                <h3 className="font-bold font-heading text-slate-900 text-sm">Event Classification Taxonomy</h3>
                <p className="text-xs text-slate-400 mt-0.5">Configure valid categories for academic event registration</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {settings.eventTypes.map(item => (
                  <div key={item} className="flex items-center justify-between p-3 bg-slate-50/60 rounded-xl border border-slate-200/60 text-xs font-semibold text-slate-700">
                    <span>{item}</span>
                    {canEditGlobal && (
                      <button
                        onClick={() => saveSettings({ eventTypes: settings.eventTypes.filter(type => type !== item) })}
                        className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {canEditGlobal && (
                <div className="flex gap-2.5 pt-3 border-t border-slate-100">
                  <input
                    value={newType}
                    onChange={e => setNewType(e.target.value)}
                    placeholder="e.g. Hackathon, Vervathon..."
                    className={inputCls}
                  />
                  <button
                    onClick={() => addItem('eventTypes', newType, setNewType)}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all whitespace-nowrap"
                  >
                    Add Category
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Document Categories */}
          {tab === 'doc-categories' && (
            <div className={cardCls}>
              <div className="pb-3 border-b border-slate-100">
                <h3 className="font-bold font-heading text-slate-900 text-sm">Compliance Document Checklist Categories</h3>
                <p className="text-xs text-slate-400 mt-0.5">Required document proofs for complete event documentation audit</p>
              </div>

              <div className="space-y-2">
                {settings.documentCategories.map(item => (
                  <div key={item} className="flex items-center justify-between p-3 bg-slate-50/60 rounded-xl border border-slate-200/60 text-xs font-semibold text-slate-700">
                    <span>{item}</span>
                    {canEditGlobal && (
                      <button
                        onClick={() => saveSettings({ documentCategories: settings.documentCategories.filter(cat => cat !== item) })}
                        className="px-2.5 py-1 text-[11px] font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-all"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {canEditGlobal && (
                <div className="flex gap-2.5 pt-3 border-t border-slate-100">
                  <input
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    placeholder="e.g. Geo-tagged Photos, Expense Vouchers..."
                    className={inputCls}
                  />
                  <button
                    onClick={() => addItem('documentCategories', newCategory, setNewCategory)}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all whitespace-nowrap"
                  >
                    Add Document Category
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Notifications */}
          {tab === 'notifications' && (
            <div className={cardCls}>
              <div className="pb-3 border-b border-slate-100">
                <h3 className="font-bold font-heading text-slate-900 text-sm">System Notification Subscriptions</h3>
                <p className="text-xs text-slate-400 mt-0.5">Control alert preferences and email notifications</p>
              </div>

              <div className="divide-y divide-slate-100">
                {Object.entries(settings.notifications).map(([key, checked]) => (
                  <label key={key} className="flex items-center justify-between py-3 cursor-pointer group">
                    <span className="text-xs font-semibold text-slate-700 group-hover:text-slate-900">
                      {notificationLabels[key] || key}
                    </span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={e => saveSettings({ notifications: { ...settings.notifications, [key]: e.target.checked } })}
                      className="h-4 w-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* User Management Embed */}
          {tab === 'users' && currentUserRole !== 'coordinator' && (
            <UserManagement currentUserRole={currentUserRole} />
          )}

          {/* System Theme */}
          {tab === 'system' && (
            <div className={cardCls}>
              <div className="pb-3 border-b border-slate-100">
                <h3 className="font-bold font-heading text-slate-900 text-sm">Visual Theme & Contrast Settings</h3>
                <p className="text-xs text-slate-400 mt-0.5">Customize UI contrast, theme palette and accent colors</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Color Mode</label>
                  <select
                    value={settings.theme.mode}
                    onChange={e => saveSettings({ theme: { ...settings.theme, mode: e.target.value as 'light' | 'dark' } })}
                    className={inputCls}
                  >
                    <option value="light">Light Mode</option>
                    <option value="dark">Dark Mode</option>
                  </select>
                </div>

                <div>
                  <label className={labelCls}>Contrast Profile</label>
                  <select
                    value={settings.theme.contrast}
                    onChange={e => saveSettings({ theme: { ...settings.theme, contrast: e.target.value as 'normal' | 'high' } })}
                    className={inputCls}
                  >
                    <option value="normal">Standard Contrast</option>
                    <option value="high">High Contrast (Accessibility)</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}