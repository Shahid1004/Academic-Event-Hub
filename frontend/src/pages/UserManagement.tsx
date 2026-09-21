import { useEffect, useState } from 'react';
import axios from 'axios';
import type { UserRole } from '../types';
import { apiUrl } from '../services/api';

interface User {
  id: string;
  name: string;
  email: string;
  department: string;
  role: UserRole;
  active: boolean;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  accessExpiresAt?: string;
}

interface UserManagementProps {
  currentUserRole: UserRole;
}


const getAuthConfig = () => {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  return { headers: { Authorization: `Bearer ${token}` } };
};

export default function UserManagement({
  currentUserRole,
}: UserManagementProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);

  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('faculty');

  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newDepartment, setNewDepartment] = useState('IT');
  const [newRole, setNewRole] = useState<UserRole>('faculty');
  const [newPassword, setNewPassword] = useState('');

  const canManageUsers = currentUserRole === 'admin' || currentUserRole === 'hod';
  const canApproveAccess = currentUserRole === 'admin' || currentUserRole === 'faculty';
  const availableRoles: UserRole[] = currentUserRole === 'faculty'
    ? ['coordinator']
    : ['admin', 'hod', 'coordinator', 'faculty'];

  useEffect(() => {
    if (!canManageUsers && !canApproveAccess) return;
    axios.get(`${apiUrl}/api/users`, getAuthConfig())
      .then(response => setUsers(response.data.users))
      .catch(err => setError(err.response?.data?.message || 'Unable to load users.'))
      .finally(() => setLoading(false));
  }, [canManageUsers, canApproveAccess]);

  const updateAccess = async (user: User, action: 'approve' | 'reject') => {
    try {
      const response = await axios.patch(`${apiUrl}/api/users/${user.id}/access`, { action }, getAuthConfig());
      setUsers(prev => prev.map(item => item.id === user.id ? response.data.user : item));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Unable to update access approval.');
    }
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditDepartment(user.department);
    setEditRole(user.role);
    setShowEditModal(true);
  };

  const saveUserChanges = async () => {
    if (!selectedUser) return;
    try {
      const response = await axios.patch(`${apiUrl}/api/users/${selectedUser.id}`, {
        name: editName, email: editEmail, department: editDepartment, role: editRole
      }, getAuthConfig());
      setUsers(prev => prev.map(user => user.id === selectedUser.id ? response.data.user : user));
      setShowEditModal(false);
      setSelectedUser(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Unable to update user.');
    }
  };

  const addUser = async () => {
    if (!newName.trim() || !newEmail.trim() || !newPassword) {
      alert('Please fill in name, email, and password.');
      return;
    }
    try {
      const response = await axios.post(`${apiUrl}/api/users`, {
        name: newName, email: newEmail, department: newDepartment, role: newRole, password: newPassword
      }, getAuthConfig());
      setUsers(prev => [...prev, response.data.user]);
      setNewName(''); setNewEmail(''); setNewPassword(''); setNewDepartment('IT'); setNewRole('faculty');
      setShowAddModal(false);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Unable to create user.');
    }
  };

  const removeUser = async () => {
    if (deleteUserId === null) return;
    try {
      const response = await axios.patch(`${apiUrl}/api/users/${deleteUserId}`, { active: false }, getAuthConfig());
      setUsers(prev => prev.map(user => user.id === deleteUserId ? response.data.user : user));
      setDeleteUserId(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Unable to deactivate user.');
    }
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'System Admin';
      case 'hod': return 'Head of Department';
      case 'coordinator': return 'Event Coordinator';
      case 'faculty': return 'Faculty Member';
    }
  };

  const getRoleBadgeStyle = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'bg-purple-50 text-purple-700 border border-purple-200/80';
      case 'hod': return 'bg-indigo-50 text-indigo-700 border border-indigo-200/80';
      case 'coordinator': return 'bg-emerald-50 text-emerald-700 border border-emerald-200/80';
      case 'faculty': return 'bg-slate-100 text-slate-700 border border-slate-200/80';
    }
  };

  const modalInputCls = "w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all";
  const modalLabelCls = "block text-xs font-semibold text-slate-700 mb-1.5";

  if (!canManageUsers && !canApproveAccess) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-10 text-center max-w-md">
          <div className="w-14 h-14 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-rose-600">
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold font-heading text-slate-900">Access Restricted</h2>
          <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
            Administrative access privileges are required to manage users and access approvals.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-slate-900 tracking-tight">User & Access Management</h1>
          <p className="text-slate-500 text-sm mt-0.5 font-medium">Manage departmental accounts, roles, access expiration & approvals</p>
        </div>

        {canManageUsers && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-500/20 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            Add New User
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700 flex items-center gap-2">
          <svg className="w-4 h-4 text-rose-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Users Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Registered Users Directory ({users.length})
          </div>
        </div>

        <div className="p-4 space-y-3">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs font-medium">
              Loading users directory...
            </div>
          ) : users.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No registered users found.
            </div>
          ) : (
            users.map(user => (
              <div
                key={user.id}
                className={`p-4 rounded-xl border border-slate-200/60 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                  !user.active ? 'bg-slate-100/60 opacity-75' : 'bg-slate-50/40 hover:bg-slate-50'
                }`}
              >
                {/* User Info */}
                <div className="flex items-center gap-3.5 flex-1 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center font-bold font-heading text-sm shadow-sm shrink-0">
                    {getInitials(user.name)}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900 text-sm truncate">{user.name}</h3>
                      {!user.active && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-600">
                          Inactive
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-500 font-medium flex items-center gap-2 flex-wrap mt-0.5">
                      <span>{user.email}</span>
                      <span>&bull;</span>
                      <span className="font-semibold text-slate-700">{user.department}</span>
                      {user.accessExpiresAt && (
                        <>
                          <span>&bull;</span>
                          <span className="text-amber-600 font-medium">Expires: {new Date(user.accessExpiresAt).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Badges & Actions */}
                <div className="flex items-center gap-2.5 flex-wrap shrink-0">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getRoleBadgeStyle(user.role)}`}>
                    {getRoleLabel(user.role)}
                  </span>

                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    user.approvalStatus === 'approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80' :
                    user.approvalStatus === 'rejected' ? 'bg-rose-50 text-rose-700 border border-rose-200/80' :
                    'bg-amber-50 text-amber-700 border border-amber-200/80'
                  }`}>
                    {user.approvalStatus === 'approved' ? 'Approved' : user.approvalStatus === 'rejected' ? 'Rejected' : 'Pending Approval'}
                  </span>

                  {canApproveAccess && user.approvalStatus !== 'approved' && (currentUserRole === 'admin' || user.role === 'coordinator') && (
                    <div className="flex items-center gap-1.5 ml-2">
                      <button
                        onClick={() => updateAccess(user, 'approve')}
                        className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-all"
                      >
                        Approve
                      </button>
                      {user.approvalStatus === 'pending' && (
                        <button
                          onClick={() => updateAccess(user, 'reject')}
                          className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-all"
                        >
                          Reject
                        </button>
                      )}
                    </div>
                  )}

                  {canManageUsers && (
                    <div className="flex items-center gap-1.5 ml-1">
                      <button
                        onClick={() => openEditModal(user)}
                        className="px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-all"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteUserId(user.id)}
                        disabled={!user.active}
                        className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-all disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200/80 overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h2 className="text-lg font-bold font-heading text-slate-900">Edit User Details</h2>
              <p className="text-xs text-slate-500 mt-0.5">Modify profile information and access role</p>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className={modalLabelCls}>Full Name</label>
                <input value={editName} onChange={e => setEditName(e.target.value)} className={modalInputCls} />
              </div>

              <div>
                <label className={modalLabelCls}>Email Address</label>
                <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} className={modalInputCls} />
              </div>

              <div>
                <label className={modalLabelCls}>Department</label>
                <select value={editDepartment} onChange={e => setEditDepartment(e.target.value)} className={modalInputCls}>
                  <option value="IT">Information Technology</option>
                  <option value="AI & Data Science">AI & Data Science</option>
                  <option value="All">All Departments</option>
                </select>
              </div>

              <div>
                <label className={modalLabelCls}>System Role</label>
                <select value={editRole} onChange={e => setEditRole(e.target.value as UserRole)} className={modalInputCls}>
                  {availableRoles.map(role => <option key={role} value={role}>{getRoleLabel(role)}</option>)}
                </select>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => { setShowEditModal(false); setSelectedUser(null); }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 border border-slate-200 rounded-xl bg-white transition-all"
              >
                Cancel
              </button>
              <button
                onClick={saveUserChanges}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-all"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200/80 overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h2 className="text-lg font-bold font-heading text-slate-900">Create New Account</h2>
              <p className="text-xs text-slate-500 mt-0.5">Provision a new faculty or coordinator account</p>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className={modalLabelCls}>Full Name</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Dr. Jane Doe" className={modalInputCls} />
              </div>

              <div>
                <label className={modalLabelCls}>Institutional Email</label>
                <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="janedoe@sonatech.ac.in" className={modalInputCls} />
              </div>

              <div>
                <label className={modalLabelCls}>Initial Password</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="At least 8 characters" className={modalInputCls} />
              </div>

              <div>
                <label className={modalLabelCls}>Department</label>
                <select value={newDepartment} onChange={e => setNewDepartment(e.target.value)} className={modalInputCls}>
                  <option value="IT">Information Technology</option>
                  <option value="AI & Data Science">AI & Data Science</option>
                </select>
              </div>

              <div>
                <label className={modalLabelCls}>System Role</label>
                <select value={newRole} onChange={e => setNewRole(e.target.value as UserRole)} className={modalInputCls}>
                  {availableRoles.map(role => <option key={role} value={role}>{getRoleLabel(role)}</option>)}
                </select>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 border border-slate-200 rounded-xl bg-white transition-all"
              >
                Cancel
              </button>
              <button
                onClick={addUser}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-all"
              >
                Create Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Confirmation */}
      {deleteUserId !== null && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center border border-slate-200/80">
            <div className="w-12 h-12 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="font-bold font-heading text-slate-900 text-base">Deactivate User Account?</h3>
            <p className="text-xs text-slate-500 mt-1">This user will be marked as inactive and disabled from logging into the portal.</p>
            <div className="flex justify-center gap-2 mt-6">
              <button
                onClick={() => setDeleteUserId(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={removeUser}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm transition-all"
              >
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}