import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  HardDrive,
  Share2,
  Clock,
  Plus,
  AlertTriangle,
  ArrowUpRight,
  ShieldCheck,
  FolderLock,
  Calendar,
  Lock,
} from 'lucide-react';
import { DashboardService, DocumentService } from '../services/api';
import { DashboardSummary, DocumentCategory, DocumentItem } from '../types';
import { UploadModal } from '../components/UploadModal';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const [sumData, catData] = await Promise.all([
        DashboardService.getSummary(),
        DocumentService.getCategories(),
      ]);
      setSummary(sumData);
      setCategories(catData);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex items-center space-x-2 text-slate-500">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <span className="text-xs font-semibold">Loading LifeVault metrics...</span>
        </div>
      </div>
    );
  }

  const storageUsedMB = ((summary?.storage_used_bytes || 0) / (1024 * 1024)).toFixed(1);
  const storageLimitMB = ((summary?.storage_limit_bytes || 104857600) / (1024 * 1024)).toFixed(0);
  const percentUsed = Math.min(
    Math.round(((summary?.storage_used_bytes || 0) / (summary?.storage_limit_bytes || 104857600)) * 100),
    100
  );

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Personal Vault Dashboard</h1>
          <p className="text-xs text-slate-500">
            Encrypted storage, document lifecycle, sharing, and emergency recovery status.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsUploadOpen(true)}
            className="flex items-center space-x-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm shadow-blue-500/20 hover:bg-blue-700 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Upload Document</span>
          </button>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Documents */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Stored Documents</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <FolderLock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-slate-900">{summary?.total_documents || 0}</span>
            <span className="text-xs text-slate-500">({summary?.archived_count || 0} archived)</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">All files encrypted with AES-256</p>
        </div>

        {/* Storage Quota */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Storage Usage</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <HardDrive className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-1">
            <span className="text-2xl font-bold text-slate-900">{storageUsedMB} MB</span>
            <span className="text-xs text-slate-500">/ {storageLimitMB} MB</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${
                percentUsed > 85 ? 'bg-rose-500' : percentUsed > 65 ? 'bg-amber-500' : 'bg-blue-600'
              }`}
              style={{ width: `${percentUsed}%` }}
            />
          </div>
        </div>

        {/* Active Share Links */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Active Share Links</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <Share2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-slate-900">{summary?.active_shares_count || 0}</span>
            <span className="text-xs text-emerald-600 font-medium">Hashed & Monitored</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Time-bound & revocable grants</p>
        </div>

        {/* Reminders / Expirations */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Upcoming Expirations</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-slate-900">{summary?.upcoming_expirations?.length || 0}</span>
            <span className="text-xs text-amber-600 font-medium">Next 60 Days</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">{summary?.unresolved_reminders_count || 0} active alarms</p>
        </div>
      </div>

      {/* Category Distribution Pills */}
      {summary?.category_distribution && summary.category_distribution.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Category Distribution</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {summary.category_distribution.map((cat) => (
              <button
                key={cat.id}
                onClick={() => navigate(`/documents?category=${cat.name}`)}
                className="flex items-center space-x-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 hover:border-blue-500 hover:bg-blue-50/50 transition"
              >
                <span className="font-semibold text-slate-900">{cat.display_name}</span>
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700">
                  {cat.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Split Section: Upcoming Expirations & Recent Uploads */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Upcoming Expirations */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span>Documents Requiring Attention</span>
              </h2>
              <button
                onClick={() => navigate('/reminders')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                View all
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {summary?.upcoming_expirations && summary.upcoming_expirations.length > 0 ? (
                summary.upcoming_expirations.map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => navigate(`/documents/${doc.id}`)}
                    className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-100 bg-slate-50/60 p-2.5 hover:bg-slate-100 transition"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="truncate text-xs font-semibold text-slate-900">{doc.title}</p>
                      <p className="text-[11px] text-slate-500">{doc.category?.display_name || 'General'}</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span className="inline-block rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                        {doc.expiry_date}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-8 text-center text-xs text-slate-400">
                  No upcoming expirations in the next 60 days.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Recently Uploaded Documents */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-1.5">
                <FileText className="h-4 w-4 text-blue-600" />
                <span>Recently Stored Documents</span>
              </h2>
              <button
                onClick={() => navigate('/documents')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                View all
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {summary?.recent_documents && summary.recent_documents.length > 0 ? (
                summary.recent_documents.map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => navigate(`/documents/${doc.id}`)}
                    className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-100 bg-slate-50/60 p-2.5 hover:bg-slate-100 transition"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="truncate text-xs font-semibold text-slate-900">{doc.title}</p>
                      <p className="text-[11px] text-slate-500">
                        {formatBytes(doc.file_size)} • v{doc.current_version}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right text-[11px] text-slate-400">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-8 text-center text-xs text-slate-400">No documents stored yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Security & Audit Events */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900">Tamper-Evident Audit Feed</h2>
          </div>
          <button
            onClick={() => navigate('/audit')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800"
          >
            Verify Chain
          </button>
        </div>

        <div className="mt-3 divide-y divide-slate-100">
          {summary?.recent_audit_events && summary.recent_audit_events.length > 0 ? (
            summary.recent_audit_events.map((evt) => (
              <div key={evt.id} className="flex items-center justify-between py-2.5 text-xs">
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-[11px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                    {evt.action}
                  </span>
                  <span className="text-slate-600">{evt.target_type || 'System'}</span>
                </div>
                <div className="flex items-center space-x-4 text-[11px] text-slate-400">
                  <span>{evt.ip_address || '127.0.0.1'}</span>
                  <span>{new Date(evt.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
            ))
          ) : (
            <p className="py-4 text-center text-xs text-slate-400">No recent security events.</p>
          )}
        </div>
      </div>

      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        categories={categories}
        onUploadSuccess={() => fetchDashboardData()}
      />
    </div>
  );
};
