import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderLock,
  Clock,
  Share2,
  HeartHandshake,
  ShieldCheck,
  Trash2,
  Settings,
  HardDrive,
  Lock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Sidebar: React.FC = () => {
  const { user } = useAuth();

  const storageUsed = user?.profile?.storage_used_bytes || 0;
  const storageLimit = user?.profile?.storage_limit_bytes || 104857600; // 100 MB default
  const usedMB = (storageUsed / (1024 * 1024)).toFixed(1);
  const limitMB = (storageLimit / (1024 * 1024)).toFixed(0);
  const percentUsed = Math.min(Math.round((storageUsed / storageLimit) * 100), 100);

  const navItems = [
    { name: 'Dashboard', to: '/', icon: LayoutDashboard },
    { name: 'Vault Documents', to: '/documents', icon: FolderLock },
    { name: 'Expiry Reminders', to: '/reminders', icon: Clock },
    { name: 'Secure Sharing', to: '/sharing', icon: Share2 },
    { name: 'Emergency Access', to: '/emergency', icon: HeartHandshake },
    { name: 'Audit Trail', to: '/audit', icon: ShieldCheck },
    { name: 'Trash Bin', to: '/documents?trash=true', icon: Trash2 },
    { name: 'Settings', to: '/settings', icon: Settings },
  ];

  return (
    <aside className="hidden w-64 flex-shrink-0 flex-col justify-between border-r border-slate-200 bg-white p-4 md:flex">
      <div className="space-y-6">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center space-x-3 rounded-lg px-3 py-2.5 text-xs font-semibold transition ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="space-y-4">
        {/* Storage Quota Card */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-700">
            <span className="flex items-center space-x-1.5">
              <HardDrive className="h-3.5 w-3.5 text-blue-600" />
              <span>Vault Storage</span>
            </span>
            <span className="font-semibold text-slate-900">{percentUsed}%</span>
          </div>

          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                percentUsed > 85 ? 'bg-rose-500' : percentUsed > 65 ? 'bg-amber-500' : 'bg-blue-600'
              }`}
              style={{ width: `${percentUsed}%` }}
            />
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
            <span>{usedMB} MB used</span>
            <span>{limitMB} MB quota</span>
          </div>
        </div>

        {/* Cryptographic Protection Badge */}
        <div className="flex items-center space-x-2 rounded-lg border border-emerald-200 bg-emerald-50/60 p-2 text-[11px] text-emerald-800">
          <Lock className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
          <span>AES-256-GCM AEAD Storage Active</span>
        </div>
      </div>
    </aside>
  );
};
