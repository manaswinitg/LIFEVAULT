import React, { useEffect, useState } from 'react';
import { Share2, Link as LinkIcon, User as UserIcon, ShieldAlert, Download, XCircle, Copy, Check, Eye } from 'lucide-react';
import { SharingService } from '../services/api';
import { ShareGrant } from '../types';

export const SharingPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'owned' | 'received'>('owned');
  const [ownedGrants, setOwnedGrants] = useState<ShareGrant[]>([]);
  const [receivedGrants, setReceivedGrants] = useState<ShareGrant[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchShares = async () => {
    setIsLoading(true);
    try {
      const [owned, received] = await Promise.all([
        SharingService.getGrants(),
        SharingService.getSharedWithMe(),
      ]);
      setOwnedGrants(owned);
      setReceivedGrants(received);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchShares();
  }, []);

  const handleRevoke = async (id: string) => {
    if (window.confirm('Revoke this share grant immediately? Recipients will lose access instantly.')) {
      await SharingService.revokeGrant(id);
      fetchShares();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Secure Document Sharing</h1>
          <p className="text-xs text-slate-500">
            Granular access controls, time-bound revocable links, and access audit logs.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl bg-slate-200/60 p-1 text-xs font-semibold w-fit">
        <button
          onClick={() => setActiveTab('owned')}
          className={`flex items-center space-x-1.5 rounded-lg px-4 py-2 transition ${
            activeTab === 'owned' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Share2 className="h-3.5 w-3.5" />
          <span>My Shared Grants ({ownedGrants.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('received')}
          className={`flex items-center space-x-1.5 rounded-lg px-4 py-2 transition ${
            activeTab === 'received' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <UserIcon className="h-3.5 w-3.5" />
          <span>Shared With Me ({receivedGrants.length})</span>
        </button>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-xs text-slate-400">Loading sharing records...</div>
      ) : activeTab === 'owned' ? (
        ownedGrants.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-xs text-slate-400">
            You have not shared any documents yet.
          </div>
        ) : (
          <div className="space-y-3">
            {ownedGrants.map((grant) => (
              <div
                key={grant.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                      {grant.shared_with_email ? `User: ${grant.shared_with_email}` : 'Secure Token Link'}
                    </span>
                    <h3 className="mt-1 text-sm font-bold text-slate-900">{grant.document_title}</h3>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span
                      className={`rounded px-2 py-0.5 text-[11px] font-bold ${
                        grant.is_revoked
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {grant.is_revoked ? 'Revoked' : 'Active'}
                    </span>

                    {!grant.is_revoked && (
                      <button
                        onClick={() => handleRevoke(grant.id)}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                      >
                        Revoke Access
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs border-t border-slate-100 pt-2 text-slate-600">
                  <div>
                    <span className="text-[11px] text-slate-400">Permission:</span>
                    <p className="font-semibold uppercase">{grant.permission}</p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400">Downloads:</span>
                    <p className="font-semibold">
                      {grant.download_count} {grant.max_downloads ? `/ ${grant.max_downloads} max` : '(unlimited)'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400">Expires:</span>
                    <p className="font-semibold">{grant.expires_at ? new Date(grant.expires_at).toLocaleString() : 'No Expiry'}</p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400">Created:</span>
                    <p className="font-semibold">{new Date(grant.created_at).toLocaleDateString()}</p>
                  </div>
                </div>

                {grant.access_logs && grant.access_logs.length > 0 && (
                  <div className="rounded-lg bg-slate-50 p-2.5 text-[11px] space-y-1">
                    <span className="font-semibold text-slate-700">Access Activity Logs:</span>
                    {grant.access_logs.map((log) => (
                      <div key={log.id} className="flex justify-between text-slate-500 font-mono">
                        <span>{log.action.toUpperCase()} • IP: {log.ip_address || 'unknown'}</span>
                        <span>{new Date(log.accessed_at).toLocaleTimeString()} ({log.success ? 'Granted' : 'Blocked'})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      ) : receivedGrants.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-xs text-slate-400">
          No documents have been shared directly with your account.
        </div>
      ) : (
        <div className="space-y-3">
          {receivedGrants.map((grant) => (
            <div
              key={grant.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
            >
              <div>
                <span className="text-xs text-slate-500">Shared by: {grant.owner_email}</span>
                <h3 className="text-sm font-bold text-slate-900">{grant.document_title}</h3>
                <span className="text-[11px] text-slate-400">Permission: {grant.permission}</span>
              </div>
              <div className="flex items-center space-x-2">
                {grant.permission === 'download' && (
                  <button
                    onClick={() => SharingService.downloadPublicFile(grant.id, `${grant.document_title}.pdf`)}
                    className="flex items-center space-x-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
