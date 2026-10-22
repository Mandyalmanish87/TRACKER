import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Shield,
  ShieldCheck,
  GraduationCap,
  Calendar,
  UserX,
  Mail,
} from 'lucide-react';
import { useClassSpace } from '../../context/ClassSpaceContext';
import { ClassSpaceMember, ClassSpaceRole } from '../../types/classSpace';
import { getAvatarInitials, getAvatarBgColor } from '../../utils/classSpaceUtils';
import { ConfirmModal } from '../common/ConfirmModal';

export const ClassMembersTab: React.FC = () => {
  const {
    activeWorkspace,
    members,
    currentMember,
    isCR,
  } = useClassSpace();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'cr' | 'co_admin' | 'member'>('all');
  const [memberToRemove, setMemberToRemove] = useState<ClassSpaceMember | null>(null);

  // Filter members based on query and role filter
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const name = m.displayName || 'Member';
      const email = m.email || '';
      const matchesSearch =
        name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === 'all' || m.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [members, searchQuery, roleFilter]);

  // Role counts
  const counts = useMemo(() => {
    return {
      total: members.length,
      crs: members.filter((m) => m.role === 'cr').length,
      coAdmins: members.filter((m) => m.role === 'co_admin').length,
      students: members.filter((m) => m.role === 'member').length,
    };
  }, [members]);

  const getRoleBadge = (role: ClassSpaceRole) => {
    switch (role) {
      case 'cr':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            <Shield className="w-3.5 h-3.5" />
            Class Representative
          </span>
        );
      case 'co_admin':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
            <ShieldCheck className="w-3.5 h-3.5" />
            Co-Admin
          </span>
        );
      case 'member':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-secondary text-muted-foreground border border-border">
            <GraduationCap className="w-3.5 h-3.5" />
            Student
          </span>
        );
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Joined recently';
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return 'Joined recently';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Summary & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Enrolled</div>
            <div className="text-2xl font-bold text-foreground mt-1">{counts.total}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Class Reps</div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{counts.crs}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Co-Admins</div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{counts.coAdmins}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Students</div>
            <div className="text-2xl font-bold text-foreground mt-1">{counts.students}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-secondary text-muted-foreground flex items-center justify-center">
            <GraduationCap className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="p-4 rounded-xl border border-border bg-card shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by student name or email..."
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg bg-background border border-input focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all text-foreground placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setRoleFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              roleFilter === 'all'
                ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            }`}
          >
            All Members ({counts.total})
          </button>
          <button
            onClick={() => setRoleFilter('cr')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              roleFilter === 'cr'
                ? 'bg-amber-600 text-white font-semibold shadow-sm'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            }`}
          >
            CRs ({counts.crs})
          </button>
          <button
            onClick={() => setRoleFilter('co_admin')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              roleFilter === 'co_admin'
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            }`}
          >
            Co-Admins ({counts.coAdmins})
          </button>
          <button
            onClick={() => setRoleFilter('member')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              roleFilter === 'member'
                ? 'bg-secondary text-foreground font-semibold'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            }`}
          >
            Students ({counts.students})
          </button>
        </div>
      </div>

      {/* Members List */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-secondary/20 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Enrolled Classmates ({filteredMembers.length})
          </h3>
          <span className="text-xs text-muted-foreground">
            {activeWorkspace?.name} &bull; Section {activeWorkspace?.section || 'Default'}
          </span>
        </div>

        {filteredMembers.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <h4 className="text-base font-semibold text-foreground">No members found</h4>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              No students or class leaders match your search criteria. Try a different keyword or filter.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredMembers.map((member) => {
              const isCurrentUser = member.id === currentMember?.id;
              const name = member.displayName || 'Member';
              const email = member.email || 'classmate@edu.com';
              const initials = getAvatarInitials(name);
              const fallbackBg = getAvatarBgColor(name);

              return (
                <div
                  key={member.id}
                  className="px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-secondary/20 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      {member.avatarUrl ? (
                        <img
                          src={member.avatarUrl}
                          alt={name}
                          className="w-10 h-10 rounded-full object-cover border border-border"
                        />
                      ) : (
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-xs shadow-inner"
                          style={{ backgroundColor: fallbackBg }}
                        >
                          {initials}
                        </div>
                      )}
                      {member.role === 'cr' && (
                        <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[9px] shadow-sm">
                          ★
                        </span>
                      )}
                    </div>

                    {/* Member Details */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground truncate">
                          {name}
                        </span>
                        {isCurrentUser && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-primary/10 text-primary border border-primary/20">
                            You
                          </span>
                        )}
                        {getRoleBadge(member.role)}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1 truncate">
                          <Mail className="w-3 h-3 text-muted-foreground/70" />
                          {email}
                        </span>
                        <span className="hidden md:flex items-center gap-1 text-muted-foreground/80">
                          <Calendar className="w-3 h-3" />
                          Joined {formatDate(member.joinedAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions / Info */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <span className="text-xs text-muted-foreground md:hidden">
                      Joined {formatDate(member.joinedAt)}
                    </span>
                    {isCR && !isCurrentUser && member.role !== 'cr' && (
                      <button
                        onClick={() => setMemberToRemove(member)}
                        className="px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 rounded-lg transition-colors flex items-center gap-1 border border-destructive/20"
                        title="Remove member from workspace"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Remove</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmation Modal for Removing Member */}
      <ConfirmModal
        isOpen={Boolean(memberToRemove)}
        title="Remove Member from ClassSpace?"
        message={`Are you sure you want to remove ${memberToRemove?.displayName || 'this student'} from ${activeWorkspace?.name}? They will lose access to shared class timetables and community discussions.`}
        confirmLabel="Remove Member"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => {
          setMemberToRemove(null);
        }}
        onCancel={() => setMemberToRemove(null)}
      />
    </div>
  );
};
