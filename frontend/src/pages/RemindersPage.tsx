import React, { useEffect, useState } from 'react';
import { Clock, AlertTriangle, CheckCircle2, Bell, Plus, Calendar, ShieldCheck } from 'lucide-react';
import { ReminderService } from '../services/api';
import { DocumentItem, NotificationItem } from '../types';

export const RemindersPage: React.FC = () => {
  const [upcomingDocs, setUpcomingDocs] = useState<DocumentItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // New reminder configuration modal
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [daysBefore, setDaysBefore] = useState<number>(30);
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [upData, notifData] = await Promise.all([
        ReminderService.getUpcoming(),
        ReminderService.getNotifications(),
      ]);
      setUpcomingDocs(upData);
      setNotifications(notifData.results || []);
      setUnreadCount(notifData.unread_count || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDocId) return;
    try {
      await ReminderService.createReminder({
        document_id: selectedDocId,
        reminder_days_before: daysBefore,
      });
      setShowConfigModal(false);
      setSelectedDocId('');
      fetchData();
    } catch (err: any) {
      alert('Failed to configure reminder: ' + (err.response?.data?.error?.message || err.message));
    }
  };

  const handleMarkRead = async (id: string) => {
    await ReminderService.markRead(id);
    fetchData();
  };

  const handleMarkAllRead = async () => {
    await ReminderService.markAllRead();
    fetchData();
  };

  const getDaysDiff = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(dateStr);
    const diffTime = exp.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Document Expirations & Reminders</h1>
          <p className="text-xs text-slate-500">
            Automated lifecycle alarms (30, 7, and 1 day) and notification history.
          </p>
        </div>
        <button
          onClick={() => setShowConfigModal(true)}
          className="flex items-center space-x-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition"
        >
          <Plus className="h-4 w-4" />
          <span>Configure Expiry Reminder</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Upcoming Expirations */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2 border-b border-slate-100 pb-3">
              <Calendar className="h-4 w-4 text-blue-600" />
              <span>Upcoming Document Expirations</span>
            </h2>

            {isLoading ? (
              <div className="py-12 text-center text-xs text-slate-400">Loading expiration calendar...</div>
            ) : upcomingDocs.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No documents with recorded expiry dates.
              </div>
            ) : (
              <div className="mt-4 divide-y divide-slate-100">
                {upcomingDocs.map((doc) => {
                  const days = doc.expiry_date ? getDaysDiff(doc.expiry_date) : 0;
                  const isUrgent = days <= 7;
                  return (
                    <div key={doc.id} className="flex items-center justify-between py-3 text-xs">
                      <div className="pr-2">
                        <p className="font-semibold text-slate-900">{doc.title}</p>
                        <p className="text-[11px] text-slate-500">
                          {doc.category?.display_name || 'General'} • Expires on {doc.expiry_date}
                        </p>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span
                          className={`rounded px-2 py-0.5 text-[11px] font-bold ${
                            isUrgent ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {days < 0 ? `Expired ${Math.abs(days)}d ago` : days === 0 ? 'Expires today' : `In ${days} days`}
                        </span>
                        <button
                          onClick={() => {
                            setSelectedDocId(doc.id);
                            setShowConfigModal(true);
                          }}
                          className="rounded border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Remind Me
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: In-App Notification Center */}
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <Bell className="h-4 w-4 text-slate-700" />
                <span>Notification Center</span>
              </h2>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="mt-3 max-h-96 space-y-2 overflow-y-auto pr-1">
              {notifications.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-400">No alerts in your history.</p>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => !n.is_read && handleMarkRead(n.id)}
                    className={`rounded-lg p-3 text-xs transition cursor-pointer ${
                      n.is_read ? 'bg-slate-50 text-slate-600' : 'bg-blue-50/70 border-l-2 border-blue-600 text-slate-900 font-medium'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">{n.title}</span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(n.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-600">{n.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Reminder Configuration Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-900">Configure Expiry Alert</h3>
            <form onSubmit={handleCreateReminder} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700">Select Document</label>
                <select
                  required
                  value={selectedDocId}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none"
                >
                  <option value="">Select a document</option>
                  {upcomingDocs.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title} (Exp: {d.expiry_date})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700">Reminder Lead Time</label>
                <select
                  value={daysBefore}
                  onChange={(e) => setDaysBefore(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none"
                >
                  <option value={30}>30 Days Before Expiry</option>
                  <option value={14}>14 Days Before Expiry</option>
                  <option value={7}>7 Days Before Expiry</option>
                  <option value={1}>1 Day Before Expiry</option>
                  <option value={0}>On Expiry Date</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="rounded-lg border px-3 py-1.5 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-1.5 font-semibold text-white hover:bg-blue-700"
                >
                  Set Reminder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
