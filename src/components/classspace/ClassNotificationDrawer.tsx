import React from 'react';
import {
  Bell,
  X,
  CheckCheck,
  Calendar,
  AlertCircle,
  MessageSquare,
  Pin,
} from 'lucide-react';
import { useClassSpace } from '../../context/ClassSpaceContext';
import { ClassNotification } from '../../types/classSpace';

interface ClassNotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToTab?: (tab: string) => void;
}

export const ClassNotificationDrawer: React.FC<ClassNotificationDrawerProps> = ({
  isOpen,
  onClose,
  onNavigateToTab,
}) => {
  const {
    notifications,
    unreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
  } = useClassSpace();

  if (!isOpen) return null;

  const getNotificationIcon = (type: ClassNotification['type']) => {
    switch (type) {
      case 'schedule_change':
      case 'extra_class':
        return <Calendar className="w-4 h-4 text-primary" />;
      case 'cancelled_class':
        return <AlertCircle className="w-4 h-4 text-rose-500" />;
      case 'announcement':
        return <Pin className="w-4 h-4 text-amber-500" />;
      case 'community_reply':
        return <MessageSquare className="w-4 h-4 text-blue-500" />;
      case 'membership':
      default:
        return <AlertCircle className="w-4 h-4 text-primary" />;
    }
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return 'Recently';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-md bg-card border-l border-border h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-secondary/30">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Bell className="w-5 h-5 text-primary" />
              {unreadNotificationCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Class Notifications</h3>
              <p className="text-[11px] text-muted-foreground">
                {unreadNotificationCount > 0
                  ? `${unreadNotificationCount} unread update${unreadNotificationCount > 1 ? 's' : ''}`
                  : 'All caught up'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unreadNotificationCount > 0 && (
              <button
                onClick={() => markAllNotificationsRead()}
                className="px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors flex items-center gap-1"
                title="Mark all notifications as read"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Mark all read</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {notifications.length === 0 ? (
            <div className="p-12 text-center">
              <Bell className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
              <h4 className="text-sm font-semibold text-foreground">No notifications yet</h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                When your CR reschedules a class, makes an announcement, or someone replies to you, you'll see alerts here.
              </p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => {
                  if (!notif.isRead) markNotificationRead(notif.id);
                  if (notif.type === 'schedule_change' || notif.type === 'extra_class' || notif.type === 'cancelled_class') {
                    onNavigateToTab?.('timetable');
                  } else if (notif.type === 'announcement' || notif.type === 'community_reply') {
                    onNavigateToTab?.('community');
                  }
                }}
                className={`p-4 flex items-start gap-3.5 cursor-pointer transition-colors ${
                  !notif.isRead
                    ? 'bg-primary/5 hover:bg-primary/10 font-medium'
                    : 'hover:bg-secondary/30'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0 mt-0.5 border border-border shadow-xs">
                  {getNotificationIcon(notif.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground truncate">
                      {notif.title}
                    </span>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {formatTimestamp(notif.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
                    {notif.body}
                  </p>
                </div>

                {!notif.isRead && (
                  <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" />
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border bg-secondary/20 text-center">
          <span className="text-[11px] text-muted-foreground">
            Notifications are synchronized live with your ClassSpace.
          </span>
        </div>
      </div>
    </div>
  );
};
