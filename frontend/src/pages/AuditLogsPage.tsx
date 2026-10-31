import React, { useEffect, useState } from 'react';
import { ShieldCheck, AlertTriangle, RefreshCw, Key, Database, Hash } from 'lucide-react';
import { AuditService } from '../services/api';
import { AuditEventItem } from '../types';

export const AuditLogsPage: React.FC = () => {
  const [events, setEvents] = useState<AuditEventItem[]>([]);
  const [verification, setVerification] = useState<{
    is_valid: boolean;
    total_events: number;
    message: string;
    broken_event_id: string | null;
  } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  const fetchAuditData = async () => {
    setIsLoading(true);
    try {
      const [evts, ver] = await Promise.all([
        AuditService.getEvents(),
        AuditService.verifyChain(),
      ]);
      setEvents(evts);
      setVerification(ver);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditData();
  }, []);

  const handleReverify = async () => {
    setIsVerifying(true);
    try {
      const ver = await AuditService.verifyChain();
      setVerification(ver);
    } catch (err) {
      console.error(err);
    } finally {
      setIsVerifying(false);
    }
  };

  const getActionBadgeColor = (action: string) => {
    if (action.startsWith('AUTH_LOGIN_FAIL') || action.includes('DELETE') || action.includes('REVOKE')) {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    if (action.startsWith('AUTH')) {
      return 'bg-purple-50 text-purple-700 border-purple-200';
    }
    if (action.startsWith('DOCUMENT')) {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    if (action.startsWith('SHARE')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    return 'bg-slate-50 text-slate-700 border-slate-200';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Tamper-Evident Audit History</h1>
          <p className="text-xs text-slate-500">
            Append-only chronological record secured by sequential SHA-256 cryptographic hash chaining.
          </p>
        </div>
        <button
          onClick={handleReverify}
          disabled={isVerifying}
          className="flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isVerifying ? 'animate-spin text-blue-600' : ''}`} />
          <span>Re-verify Chain Integrity</span>
        </button>
      </div>

      {/* Verification Status Card */}
      {verification && (
        <div
          className={`rounded-xl border p-4 text-xs transition ${
            verification.is_valid
              ? 'border-emerald-200 bg-emerald-50/70 text-emerald-950'
              : 'border-rose-300 bg-rose-50 text-rose-950'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2 font-bold text-sm">
              {verification.is_valid ? (
                <>
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  <span>Cryptographic Chain Intact: All {verification.total_events} Event Hashes Validated</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-rose-600" />
                  <span>INTEGRITY FAILURE: Chain Broken at Event {verification.broken_event_id}</span>
                </>
              )}
            </div>
            <span className="rounded bg-white/80 px-2 py-0.5 text-[11px] font-mono font-semibold">
              SHA-256 Chained
            </span>
          </div>
          <p className="mt-1 text-slate-600 text-[11px]">{verification.message}</p>
        </div>
      )}

      {/* Events Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <table className="min-w-full divide-y divide-slate-200 text-xs">
          <thead className="bg-slate-50 text-slate-500 font-semibold">
            <tr>
              <th className="py-3 px-4 text-left">Action</th>
              <th className="py-3 px-4 text-left">Target</th>
              <th className="py-3 px-4 text-left">Actor / IP</th>
              <th className="py-3 px-4 text-left">Timestamp</th>
              <th className="py-3 px-4 text-left">Sequential Hash Chain</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400">
                  Loading cryptographic audit ledger...
                </td>
              </tr>
            ) : events.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400">
                  No audit events recorded yet.
                </td>
              </tr>
            ) : (
              events.map((evt) => (
                <tr key={evt.id} className="hover:bg-slate-50/60">
                  <td className="py-3 px-4 font-mono font-bold">
                    <span className={`inline-block rounded border px-2 py-0.5 text-[10px] ${getActionBadgeColor(evt.action)}`}>
                      {evt.action}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-semibold text-slate-900">{evt.target_type || '—'}</p>
                    {evt.target_id && <p className="font-mono text-[10px] text-slate-400 truncate max-w-[120px]">{evt.target_id}</p>}
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-semibold text-slate-800">{evt.actor_email || 'System'}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{evt.ip_address || '127.0.0.1'}</p>
                  </td>
                  <td className="py-3 px-4 text-[11px] text-slate-500">
                    {new Date(evt.timestamp).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 font-mono text-[10px] text-slate-500">
                    <div className="space-y-0.5">
                      <p className="truncate max-w-[200px]" title={evt.prev_hash}>
                        <span className="text-slate-400">Prev: </span>{evt.prev_hash.substring(0, 16)}...
                      </p>
                      <p className="truncate max-w-[200px] text-blue-700 font-semibold" title={evt.current_hash}>
                        <span className="text-slate-400">Curr: </span>{evt.current_hash.substring(0, 16)}...
                      </p>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
