'use client';

import { useState } from 'react';

interface AdminUser {
  id: string;
  username: string;
  display_name: string | null;
  created_at: Date | string;
}

export default function UserManagement({ initialUsers }: { initialUsers: AdminUser[] }) {
  const [users, setUsers] = useState<AdminUser[]>(initialUsers);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Add form state
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [adding, setAdding] = useState(false);

  // Edit form state
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [saving, setSaving] = useState(false);

  function showMessage(msg: string, isError = false) {
    if (isError) { setError(msg); setSuccess(''); }
    else { setSuccess(msg); setError(''); }
    setTimeout(() => { setError(''); setSuccess(''); }, 3000);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError('');

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          display_name: newDisplayName || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setUsers((prev) => [...prev, data.user]);
      setNewUsername('');
      setNewPassword('');
      setNewDisplayName('');
      setShowAddForm(false);
      showMessage(`User "${data.user.username}" created`);
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Failed to create user', true);
    } finally {
      setAdding(false);
    }
  }

  function startEdit(user: AdminUser) {
    setEditingId(user.id);
    setEditDisplayName(user.display_name ?? '');
    setEditPassword('');
  }

  async function handleSaveEdit(userId: string) {
    setSaving(true);
    try {
      const body: { display_name: string; password?: string } = {
        display_name: editDisplayName,
      };
      if (editPassword) body.password = editPassword;

      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setUsers((prev) => prev.map((u) => (u.id === userId ? data.user : u)));
      setEditingId(null);
      showMessage('User updated');
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Failed to update user', true);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(userId: string, username: string) {
    if (!confirm(`Delete admin user "${username}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setUsers((prev) => prev.filter((u) => u.id !== userId));
      showMessage(`User "${username}" deleted`);
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Failed to delete user', true);
    }
  }

  return (
    <div>
      {/* Messages */}
      {error && (
        <div className="mb-4 px-4 py-2.5 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
      )}
      {success && (
        <div className="mb-4 px-4 py-2.5 rounded-lg bg-green-50 text-green-700 text-sm">{success}</div>
      )}

      {/* Add User button / form */}
      {!showAddForm ? (
        <button
          onClick={() => setShowAddForm(true)}
          className="mb-6 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
        >
          + Add User
        </button>
      ) : (
        <form onSubmit={handleAdd} className="mb-6 bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">New Admin User</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Username *</label>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. john"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Password *</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Min 6 characters"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Display Name</label>
              <input
                type="text"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. John Smith"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={adding}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-60 transition-colors"
            >
              {adding ? 'Creating...' : 'Create User'}
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Users table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-5 py-3 font-medium text-gray-600">Username</th>
              <th className="text-left px-5 py-3 font-medium text-gray-600">Display Name</th>
              <th className="text-left px-5 py-3 font-medium text-gray-600">Created</th>
              <th className="text-right px-5 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-gray-100 last:border-0">
                {editingId === user.id ? (
                  <>
                    <td className="px-5 py-3 font-medium text-gray-900">{user.username}</td>
                    <td className="px-5 py-3">
                      <input
                        type="text"
                        value={editDisplayName}
                        onChange={(e) => setEditDisplayName(e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Display name"
                      />
                    </td>
                    <td className="px-5 py-3">
                      <input
                        type="password"
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="New password (leave blank to keep)"
                      />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => handleSaveEdit(user.id)}
                        disabled={saving}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium mr-3"
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        Cancel
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-5 py-3 font-medium text-gray-900">{user.username}</td>
                    <td className="px-5 py-3 text-gray-600">{user.display_name ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => startEdit(user)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(user.id, user.username)}
                        className="text-xs text-red-500 hover:text-red-700 font-medium"
                      >
                        Delete
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-gray-400">
                  No admin users yet. Click &quot;+ Add User&quot; to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
