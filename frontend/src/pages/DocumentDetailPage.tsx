import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  Share2,
  History,
  Archive,
  Trash2,
  ShieldCheck,
  Eye,
  EyeOff,
  Calendar,
  Building,
  Hash,
  FileCheck,
  Lock,
} from 'lucide-react';
import { DocumentService } from '../services/api';
import { DocumentItem, DocumentCategory } from '../types';
import { ShareModal } from '../components/ShareModal';
import { VersionModal } from '../components/VersionModal';

export const DocumentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [document, setDocument] = useState<DocumentItem | null>(null);
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showSensitiveRef, setShowSensitiveRef] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Edit fields
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [issuer, setIssuer] = useState<string>('');
  const [refNumber, setRefNumber] = useState<string>('');
  const [tagsInput, setTagsInput] = useState<string>('');

  // Modals
  const [isShareOpen, setIsShareOpen] = useState<boolean>(false);
  const [isVersionOpen, setIsVersionOpen] = useState<boolean>(false);

  const fetchDocument = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const [docData, catData] = await Promise.all([
        DocumentService.getDetail(id),
        DocumentService.getCategories(),
      ]);
      setDocument(docData);
      setCategories(catData);
      setTitle(docData.title);
      setDescription(docData.description || '');
      setCategoryId(docData.category?.id || '');
      setExpiryDate(docData.expiry_date || '');
      setIssuer(docData.issuer || '');
      setRefNumber(docData.reference_number || '');
      setTagsInput(docData.tags?.map((t) => t.name).join(', ') || '');
    } catch (err) {
      console.error(err);
      navigate('/documents');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDocument();
  }, [id]);

  const handleSaveMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    const tagNames = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
    try {
      const updated = await DocumentService.update(id, {
        title,
        description,
        category_id: categoryId || undefined,
        expiry_date: expiryDate || null,
        issuer,
        reference_number: refNumber,
        tag_names: tagNames,
      });
      setDocument(updated);
      setIsEditing(false);
    } catch (err: any) {
      alert('Failed to update document: ' + (err.response?.data?.error?.message || err.message));
    }
  };

  const handleDownload = () => {
    if (document) {
      DocumentService.download(document.id, document.original_filename);
    }
  };

  const handleToggleArchive = async () => {
    if (!document) return;
    const res = await DocumentService.toggleArchive(document.id);
    setDocument({ ...document, is_archived: res.is_archived });
  };

  const handleDelete = async () => {
    if (!document) return;
    if (window.confirm('Move this document to the trash bin?')) {
      await DocumentService.delete(document.id);
      navigate('/documents');
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  if (isLoading || !document) {
    return <div className="py-20 text-center text-xs text-slate-400">Loading vault document...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Top back & actions */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <button
          onClick={() => navigate('/documents')}
          className="flex items-center space-x-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Documents</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleDownload}
            className="flex items-center space-x-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download Plaintext</span>
          </button>
          <button
            onClick={() => setIsShareOpen(true)}
            className="flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span>Share</span>
          </button>
          <button
            onClick={() => setIsVersionOpen(true)}
            className="flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            <History className="h-3.5 w-3.5" />
            <span>Versions (v{document.current_version})</span>
          </button>
          <button
            onClick={handleToggleArchive}
            className="flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            <Archive className="h-3.5 w-3.5" />
            <span>{document.is_archived ? 'Unarchive' : 'Archive'}</span>
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center space-x-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Trash</span>
          </button>
        </div>
      </div>

      {/* Main card */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Metadata details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                  {document.category?.display_name || 'General Category'}
                </span>
                <h1 className="mt-2 text-lg font-bold text-slate-900">{document.title}</h1>
              </div>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                {isEditing ? 'Cancel Editing' : 'Edit Metadata'}
              </button>
            </div>

            {isEditing ? (
              <form onSubmit={handleSaveMetadata} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Category</label>
                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none"
                    >
                      <option value="">No Category</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.display_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Expiry Date</label>
                    <input
                      type="date"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Issuer</label>
                    <input
                      type="text"
                      value={issuer}
                      onChange={(e) => setIssuer(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Reference Number</label>
                    <input
                      type="text"
                      value={refNumber}
                      onChange={(e) => setRefNumber(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Tags (comma-separated)</label>
                  <input
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Description</label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="rounded-lg border px-3 py-1.5 text-xs font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-4 space-y-4">
                {document.description && (
                  <p className="text-xs text-slate-600 leading-relaxed">{document.description}</p>
                )}

                <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-xs">
                  <div>
                    <span className="text-slate-400">Issuer / Authority:</span>
                    <p className="font-semibold text-slate-800">{document.issuer || 'Not specified'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Expiry Date:</span>
                    <p className="font-semibold text-slate-800">{document.expiry_date || 'No Expiry Set'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Original Filename:</span>
                    <p className="font-semibold text-slate-800 truncate">{document.original_filename}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">File Size:</span>
                    <p className="font-semibold text-slate-800">{formatBytes(document.file_size)}</p>
                  </div>
                </div>

                {/* Confidential Reference Number Section */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700 flex items-center space-x-1.5">
                      <Lock className="h-3.5 w-3.5 text-blue-600" />
                      <span>Confidential Reference Number</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowSensitiveRef(!showSensitiveRef)}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                    >
                      {showSensitiveRef ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      <span>{showSensitiveRef ? 'Hide' : 'Reveal'}</span>
                    </button>
                  </div>
                  <div className="mt-2 font-mono text-xs text-slate-900 bg-white p-2 rounded border border-slate-200">
                    {showSensitiveRef
                      ? document.reference_number || 'No reference number recorded.'
                      : '••••••••••••••••••••'}
                  </div>
                </div>

                {document.tags && document.tags.length > 0 && (
                  <div className="border-t border-slate-100 pt-3">
                    <span className="text-[11px] font-semibold text-slate-400">Tags:</span>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {document.tags.map((t) => (
                        <span key={t.id} className="rounded bg-blue-50 border border-blue-100 px-2 py-0.5 text-xs text-blue-700 font-medium">
                          #{t.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Cryptographic & Integrity Specs */}
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>Integrity & Encryption Details</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[11px] text-slate-400">Encryption Standard</span>
                <p className="font-semibold text-slate-800">AES-256-GCM (Authenticated AEAD)</p>
              </div>

              <div>
                <span className="text-[11px] text-slate-400">Cryptographic Nonce</span>
                <p className="font-mono text-[11px] text-slate-700">Unique 96-bit (12-byte) IV / Nonce</p>
              </div>

              <div>
                <span className="text-[11px] text-slate-400">Plaintext SHA-256 Hash</span>
                <p className="font-mono text-[10px] break-all text-slate-600 bg-slate-50 p-1.5 rounded border border-slate-100">
                  {document.sha256_hash}
                </p>
              </div>

              <div>
                <span className="text-[11px] text-slate-400">Storage Protection</span>
                <p className="text-slate-600">Isolated outside webroot; URL access forbidden.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        document={document}
      />

      <VersionModal
        isOpen={isVersionOpen}
        onClose={() => setIsVersionOpen(false)}
        document={document}
        onVersionUpdated={fetchDocument}
      />
    </div>
  );
};
