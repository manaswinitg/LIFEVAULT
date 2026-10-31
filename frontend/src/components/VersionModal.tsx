import React, { useState } from 'react';
import { X, History, Upload, Download, RotateCcw, CheckCircle2, FileText } from 'lucide-react';
import { DocumentService } from '../services/api';
import { DocumentItem, DocumentVersion } from '../types';

interface VersionModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: DocumentItem | null;
  onVersionUpdated: () => void;
}

export const VersionModal: React.FC<VersionModalProps> = ({ isOpen, onClose, document, onVersionUpdated }) => {
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [showUploadForm, setShowUploadForm] = useState<boolean>(false);

  if (!isOpen || !document) return null;

  const handleUploadNewVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsUploading(true);
    setErrorMsg('');

    const formData = new FormData();
    formData.append('file', file);
    if (notes) formData.append('version_notes', notes);

    try {
      await DocumentService.uploadVersion(document.id, formData);
      setFile(null);
      setNotes('');
      setShowUploadForm(false);
      onVersionUpdated();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error?.message || 'Failed to upload revised version.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRestoreVersion = async (versionNumber: number) => {
    if (!window.confirm(`Are you sure you want to restore Version ${versionNumber} as the active current version?`)) {
      return;
    }
    try {
      await DocumentService.restoreVersion(document.id, versionNumber);
      onVersionUpdated();
    } catch (err: any) {
      alert('Failed to restore version: ' + (err.response?.data?.error?.message || err.message));
    }
  };

  const handleDownloadHistorical = (versionNumber: number) => {
    DocumentService.downloadVersion(document.id, versionNumber, `v${versionNumber}_${document.original_filename}`);
  };

  const versions = document.versions || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
              <History className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Version History Timeline</h3>
              <p className="text-xs text-slate-500 truncate max-w-[280px]">{document.title}</p>
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

        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700">Total Versions: {versions.length || 1}</span>
          <button
            onClick={() => setShowUploadForm(!showUploadForm)}
            className="flex items-center space-x-1.5 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>{showUploadForm ? 'Cancel Revision' : 'Upload Revision'}</span>
          </button>
        </div>

        {showUploadForm && (
          <form onSubmit={handleUploadNewVersion} className="mt-3 rounded-xl border border-blue-200 bg-blue-50/40 p-3.5 space-y-3">
            <h4 className="text-xs font-bold text-slate-900">Upload Revision (v{document.current_version + 1})</h4>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700">New Document File</label>
              <input
                type="file"
                required
                onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                className="mt-1 block w-full text-xs text-slate-500 file:mr-2 file:rounded file:border-0 file:bg-blue-600 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-white hover:file:bg-blue-700"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700">Revision Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Updated terms on page 3"
                className="mt-1 w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:outline-none"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                type="submit"
                disabled={isUploading || !file}
                className="rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isUploading ? 'Uploading & Encrypting...' : 'Save New Version'}
              </button>
            </div>
          </form>
        )}

        <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
          {versions.map((ver) => {
            const isCurrent = ver.version_number === document.current_version;
            return (
              <div
                key={ver.id}
                className={`rounded-xl border p-3 text-xs transition ${
                  isCurrent ? 'border-blue-300 bg-blue-50/40' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                      v{ver.version_number}
                    </span>
                    <span className="font-semibold text-slate-900">
                      {isCurrent ? 'Current Active Version' : `Historical Version ${ver.version_number}`}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {new Date(ver.created_at).toLocaleString()}
                  </span>
                </div>

                {ver.version_notes && (
                  <p className="mt-1 text-slate-600 italic">"{ver.version_notes}"</p>
                )}

                <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                  <span className="font-mono text-[10px] truncate max-w-[200px]" title={ver.sha256_hash}>
                    SHA: {ver.sha256_hash.substring(0, 16)}...
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleDownloadHistorical(ver.version_number)}
                      className="flex items-center space-x-1 rounded px-2 py-0.5 font-medium text-blue-600 hover:bg-blue-50"
                    >
                      <Download className="h-3 w-3" />
                      <span>Download</span>
                    </button>
                    {!isCurrent && (
                      <button
                        onClick={() => handleRestoreVersion(ver.version_number)}
                        className="flex items-center space-x-1 rounded px-2 py-0.5 font-medium text-emerald-600 hover:bg-emerald-50"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>Restore</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-100 px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
