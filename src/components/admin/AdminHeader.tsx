import React from 'react';
import {
  Menu,
  Search,
  LogOut,
  Shield,
  CheckCircle2,
} from 'lucide-react';
import { AdminNavTab, AdminTimeframe, PlatformAdminRole } from '../../types/admin';

interface AdminHeaderProps {
  currentTab: AdminNavTab;
  adminRole: PlatformAdminRole;
  userId?: string;
  timeframe: AdminTimeframe;
  onSelectTimeframe: (tf: AdminTimeframe) => void;
  onOpenMobileMenu: () => void;
  onExit: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

const TAB_TITLES: Record<AdminNavTab, { title: string; category: string }> = {
  overview: { title: 'System Overview', category: 'Overview' },
  payments: { title: 'Payments & Subscriptions', category: 'Commerce' },
  analytics: { title: 'Revenue & Growth Analytics', category: 'Commerce' },
  licenses: { title: 'License Keys & Product Store', category: 'Commerce' },
  users: { title: 'User Directory', category: 'Customers' },
  workspaces: { title: 'Class & Cohort Control', category: 'Classes' },
  website_editor: { title: 'Website Live Studio', category: 'Studio' },
  nutrition_recalibrator: { title: 'Food Recalibrator', category: 'Catalog' },
  audit: { title: 'Audit Trail & Activity Logs', category: 'Governance' },
  data_management: { title: 'Data Management', category: 'System' },
  configuration: { title: 'App Configuration', category: 'System' },
  security: { title: 'Security & Permissions', category: 'Governance' },
  profile: { title: 'Admin Profile', category: 'Account' },
  admin_settings: { title: 'Admin Settings', category: 'Account' },
  // Deprecated/Legacy aliases
  academics: { title: 'Academic Data', category: 'Legacy' },
  timetable: { title: 'Timetable Inspector', category: 'Legacy' },
  attendance: { title: 'Attendance Health', category: 'Legacy' },
  syllabus: { title: 'Syllabus Mastery', category: 'Legacy' },
  events_tasks: { title: 'Events & Tasks', category: 'Legacy' },
  fitness: { title: 'Gym & Fitness', category: 'Legacy' },
  nutrition: { title: 'Nutrition & Metabolic Lab', category: 'Legacy' },
};

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  currentTab,
  adminRole,
  userId: _userId,
  timeframe,
  onSelectTimeframe,
  onOpenMobileMenu,
  onExit,
  searchQuery,
  onSearchChange,
}) => {
  const currentMeta = TAB_TITLES[currentTab] || { title: 'Administration', category: 'Portal' };

  return (
    <header className="sticky top-0 z-20 backdrop-blur-xl bg-[#070B14]/85 border-b border-white/10 px-4 sm:px-6 py-3 transition-colors">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Mobile trigger & Breadcrumbs */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenMobileMenu}
            className="lg:hidden p-2 rounded-xl text-ivory-300 hover:text-white bg-white/5 border border-white/10"
            aria-label="Open navigation drawer"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div>
            <nav className="flex items-center gap-1.5 text-[11px] font-mono text-ivory-400">
              <span className="text-blue-400 font-semibold">Admin Console</span>
              <span>/</span>
              <span className="text-white font-semibold truncate">{currentMeta.category}</span>
            </nav>
            <h1 className="text-base sm:text-lg font-serif font-bold text-white tracking-tight leading-tight">
              Control Center
            </h1>
          </div>
        </div>

        {/* Center: Search */}
        <div className="hidden md:flex items-center flex-1 max-w-sm mx-4">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ivory-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Quick filter records..."
              className="w-full pl-9 pr-3.5 py-1.5 text-xs rounded-xl bg-white/5 border border-white/10 text-white placeholder-ivory-400/60 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>
        </div>

        {/* Right: Timeframe, Status & Exit */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Timeframe Filter */}
          <div className="hidden sm:flex items-center p-1 rounded-xl bg-white/5 border border-white/10 text-[11px] font-mono">
            {(['today', '7d', '30d', 'all'] as AdminTimeframe[]).map((tf) => (
              <button
                key={tf}
                onClick={() => onSelectTimeframe(tf)}
                className={`px-2.5 py-1 rounded-lg uppercase tracking-wider font-semibold transition-all cursor-pointer ${
                  timeframe === tf
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-ivory-400 hover:text-white'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* System status pill */}
          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] font-mono">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-semibold">Operational</span>
          </div>

          {/* Role badge */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-xs font-mono">
            <Shield className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-bold text-white uppercase text-[10px] tracking-wider">
              Tier: {adminRole.replace('_', ' ')}
            </span>
          </div>

          {/* Exit to TRAKIFY */}
          <button
            onClick={onExit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-ivory-200 border border-white/10 text-xs font-medium transition cursor-pointer"
            title="Exit Admin Control Center"
          >
            <LogOut className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Exit</span>
          </button>
        </div>
      </div>
    </header>
  );
};
