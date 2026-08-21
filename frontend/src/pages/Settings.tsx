import { useState } from 'react';

type SettingsTab = 'profile' | 'academic-year' | 'departments' | 'event-types' | 'doc-categories' | 'notifications' | 'users' | 'system';

export default function Settings() {
  const [tab, setTab] = useState<SettingsTab>('profile');

  const tabs: { id: SettingsTab; label: string; icon: string }[] = [
    { id: 'profile', label: 'Profile', icon: '👤' },
    { id: 'academic-year', label: 'Academic Year', icon: '📅' },
    { id: 'departments', label: 'Department Management', icon: '🏢' },
    { id: 'event-types', label: 'Event Types', icon: '🎯' },
    { id: 'doc-categories', label: 'Document Categories', icon: '📁' },
    { id: 'notifications', label: 'Notification Settings', icon: '🔔' },
    { id: 'users', label: 'User Management', icon: '👥' },
    { id: 'system', label: 'System Settings', icon: '⚙️' },
  ];

  const inputCls = "w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50";
  const labelCls = "block text-xs font-medium text-slate-600 mb-1";

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold font-heading text-slate-900 mb-6">Settings</h1>
      <div className="flex gap-5">
        {/* Sidebar */}
        <div className="w-56 flex-shrink-0">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left border-b border-slate-50 ${tab === t.id ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {tab === 'profile' && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
              <h3 className="font-bold font-heading text-slate-800">Profile Settings</h3>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold">PS</div>
                <button className="text-sm text-indigo-600 hover:text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-xl">Change Avatar</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[['Full Name', 'Dr. Priya Sharma'], ['Employee ID', 'EMP-IT-001'], ['Email', 'priya.sharma@college.edu'], ['Phone', '9876543210'], ['Designation', 'Head of Department'], ['Department', 'Information Technology']].map(([label, val]) => (
                  <div key={label}>
                    <label className={labelCls}>{label}</label>
                    <input defaultValue={val} className={inputCls} />
                  </div>
                ))}
              </div>
              <button className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium">Save Changes</button>
            </div>
          )}

          {tab === 'academic-year' && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
              <h3 className="font-bold font-heading text-slate-800">Academic Year Management</h3>
              <div className="space-y-2">
                {['2023-24', '2024-25', '2025-26 (Current)', '2026-27'].map(y => (
                  <div key={y} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <span className="text-sm font-medium text-slate-700">{y}</span>
                    <div className="flex gap-2">
                      <button className="text-xs text-blue-600 border border-blue-200 px-2 py-1 rounded-lg hover:bg-blue-50">Edit</button>
                      {!y.includes('Current') && <button className="text-xs text-red-500 border border-red-200 px-2 py-1 rounded-lg hover:bg-red-50">Delete</button>}
                    </div>
                  </div>
                ))}
              </div>
              <button className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium">+ Add Academic Year</button>
            </div>
          )}

          {tab === 'departments' && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
              <h3 className="font-bold font-heading text-slate-800">Department Management</h3>
              {[
                { name: 'Information Technology', code: 'IT', hod: 'Dr. Priya Sharma', strength: 240 },
                { name: 'AI & Data Science', code: 'AIDS', hod: 'Dr. Meena Krishnan', strength: 180 },
              ].map(dept => (
                <div key={dept.code} className="p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-slate-800">{dept.name}</div>
                      <div className="text-xs text-slate-500 mt-1">Code: {dept.code} | HOD: {dept.hod} | Strength: {dept.strength}</div>
                    </div>
                    <button className="text-xs text-blue-600 border border-blue-200 px-2 py-1 rounded-lg hover:bg-blue-50">Edit</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'event-types' && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
              <h3 className="font-bold font-heading text-slate-800">Event Types</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {['Hackathon', 'Vervathon', 'Guest Lecture', 'Workshop', 'Webinar', 'Seminar', 'Symposium', 'FDP', 'Training Event', 'Conference', 'Joint Event', 'Other'].map(t => (
                  <div key={t} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
                    <span className="text-sm text-slate-700">{t}</span>
                    <button className="text-xs text-slate-400 hover:text-red-500">✕</button>
                  </div>
                ))}
              </div>
              <button className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium">+ Add Type</button>
            </div>
          )}

          {tab === 'notifications' && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
              <h3 className="font-bold font-heading text-slate-800">Notification Settings</h3>
              {[
                ['Attendance Pending Reminder', true],
                ['Feedback Collection Completed', true],
                ['Payment Document Pending', true],
                ['Event Report Generated', true],
                ['Documentation Completed', false],
                ['Upcoming Event (24h before)', true],
                ['New Event Assigned', true],
              ].map(([label, checked]) => (
                <div key={label as string} className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-sm text-slate-700">{label as string}</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked={checked as boolean} className="sr-only peer" />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
                  </label>
                </div>
              ))}
            </div>
          )}

          {tab === 'users' && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold font-heading text-slate-800">User Management</h3>
                <button className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-sm font-medium">+ Add User</button>
              </div>
              <div className="space-y-2">
                {[
                  { name: 'Dr. Priya Sharma', role: 'HOD', dept: 'IT', email: 'priya@college.edu' },
                  { name: 'Prof. Anand Raj', role: 'Faculty Coordinator', dept: 'IT', email: 'anand@college.edu' },
                  { name: 'Dr. Meena Krishnan', role: 'HOD', dept: 'AIDS', email: 'meena@college.edu' },
                  { name: 'Dr. Lakshmi Devi', role: 'Faculty Coordinator', dept: 'AIDS', email: 'lakshmi@college.edu' },
                  { name: 'Admin', role: 'Admin', dept: 'All', email: 'admin@college.edu' },
                ].map(u => (
                  <div key={u.email} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-xs">
                        {u.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-800">{u.name}</div>
                        <div className="text-xs text-slate-400">{u.role} · {u.dept} · {u.email}</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="text-xs text-blue-600 border border-blue-200 px-2 py-1 rounded-lg hover:bg-blue-50">Edit</button>
                      <button className="text-xs text-red-500 border border-red-200 px-2 py-1 rounded-lg hover:bg-red-50">Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(tab === 'doc-categories' || tab === 'system') && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
              <h3 className="font-bold font-heading text-slate-800 mb-4">{tabs.find(t => t.id === tab)?.label}</h3>
              <p className="text-slate-500 text-sm">Configure {tabs.find(t => t.id === tab)?.label.toLowerCase()} settings here.</p>
              <div className="mt-4 space-y-3">
                {[1,2,3].map(i => (
                  <div key={i} className="h-10 bg-slate-50 rounded-xl animate-pulse" />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
