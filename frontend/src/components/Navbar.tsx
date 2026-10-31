import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Bell, CheckCircle2, AlertTriangle, LogOut, User as UserIcon, Settings, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ReminderService } from '../services/api';
import { NotificationItem } from '../types';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isOpenNotifications, setIsOpenNotifications] = useState<boolean>(false);
  const [isOpenUserMenu, setIsOpenUserMenu] = useState<boolean>(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const data = await ReminderService.getNotifications();
      setNotifications(data.results || []);
      setUnreadCount(data.unread_count || 0);
    } catch {
      // silently ignore
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Polling every 30s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsOpenNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsOpenUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkRead = async (id: string) => {
    await ReminderService.markRead(id);
    fetchNotifications();
  };

  const handleMarkAllRead = async () => {
    await ReminderService.markAllRead();
    fetchNotifications();
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-slate-900">LifeVault</span>
            <span className="ml-1.5 hidden rounded bg-blue-50 px-1.5 py-0.5 text-xs font-semibold text-blue-700 sm:inline-block">
              AES-256
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        {/* Search quick button */}
        <button
          onClick={() => navigate('/documents')}
          className="flex items-center space-x-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Search vault records...</span>
        </button>

        {/* Notifications Dropdown */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setIsOpenNotifications(!isOpenNotifications)}
            className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {isOpenNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-slate-200 bg-white p-3 shadow-xl z-50">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-sm font-semibold text-slate-900">Notifications ({unreadCount})</span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="mt-2 max-h-72 space-y-2 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-400">No alerts at this time.</p>
                ) : (
                  notifications.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => !item.is_read && handleMarkRead(item.id)}
                      className={`cursor-pointer rounded-lg p-2.5 text-xs transition ${
                        item.is_read ? 'bg-slate-50 text-slate-600' : 'bg-blue-50/60 text-slate-900 font-medium border-l-2 border-blue-600'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <span className="font-semibold text-slate-800">{item.title}</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="mt-1 text-slate-600">{item.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setIsOpenUserMenu(!isOpenUserMenu)}
            className="flex items-center space-x-2 rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50 transition"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-100 font-semibold text-blue-700 text-xs">
              {user?.email ? user.email[0].toUpperCase() : 'U'}
            </div>
            <span className="hidden text-xs font-medium text-slate-700 md:block max-w-[120px] truncate">
              {user?.full_name || user?.email}
            </span>
          </button>

          {isOpenUserMenu && (
            <div className="absolute right-0 mt-2 w-52 rounded-xl border border-slate-200 bg-white py-1 shadow-lg z-50">
              <div className="border-b border-slate-100 px-3 py-2 text-xs">
                <p className="font-semibold text-slate-800 truncate">{user?.full_name || 'LifeVault User'}</p>
                <p className="text-slate-500 truncate">{user?.email}</p>
              </div>
              <button
                onClick={() => { setIsOpenUserMenu(false); navigate('/settings'); }}
                className="flex w-full items-center space-x-2 px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
              >
                <Settings className="h-4 w-4 text-slate-400" />
                <span>Security & Settings</span>
              </button>
              <button
                onClick={logout}
                className="flex w-full items-center space-x-2 px-3 py-2 text-left text-xs text-rose-600 hover:bg-rose-50"
              >
                <LogOut className="h-4 w-4" />
                <span>Log Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
