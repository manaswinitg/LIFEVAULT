import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  FileText,
  Search,
  Filter,
  LayoutGrid,
  List,
  Download,
  Share2,
  History,
  Trash2,
  RotateCcw,
  Plus,
  Archive,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { DocumentService } from '../services/api';
import { DocumentItem, DocumentCategory } from '../types';
import { UploadModal } from '../components/UploadModal';
import { ShareModal } from '../components/ShareModal';
import { VersionModal } from '../components/VersionModal';

export const DocumentsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>(searchParams.get('category') || '');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modals state
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [shareDoc, setShareDoc] = useState<DocumentItem | null>(null);
  const [versionDoc, setVersionDoc] = useState<DocumentItem | null>(null);

  const isTrashView = searchParams.get('trash') === 'true';

  const fetchDocuments = async () => {
    setIsLoading(true);
    try {
      if (isTrashView) {
        const trash = await DocumentService.getTrash();
        setDocuments(trash);
      } else {
        const docs = await DocumentService.list({
          category: selectedCategory || undefined,
          q: searchQuery || undefined,
        });
        setDocuments(docs);
      }
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    DocumentService.getCategories().then(setCategories).catch(console.error);
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [selectedCategory, searchQuery, isTrashView]);

  const handleDownload = (doc: DocumentItem) => {
    DocumentService.download(doc.id, doc.original_filename);
  };

  const handleSoftDelete = async (id: string) => {
    if (window.confirm('Move this document to the trash bin?')) {
      await DocumentService.delete(id);
      fetchDocuments();
    }
  };

  const handleRestoreFromTrash = async (id: string) => {
    await DocumentService.restoreTrash(id);
    fetchDocuments();
  };

  const handlePermanentDelete = async (id: string) => {
    if (window.confirm('PERMANENTLY SHRED this document and all historical versions from disk? This cannot be undone.')) {
      await DocumentService.permanentDelete(id);
      fetchDocuments();
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            {isTrashView ? 'Trash Bin & Retention Recovery' : 'Vault Document Repository'}
          </h1>
          <p className="text-xs text-slate-500">
            {isTrashView
              ? 'Documents retained in trash can be restored before retention period expires.'
              : 'End-to-end encrypted personal records and verified credentials.'}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {!isTrashView && (
            <button
              onClick={() => setIsUploadOpen(true)}
              className="flex items-center space-x-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition"
            >
              <Plus className="h-4 w-4" />
              <span>Upload Record</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center space-x-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, description, issuer, tag..."
              className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
            />
          </div>

          {!isTrashView && (
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.display_name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* View mode toggle */}
        <div className="flex items-center space-x-1 border border-slate-200 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('grid')}
            className={`rounded p-1 text-slate-600 ${viewMode === 'grid' ? 'bg-slate-100 text-slate-900 font-bold' : ''}`}
            title="Grid View"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`rounded p-1 text-slate-600 ${viewMode === 'table' ? 'bg-slate-100 text-slate-900 font-bold' : ''}`}
            title="Table View"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content Rendering */}
      {isLoading ? (
        <div className="py-20 text-center text-xs text-slate-400">Loading encrypted records...</div>
      ) : documents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-slate-300" />
          <h3 className="mt-2 text-sm font-semibold text-slate-800">
            {isTrashView ? 'Trash bin is empty' : 'No vault documents found'}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            {isTrashView
              ? 'Deleted documents will appear here during their retention period.'
              : 'Upload educational degrees, certificates, identity cards, or policies.'}
          </p>
          {!isTrashView && (
            <button
              onClick={() => setIsUploadOpen(true)}
              className="mt-4 inline-flex items-center space-x-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              <span>Upload Document</span>
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:border-blue-400 hover:shadow-sm transition"
            >
              <div>
                <div className="flex items-start justify-between">
                  <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                    {doc.category?.display_name || 'General'}
                  </span>
                  <span className="flex items-center space-x-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                    <span>v{doc.current_version}</span>
                  </span>
                </div>

                <h3
                  onClick={() => navigate(`/documents/${doc.id}`)}
                  className="mt-2.5 cursor-pointer text-sm font-bold text-slate-900 hover:text-blue-600 truncate"
                  title={doc.title}
                >
                  {doc.title}
                </h3>
                <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                  {doc.description || doc.original_filename}
                </p>

                {doc.tags && doc.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {doc.tags.map((t) => (
                      <span key={t.id} className="rounded bg-slate-50 border border-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 font-medium">
                        #{t.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>{formatBytes(doc.file_size)}</span>
                  {doc.expiry_date && (
                    <span className="font-medium text-amber-700 bg-amber-50 px-1 rounded">
                      Exp: {doc.expiry_date}
                    </span>
                  )}
                </div>

                {/* Card Actions */}
                <div className="mt-3 flex items-center justify-between">
                  {!isTrashView ? (
                    <>
                      <button
                        onClick={() => handleDownload(doc)}
                        className="flex items-center space-x-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Download</span>
                      </button>

                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => setShareDoc(doc)}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          title="Share"
                        >
                          <Share2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setVersionDoc(doc)}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          title="Version History"
                        >
                          <History className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleSoftDelete(doc.id)}
                          className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          title="Move to Trash"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleRestoreFromTrash(doc.id)}
                        className="flex items-center space-x-1 text-xs font-semibold text-emerald-600 hover:text-emerald-800"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>Restore</span>
                      </button>
                      <button
                        onClick={() => handlePermanentDelete(doc.id)}
                        className="flex items-center space-x-1 text-xs font-semibold text-rose-600 hover:text-rose-800"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Permanent Shred</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold">
              <tr>
                <th className="py-3 px-4 text-left">Document Title</th>
                <th className="py-3 px-4 text-left">Category</th>
                <th className="py-3 px-4 text-left">Version</th>
                <th className="py-3 px-4 text-left">Size</th>
                <th className="py-3 px-4 text-left">Expiry</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50/60">
                  <td className="py-3 px-4 font-semibold text-slate-900 cursor-pointer" onClick={() => navigate(`/documents/${doc.id}`)}>
                    {doc.title}
                  </td>
                  <td className="py-3 px-4">{doc.category?.display_name || 'General'}</td>
                  <td className="py-3 px-4">v{doc.current_version}</td>
                  <td className="py-3 px-4">{formatBytes(doc.file_size)}</td>
                  <td className="py-3 px-4">{doc.expiry_date || '—'}</td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      {!isTrashView ? (
                        <>
                          <button onClick={() => handleDownload(doc)} className="text-blue-600 hover:underline">
                            Download
                          </button>
                          <button onClick={() => setShareDoc(doc)} className="text-slate-500 hover:text-slate-900">
                            Share
                          </button>
                          <button onClick={() => handleSoftDelete(doc.id)} className="text-rose-600 hover:underline">
                            Trash
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => handleRestoreFromTrash(doc.id)} className="text-emerald-600 hover:underline">
                            Restore
                          </button>
                          <button onClick={() => handlePermanentDelete(doc.id)} className="text-rose-600 hover:underline">
                            Shred
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        categories={categories}
        onUploadSuccess={() => fetchDocuments()}
      />

      <ShareModal
        isOpen={!!shareDoc}
        onClose={() => setShareDoc(null)}
        document={shareDoc}
      />

      <VersionModal
        isOpen={!!versionDoc}
        onClose={() => setVersionDoc(null)}
        document={versionDoc}
        onVersionUpdated={() => fetchDocuments()}
      />
    </div>
  );
};
