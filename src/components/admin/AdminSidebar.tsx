import React from 'react';
import {
  LayoutDashboard,
  Users,
  Building,
  CreditCard,
  TrendingUp,
  Key,
  Palette,
  Salad,
  ShieldAlert,
  Database,
  Sliders,
  Lock,
  User,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Shield,
  X,
} from 'lucide-react';
import { AdminNavTab, PlatformAdminRole } from '../../types/admin';

interface AdminSidebarProps {
  currentTab: AdminNavTab;
  onSelectTab: (tab: AdminNavTab) => void;
  adminRole: PlatformAdminRole;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onExit: () => void;
}

interface NavSection {
  title: string;
  items: {
    id: AdminNavTab | 'exit';
    label: string;
    icon: React.ReactNode;
    badge?: string;
  }[];
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  currentTab,
  onSelectTab,
  adminRole,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
  onExit,
}) => {
  const sections: NavSection[] = [
    {
      title: 'OVERVIEW',
      items: [
        {
          id: 'overview',
          label: 'System Overview',
          icon: <LayoutDashboard className="w-4 h-4 shrink-0" />,
        },
      ],
    },
    {
      title: 'COMMERCE & CUSTOMERS',
      items: [
        {
          id: 'payments',
          label: 'Payments & Pricing',
          icon: <CreditCard className="w-4 h-4 shrink-0" />,
        },
        {
          id: 'analytics',
          label: 'Revenue & Growth',
          icon: <TrendingUp className="w-4 h-4 shrink-0" />,
        },
        {
          id: 'licenses',
          label: 'License Keys & Store',
          icon: <Key className="w-4 h-4 shrink-0" />,
        },
        {
          id: 'users',
          label: 'User Directory',
          icon: <Users className="w-4 h-4 shrink-0" />,
        },
      ],
    },
    {
      title: 'CLASSES & CONTENT STUDIO',
      items: [
        {
          id: 'workspaces',
          label: 'Workspaces',
          icon: <Building className="w-4 h-4 shrink-0" />,
        },
        {
          id: 'website_editor',
          label: 'Website Live Studio',
          icon: <Palette className="w-4 h-4 shrink-0" />,
        },
        {
          id: 'nutrition_recalibrator',
          label: 'Food Recalibrator',
          icon: <Salad className="w-4 h-4 shrink-0" />,
        },
      ],
    },
    {
      title: 'SYSTEM & GOVERNANCE',
      items: [
        {
          id: 'audit',
          label: 'Audit Trail',
          icon: <ShieldAlert className="w-4 h-4 shrink-0" />,
        },
        {
          id: 'data_management',
          label: 'Data Management',
          icon: <Database className="w-4 h-4 shrink-0" />,
        },
        {
          id: 'configuration',
          label: 'App Configuration',
          icon: <Sliders className="w-4 h-4 shrink-0" />,
        },
        {
          id: 'security',
          label: 'Security & Access',
          icon: <Lock className="w-4 h-4 shrink-0" />,
        },
      ],
    },
    {
      title: 'ACCOUNT',
      items: [
        {
          id: 'profile',
          label: 'Admin Profile',
          icon: <User className="w-4 h-4 shrink-0" />,
        },
        {
          id: 'exit',
          label: 'Return to TRAKIFY',
          icon: <LogOut className="w-4 h-4 shrink-0 text-amber-500" />,
        },
      ],
    },
  ];

  const getRoleBadge = (role: PlatformAdminRole) => {
    switch (role) {
      case 'owner':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'super_admin':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      case 'support':
      default:
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    }
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#070B14] text-ivory-100 border-r border-white/10 select-none">
      {/* Brand Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-serif text-sm font-bold tracking-tight text-white truncate">
                  TRAKIFY
                </span>
                <span
                  className={`inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase tracking-wider border ${getRoleBadge(
                    adminRole
                  )}`}
                >
                  {adminRole.replace('_', ' ')}
                </span>
              </div>
              <p className="text-[10px] font-mono text-ivory-400 truncate">
                Admin Control Center
              </p>
            </div>
          )}
        </div>

        {/* Mobile Close Button */}
        <button
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 rounded-lg text-ivory-400 hover:text-white hover:bg-white/5"
          aria-label="Close admin navigation"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Desktop Collapse Toggle */}
        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex p-1.5 rounded-lg text-ivory-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto no-scrollbar py-3 px-2 space-y-5">
        {sections.map((section) => (
          <div key={section.title} className="space-y-1">
            {!isCollapsed && (
              <div className="px-3 pb-1 text-[9.5px] font-mono uppercase tracking-widest text-ivory-400/80 font-bold">
                {section.title}
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = item.id !== 'exit' && currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (item.id === 'exit') {
                        onExit();
                      } else {
                        onSelectTab(item.id);
                        onCloseMobile();
                      }
                    }}
                    title={isCollapsed ? item.label : undefined}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer group relative ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-semibold'
                        : 'text-ivory-300 hover:text-white hover:bg-white/5'
                    } ${isCollapsed ? 'justify-center px-2' : ''}`}
                  >
                    <span className={`${isActive ? 'text-white' : 'text-ivory-400 group-hover:text-blue-400'} transition-colors`}>
                      {item.icon}
                    </span>

                    {!isCollapsed && (
                      <span className="truncate flex-1 text-left">{item.label}</span>
                    )}

                    {!isCollapsed && item.badge && (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-white/10 text-ivory-300">
                        {item.badge}
                      </span>
                    )}

                    {/* Active Pip Indicator */}
                    {isActive && (
                      <span
                        className="absolute left-0 w-1 h-5 rounded-r bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Operator Info */}
      <div className="p-3 border-t border-white/10 shrink-0">
        <div
          className={`flex items-center gap-2.5 p-2 rounded-xl bg-white/[0.03] border border-white/5 ${
            isCollapsed ? 'justify-center' : ''
          }`}
        >
          <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0 text-xs font-bold">
            {adminRole.charAt(0).toUpperCase()}
          </div>
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">Platform Operator</p>
              <p className="text-[10px] font-mono text-ivory-400 truncate capitalize">Tier: {adminRole.replace('_', ' ')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 transition-all duration-200 sticky top-0 h-screen ${
          isCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop & Drawer */}
      {isMobileOpen && (
        <>
          <div
            onClick={onCloseMobile}
            className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity"
            aria-hidden="true"
          />
          <aside
            className="lg:hidden fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] transform transition-transform duration-200 ease-out shadow-2xl translate-x-0"
          >
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
};

