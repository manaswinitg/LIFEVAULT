import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Shield, Download, FileText, Lock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { SharingService } from '../services/api';

export const PublicSharePage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [metadata, setMetadata] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  useEffect(() => {
    if (!token) return;
    SharingService.getPublicMetadata(token)
      .then((data) => {
        setMetadata(data);
      })
      .catch((err) => {
        setErrorMsg(err.response?.data?.error?.message || 'Invalid, revoked, or expired share link.');
      })
      .finally(() => setIsLoading(false));
  }, [token]);

  const handleDownload = async () => {
    if (!token || !metadata) return;
    setIsDownloading(true);
    try {
      await SharingService.downloadPublicFile(token, metadata.original_filename);
      // Refresh metadata to reflect download count update
      const updated = await SharingService.getPublicMetadata(token);
      setMetadata(updated);
    } catch (err: any) {
      alert('Download failed: ' + (err.response?.data?.error?.message || err.message));
    } finally {
      setIsDownloading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900">LifeVault Secure Share</h1>
            <p className="text-xs text-slate-500">Encrypted personal record delivery</p>
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-400">Verifying security token...</div>
        ) : errorMsg ? (
          <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 space-y-2">
            <div className="flex items-center space-x-2 font-bold text-rose-900">
              <AlertTriangle className="h-4 w-4" />
              <span>Access Denied</span>
            </div>
            <p>{errorMsg}</p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                Shared Document
              </span>
              <h2 className="text-base font-bold text-slate-900">{metadata.title}</h2>
              {metadata.description && (
                <p className="text-xs text-slate-600">{metadata.description}</p>
              )}

              <div className="grid grid-cols-2 gap-2 border-t border-slate-200/60 pt-3 text-xs text-slate-500">
                <div>
                  <span>File:</span>
                  <p className="font-semibold text-slate-800 truncate">{metadata.original_filename}</p>
                </div>
                <div>
                  <span>Size:</span>
                  <p className="font-semibold text-slate-800">{formatBytes(metadata.file_size)}</p>
                </div>
                <div>
                  <span>Permission:</span>
                  <p className="font-semibold text-slate-800 uppercase">{metadata.permission}</p>
                </div>
                <div>
                  <span>Downloads:</span>
                  <p className="font-semibold text-slate-800">
                    {metadata.download_count} {metadata.max_downloads ? `/ ${metadata.max_downloads}` : ''}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 rounded-lg bg-emerald-50 p-2.5 text-[11px] text-emerald-800">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
              <span>Decrypted securely via authenticated AES-256-GCM verification.</span>
            </div>

            {metadata.can_download ? (
              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className="flex w-full items-center justify-center space-x-2 rounded-xl bg-blue-600 py-3 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-50 transition"
              >
                <Download className="h-4 w-4" />
                <span>{isDownloading ? 'Decrypting & Downloading...' : 'Download Verified Document'}</span>
              </button>
            ) : (
              <div className="rounded-lg bg-slate-100 p-3 text-center text-xs text-slate-600">
                This link permits preview only or download limit has been reached.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
