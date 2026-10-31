import React, { useState } from 'react';
import { Shield, Key, Smartphone, AlertTriangle, CheckCircle2, User as UserIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export const SettingsPage: React.FC = () => {
  const { user, refreshUser, logout } = useAuth();

  // Profile Form
  const [fullName, setFullName] = useState<string>(user?.full_name || '');
  const [phone, setPhone] = useState<string>(user?.profile?.phone || '');
  const [timezone, setTimezone] = useState<string>(user?.profile?.timezone || 'UTC');
  const [emailNotifs, setEmailNotifs] = useState<boolean>(user?.profile?.notification_email_enabled ?? true);
  const [profileMsg, setProfileMsg] = useState<string>('');

  // Password Form
  const [oldPassword, setOldPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [passwordMsg, setPasswordMsg] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string>('');

  // 2FA Flow
  const [totpSecret, setTotpSecret] = useState<string>('');
  const [totpUri, setTotpUri] = useState<string>('');
  const [totpCode, setTotpCode] = useState<string>('');
  const [is2FASetupStep, setIs2FASetupStep] = useState<boolean>(false);
  const [totpMsg, setTotpMsg] = useState<string>('');
  const [totpError, setTotpError] = useState<string>('');

  // Deletion
  const [deletePassword, setDeletePassword] = useState<string>('');
  const [deleteConfirmation, setDeleteConfirmation] = useState<string>('');
  const [deleteError, setDeleteError] = useState<string>('');

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg('');
    try {
      await api.patch('/auth/profile/', {
        full_name: fullName,
        phone,
        timezone,
        notification_email_enabled: emailNotifs,
      });
      setProfileMsg('Profile updated successfully.');
      refreshUser();
    } catch (err: any) {
      alert('Failed to update profile: ' + (err.response?.data?.error?.message || err.message));
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg('');
    setPasswordError('');

    try {
      await api.post('/auth/change-password/', {
        old_password: oldPassword,
        new_password: newPassword,
        new_password_confirm: confirmPassword,
      });
      setPasswordMsg('Password changed successfully.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      const msg = err.response?.data?.error?.details || err.response?.data?.error?.message || 'Password update failed.';
      setPasswordError(typeof msg === 'object' ? JSON.stringify(msg) : String(msg));
    }
  };

  const handleStart2FASetup = async () => {
    setTotpError('');
    setTotpMsg('');
    try {
      const res = await api.post('/auth/2fa/setup/');
      setTotpSecret(res.data.secret);
      setTotpUri(res.data.provisioning_uri);
      setIs2FASetupStep(true);
    } catch (err: any) {
      setTotpError('Failed to initiate 2FA setup.');
    }
  };

  const handleConfirm2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setTotpError('');
    try {
      await api.post('/auth/2fa/enable/', { code: totpCode });
      setTotpMsg('Two-Factor Authentication is now enabled!');
      setIs2FASetupStep(false);
      setTotpCode('');
      refreshUser();
    } catch (err: any) {
      setTotpError(err.response?.data?.error?.message || 'Invalid verification code.');
    }
  };

  const handleDisable2FA = async () => {
    const pwd = prompt('Enter your current account password to disable 2FA:');
    if (!pwd) return;
    try {
      await api.post('/auth/2fa/disable/', { password: pwd });
      setTotpMsg('Two-Factor Authentication has been disabled.');
      refreshUser();
    } catch (err: any) {
      alert('Failed to disable 2FA: ' + (err.response?.data?.error?.message || err.message));
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError('');
    if (!window.confirm('THIS ACTION IS IRREVERSIBLE. All stored documents and records will be purged immediately. Continue?')) {
      return;
    }
    try {
      await api.post('/auth/delete-account/', {
        password: deletePassword,
        confirmation: deleteConfirmation,
      });
      alert('Vault destroyed.');
      logout();
    } catch (err: any) {
      setDeleteError(err.response?.data?.error?.details || err.response?.data?.error?.message || 'Deletion failed.');
    }
  };

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Security & Account Settings</h1>
        <p className="text-xs text-slate-500">
          Manage your personal profile, credentials, two-factor authentication, and privacy sovereignty.
        </p>
      </div>

      {/* Profile Form */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2 border-b border-slate-100 pb-3">
          <UserIcon className="h-4 w-4 text-blue-600" />
          <span>Profile Information</span>
        </h2>

        {profileMsg && (
          <div className="mt-3 rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-800 flex items-center space-x-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{profileMsg}</span>
          </div>
        )}

        <form onSubmit={handleUpdateProfile} className="mt-4 space-y-4 text-xs">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block font-semibold text-slate-700">Account Email</label>
              <input
                type="email"
                disabled
                value={user?.email || ''}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block font-semibold text-slate-700">Phone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1-555-0199"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700">Timezone</label>
              <input
                type="text"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="flex items-center space-x-2 font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={emailNotifs}
                onChange={(e) => setEmailNotifs(e.target.checked)}
                className="rounded text-blue-600"
              />
              <span>Send me email notifications for document expirations and emergency requests</span>
            </label>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
            >
              Update Profile
            </button>
          </div>
        </form>
      </div>

      {/* Two-Factor Authentication (TOTP) */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2 border-b border-slate-100 pb-3">
          <Smartphone className="h-4 w-4 text-indigo-600" />
          <span>Two-Factor Authentication (TOTP / Authenticator App)</span>
        </h2>

        {totpMsg && (
          <div className="mt-3 rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-800 flex items-center space-x-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{totpMsg}</span>
          </div>
        )}

        {totpError && (
          <div className="mt-3 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700">
            {totpError}
          </div>
        )}

        <div className="mt-4 text-xs text-slate-600 space-y-3">
          <p>
            Secure your vault with standard Time-based One-Time Passwords (compatible with Google Authenticator, Authy, or 1Password).
          </p>

          {user?.two_factor_enabled ? (
            <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <span className="font-bold text-emerald-900">Two-Factor Authentication is currently ACTIVE</span>
              </div>
              <button
                onClick={handleDisable2FA}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Disable 2FA
              </button>
            </div>
          ) : is2FASetupStep ? (
            <form onSubmit={handleConfirm2FA} className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
              <h3 className="font-bold text-indigo-950">Scan / Enter Key in Authenticator</h3>
              <p className="text-[11px] text-slate-600">
                Enter this secret key manually into your authenticator app:
              </p>
              <div className="font-mono font-bold text-xs bg-white p-2.5 rounded border border-indigo-200 text-indigo-900 select-all">
                {totpSecret}
              </div>
              <div>
                <label className="block font-semibold text-slate-700">Enter 6-Digit Verification Code</label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  placeholder="123456"
                  className="mt-1 w-48 rounded-lg border border-slate-300 px-3 py-1.5 font-mono text-center tracking-widest text-sm focus:outline-none"
                />
              </div>
              <div className="flex space-x-2">
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-1.5 font-semibold text-white hover:bg-indigo-700"
                >
                  Confirm & Enable 2FA
                </button>
                <button
                  type="button"
                  onClick={() => setIs2FASetupStep(false)}
                  className="rounded-lg border px-3 py-1.5 font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div>
              <button
                onClick={handleStart2FASetup}
                className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white shadow-sm hover:bg-indigo-700"
              >
                Setup Two-Factor Authentication
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Change Password */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2 border-b border-slate-100 pb-3">
          <Key className="h-4 w-4 text-slate-700" />
          <span>Change Vault Password</span>
        </h2>

        {passwordMsg && (
          <div className="mt-3 rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-800">
            {passwordMsg}
          </div>
        )}

        {passwordError && (
          <div className="mt-3 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700">
            {passwordError}
          </div>
        )}

        <form onSubmit={handleChangePassword} className="mt-4 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700">Current Password</label>
            <input
              type="password"
              required
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block font-semibold text-slate-700">New Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700">Confirm New Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800"
            >
              Update Password
            </button>
          </div>
        </form>
      </div>

      {/* Danger Zone: Vault Deletion */}
      <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-6 space-y-4">
        <h2 className="text-sm font-bold text-rose-950 flex items-center space-x-2">
          <AlertTriangle className="h-4 w-4 text-rose-600" />
          <span>Danger Zone: Permanent Account Deletion</span>
        </h2>
        <p className="text-xs text-rose-800">
          Deleting your account permanently destroys all encryption metadata, shredded storage artifacts, version histories, and sharing grants. This cannot be undone.
        </p>

        {deleteError && (
          <div className="rounded-lg bg-rose-100 p-2.5 text-xs text-rose-900 font-semibold">
            {deleteError}
          </div>
        )}

        <form onSubmit={handleDeleteAccount} className="space-y-3 text-xs max-w-md">
          <div>
            <label className="block font-semibold text-slate-700">Enter Your Password</label>
            <input
              type="password"
              required
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 focus:outline-none"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700">
              Type <span className="font-mono font-bold text-rose-700">DELETE MY VAULT</span> to confirm:
            </label>
            <input
              type="text"
              required
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder="DELETE MY VAULT"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white hover:bg-rose-700 transition"
          >
            Permanently Destroy My Vault
          </button>
        </form>
      </div>
    </div>
  );
};
