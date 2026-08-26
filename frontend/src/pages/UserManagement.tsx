import { useEffect, useState } from 'react';
import axios from 'axios';

type UserRole = 'admin' | 'hod' | 'faculty' | 'coordinator';

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

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

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

  const canManageUsers =
    currentUserRole === 'admin' || currentUserRole === 'hod';
  const canApproveAccess = currentUserRole === 'admin' || currentUserRole === 'faculty';

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
      alert('Please enter name and email.');
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

    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }

    return (
      parts[0].charAt(0) +
      parts[parts.length - 1].charAt(0)
    ).toUpperCase();
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'Admin';
      case 'hod':
        return 'HOD';
      case 'coordinator':
        return 'Event Coordinator';
      case 'faculty':
        return 'Faculty';
    }
  };

  const getRoleStyle = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-700';
      case 'hod':
        return 'bg-blue-100 text-blue-700';
      case 'coordinator':
        return 'bg-green-100 text-green-700';
      case 'faculty':
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (!canManageUsers && !canApproveAccess) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg
              className="w-8 h-8 text-red-600"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
              <path d="M10.3 3.9L2.5 17a2 2 0 001.7 3h15.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-gray-900">
            Access Restricted
          </h2>

          <p className="text-gray-500 mt-2">
            You do not have permission to manage user access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">

        <div className="mb-7">
          <h1 className="text-3xl font-bold text-gray-900">
            User Management
          </h1>

          <p className="text-gray-500 mt-1">
            Manage users, departments and system roles.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">

          <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Users
              </h2>

              <p className="text-sm text-gray-500 mt-1">
                Admin and HOD can change user roles.
              </p>
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition"
            >
              + Add User
            </button>
          </div>

          <div className="p-4 md:p-6 space-y-3">

            {loading && <p className="p-4 text-sm text-gray-500">Loading users...</p>}
            {error && <p className="p-4 text-sm text-red-600">{error}</p>}
            {!loading && users.map(user => (
              <div
                key={user.id}
                className="bg-gray-50 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center gap-4"
              >

                <div className="flex items-center gap-4 flex-1">

                  <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                    {getInitials(user.name)}
                  </div>

                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900">
                      {user.name}
                    </h3>

                    <p className="text-sm text-gray-500">
                      {getRoleLabel(user.role)} • {user.department} •{' '}
                      {user.email} {user.active ? '' : ' • Disabled'}
                      {user.accessExpiresAt ? ` • Access until ${new Date(user.accessExpiresAt).toLocaleDateString()}` : ''}
                    </p>
                  </div>

                </div>

                <div className="flex items-center gap-3 flex-wrap">

                  <span
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold ${getRoleStyle(
                      user.role
                    )}`}
                  >
                    {getRoleLabel(user.role)}
                  </span>

                  <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                    user.approvalStatus === 'approved' ? 'bg-green-100 text-green-700' :
                    user.approvalStatus === 'rejected' ? 'bg-red-100 text-red-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {user.approvalStatus === 'approved' ? 'Approved' : user.approvalStatus === 'rejected' ? 'Rejected' : 'Pending approval'}
                  </span>

                  {canApproveAccess && user.approvalStatus !== 'approved' && (currentUserRole === 'admin' || user.role === 'coordinator') && (
                    <>
                      <button
                        onClick={() => updateAccess(user, 'approve')}
                        className="px-4 py-2 border border-green-200 text-green-700 hover:bg-green-50 rounded-lg text-sm font-medium transition"
                      >
                        Approve
                      </button>
                      {user.approvalStatus === 'pending' && (
                        <button
                          onClick={() => updateAccess(user, 'reject')}
                          className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition"
                        >
                          Reject
                        </button>
                      )}
                    </>
                  )}

                  {canManageUsers && <>
                    <button
                      onClick={() => openEditModal(user)}
                      className="px-4 py-2 border border-indigo-200 text-indigo-600 hover:bg-indigo-50 rounded-lg text-sm font-medium transition"
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => setDeleteUserId(user.id)}
                      disabled={!user.active}
                      className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition"
                    >
                      Remove
                    </button>
                  </>}

                </div>

              </div>
            ))}

          </div>
        </div>
      </div>

      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">

          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">

            <div className="p-6 border-b border-gray-100">

              <h2 className="text-xl font-bold text-gray-900">
                Edit User
              </h2>

              <p className="text-sm text-gray-500 mt-1">
                Update user information and role.
              </p>

            </div>

            <div className="p-6 space-y-5">

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>

                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>

                <input
                  type="email"
                  value={editEmail}
                  onChange={e => setEditEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Temporary Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Department
                </label>

                <select
                  value={editDepartment}
                  onChange={e => setEditDepartment(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="IT">
                    Information Technology
                  </option>

                  <option value="AI & Data Science">
                    AI & Data Science
                  </option>

                  <option value="All">
                    All Departments
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role
                </label>

                <select
                  value={editRole}
                  onChange={e =>
                    setEditRole(e.target.value as UserRole)
                  }
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="admin">
                    Admin
                  </option>

                  <option value="hod">
                    HOD
                  </option>

                  <option value="coordinator">
                    Event Coordinator
                  </option>

                  <option value="faculty">
                    Faculty
                  </option>
                </select>
              </div>

            </div>

            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">

              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedUser(null);
                }}
                className="px-5 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50"
              >
                Cancel
              </button>

              <button
                onClick={saveUserChanges}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-semibold"
              >
                Save Changes
              </button>

            </div>

          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">

          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">

            <div className="p-6 border-b border-gray-100">

              <h2 className="text-xl font-bold text-gray-900">
                Add User
              </h2>

              <p className="text-sm text-gray-500 mt-1">
                Create a new user account.
              </p>

            </div>

            <div className="p-6 space-y-5">

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>

                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Enter full name"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>

                <input
                  type="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="user@college.edu"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Department
                </label>

                <select
                  value={newDepartment}
                  onChange={e => setNewDepartment(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="IT">
                    Information Technology
                  </option>

                  <option value="AI & Data Science">
                    AI & Data Science
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role
                </label>

                <select
                  value={newRole}
                  onChange={e =>
                    setNewRole(e.target.value as UserRole)
                  }
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="admin">
                    Admin
                  </option>

                  <option value="hod">
                    HOD
                  </option>

                  <option value="coordinator">
                    Event Coordinator
                  </option>

                  <option value="faculty">
                    Faculty
                  </option>
                </select>
              </div>

            </div>

            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">

              <button
                onClick={() => setShowAddModal(false)}
                className="px-5 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50"
              >
                Cancel
              </button>

              <button
                onClick={addUser}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-semibold"
              >
                Add User
              </button>

            </div>

          </div>
        </div>
      )}

      {deleteUserId !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">

          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">

            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">

              <svg
                className="w-6 h-6 text-red-600"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 6h18" />
                <path d="M8 6V4h8v2" />
                <path d="M19 6l-1 14H6L5 6" />
              </svg>

            </div>

            <h2 className="text-xl font-bold text-gray-900">
              Remove User?
            </h2>

            <p className="text-gray-500 mt-2">
              This action will remove the user from the current user list.
            </p>

            <div className="flex justify-end gap-3 mt-7">

              <button
                onClick={() => setDeleteUserId(null)}
                className="px-5 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50"
              >
                Cancel
              </button>

              <button
                onClick={removeUser}
                className="px-5 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 font-semibold"
              >
                Remove
              </button>

            </div>

          </div>
        </div>
      )}
    </div>
  );
}