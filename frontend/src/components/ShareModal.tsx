import React, { useState } from 'react';
import { X, Share2, Copy, Check, ShieldAlert, Link as LinkIcon, User as UserIcon } from 'lucide-react';
import { SharingService } from '../services/api';
import { DocumentItem, ShareGrant } from '../types';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: DocumentItem | null;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, document }) => {
  const [shareType, setShareType] = useState<'link' | 'user'>('link');
  const [targetEmail, setTargetEmail] = useState<string>('');
  const [permission, setPermission] = useState<'view' | 'download'>('view');
  const [expiresAt, setExpiresAt] = useState<string>('');
  const [maxDownloads, setMaxDownloads] = useState<string>('');
  const [generatedLink, setGeneratedLink] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  if (!isOpen || !document) return null;

  const handleCreateShare = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const grant = await SharingService.createGrant({
        document_id: document.id,
        share_type: shareType,
        shared_with_email: shareType === 'user' ? targetEmail : undefined,
        permission,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        max_downloads: maxDownloads ? parseInt(maxDownloads) : null,
      });

      if (grant.access_token) {
        const fullUrl = `${window.location.origin}/share/${grant.access_token}`;
        setGeneratedLink(fullUrl);
      } else {
        alert(`Document shared successfully with ${targetEmail}!`);
        onClose();
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.details || err.response?.data?.error?.message || 'Failed to create share grant.';
      setErrorMsg(typeof msg === 'object' ? JSON.stringify(msg) : String(msg));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              <Share2 className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Share Document</h3>
              <p className="text-xs text-slate-500 truncate max-w-[240px]">{document.title}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-3 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700">
            {errorMsg}
          </div>
        )}

        {generatedLink ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-xs text-emerald-900 space-y-2">
              <p className="font-semibold flex items-center space-x-1.5">
                <Check className="h-4 w-4 text-emerald-600" />
                <span>Secure Temporary Link Created!</span>
              </p>
              <p className="text-slate-600 text-[11px]">
                Copy this link now. For your security, the raw token is not stored in our database (only a SHA-256 hash is retained).
              </p>
              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="text"
                  readOnly
                  value={generatedLink}
                  className="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:outline-none"
                />
                <button
                  onClick={handleCopy}
                  className="flex items-center space-x-1 rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateShare} className="mt-4 space-y-4">
            {/* Type tabs */}
            <div className="flex rounded-lg bg-slate-100 p-1 text-xs font-medium">
              <button
                type="button"
                onClick={() => setShareType('link')}
                className={`flex flex-1 items-center justify-center space-x-1.5 rounded-md py-1.5 transition ${
                  shareType === 'link' ? 'bg-white font-semibold text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                <LinkIcon className="h-3.5 w-3.5" />
                <span>Expiring Link</span>
              </button>
              <button
                type="button"
                onClick={() => setShareType('user')}
                className={`flex flex-1 items-center justify-center space-x-1.5 rounded-md py-1.5 transition ${
                  shareType === 'user' ? 'bg-white font-semibold text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                <UserIcon className="h-3.5 w-3.5" />
                <span>LifeVault User</span>
              </button>
            </div>

            {shareType === 'user' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700">Recipient LifeVault Email</label>
                <input
                  type="email"
                  required
                  value={targetEmail}
                  onChange={(e) => setTargetEmail(e.target.value)}
                  placeholder="recipient@example.com"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700">Access Permission</label>
              <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setPermission('view')}
                  className={`rounded-lg border p-2 text-left transition ${
                    permission === 'view' ? 'border-blue-600 bg-blue-50/50 font-semibold text-blue-900' : 'border-slate-200 text-slate-600'
                  }`}
                >
                  <p>View Only</p>
                  <p className="text-[10px] text-slate-400 font-normal">Preview in browser</p>
                </button>
                <button
                  type="button"
                  onClick={() => setPermission('download')}
                  className={`rounded-lg border p-2 text-left transition ${
                    permission === 'download' ? 'border-blue-600 bg-blue-50/50 font-semibold text-blue-900' : 'border-slate-200 text-slate-600'
                  }`}
                >
                  <p>View & Download</p>
                  <p className="text-[10px] text-slate-400 font-normal">Permits file download</p>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Expires At (Optional)</label>
                <input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Max Downloads (Optional)</label>
                <input
                  type="number"
                  min="1"
                  value={maxDownloads}
                  onChange={(e) => setMaxDownloads(e.target.value)}
                  placeholder="e.g. 1 (One-Time)"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 p-2.5 text-[11px] text-slate-500 flex items-start space-x-1.5">
              <ShieldAlert className="h-3.5 w-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
              <span>You retain full sovereignty. Any link can be revoked instantly at any time from the sharing dashboard.</span>
            </div>

            <div className="flex justify-end space-x-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Creating...' : 'Create Share Grant'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
