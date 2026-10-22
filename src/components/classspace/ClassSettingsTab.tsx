import React, { useState, useRef } from 'react';
import {
  KeyRound,
  RefreshCw,
  Copy,
  Check,
  Bell,
  Upload,
  User,
  Trash2,
  AlertTriangle,
  LogOut,
  Building,
} from 'lucide-react';
import { useClassSpace } from '../../context/ClassSpaceContext';
import { validateProfileAvatar, getAvatarInitials, getAvatarBgColor } from '../../utils/classSpaceUtils';
import { ConfirmModal } from '../common/ConfirmModal';

export const ClassSettingsTab: React.FC = () => {
  const {
    activeWorkspace,
    currentMember,
    isCR,
    profile,
    updateProfile,
    uploadAvatar,
    rotateJoinCode,
    leaveWorkspace,
  } = useClassSpace();

  // Notification toggles (persisted in local state or profile)
  const [notifyScheduleChanges, setNotifyScheduleChanges] = useState(true);
  const [notifyCancellations, setNotifyCancellations] = useState(true);
  const [notifyReplies, setNotifyReplies] = useState(true);
  const [notifyAnnouncements, setNotifyAnnouncements] = useState(true);

  // Profile fields
  const [displayName, setDisplayName] = useState(profile?.displayName || currentMember?.displayName || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Avatar upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile?.avatarUrl || null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Join code
  const [copiedCode, setCopiedCode] = useState(false);
  const [isRotatingCode, setIsRotatingCode] = useState(false);
  const [showRotateConfirm, setShowRotateConfirm] = useState(false);
  const [codeRotateSuccess, setCodeRotateSuccess] = useState<string | null>(null);

  // Leave workspace
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  // Handle Copy Join Code
  const handleCopyCode = async () => {
    if (!activeWorkspace?.joinCode) return;
    try {
      await navigator.clipboard.writeText(activeWorkspace.joinCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  // Handle Join Code Rotation
  const handleRotateCode = async () => {
    setIsRotatingCode(true);
    setShowRotateConfirm(false);
    try {
      const res = await rotateJoinCode();
      if (res.error) {
        setProfileMessage({ text: res.error, type: 'error' });
      } else if (res.newCode) {
        setCodeRotateSuccess(`New join code generated: ${res.newCode}`);
        setTimeout(() => setCodeRotateSuccess(null), 4000);
      }
    } finally {
      setIsRotatingCode(false);
    }
  };

  // Handle Avatar Selection
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setAvatarError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate avatar file format and size (<= 2MB)
    const validation = validateProfileAvatar(file);
    if (!validation.valid) {
      setAvatarError(validation.error || 'Invalid file');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const res = await uploadAvatar(file);
      if (res.error) {
        setAvatarError(res.error);
      } else if (res.avatarUrl) {
        setAvatarPreview(res.avatarUrl);
        setProfileMessage({ text: 'Profile picture updated successfully!', type: 'success' });
        setTimeout(() => setProfileMessage(null), 3000);
      }
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Handle Profile Update
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;

    setIsUpdatingProfile(true);
    setProfileMessage(null);
    try {
      const res = await updateProfile({ displayName: displayName.trim() });
      if (res.error) {
        setProfileMessage({ text: res.error, type: 'error' });
      } else {
        setProfileMessage({ text: 'Profile changes saved successfully.', type: 'success' });
        setTimeout(() => setProfileMessage(null), 3000);
      }
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // Handle Leave Workspace
  const handleConfirmLeave = async () => {
    setIsLeaving(true);
    setShowLeaveConfirm(false);
    try {
      await leaveWorkspace();
    } finally {
      setIsLeaving(false);
    }
  };

  const userInitial = getAvatarInitials(displayName || currentMember?.displayName || 'Student');
  const userBg = getAvatarBgColor(displayName || currentMember?.displayName || 'Student');

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Messages / Alerts */}
      {profileMessage && (
        <div
          className={`p-4 rounded-xl text-sm flex items-center justify-between border ${
            profileMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              : 'bg-destructive/10 border-destructive/30 text-destructive'
          }`}
        >
          <span>{profileMessage.text}</span>
          <button
            onClick={() => setProfileMessage(null)}
            className="text-xs underline ml-2 opacity-80 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {codeRotateSuccess && (
        <div className="p-4 rounded-xl text-sm bg-primary/10 border border-primary/30 text-primary flex items-center justify-between">
          <span className="font-semibold">{codeRotateSuccess}</span>
        </div>
      )}

      {/* 1. ClassSpace Identity & Join Code */}
      <div className="rounded-xl border border-border bg-card shadow-sm p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Building className="w-5 h-5 text-primary" />
              ClassSpace Details
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Authoritative workspace information and student enrollment code
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
            {activeWorkspace?.batch || 'Active Batch'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">ClassSpace Name</label>
              <div className="text-base font-semibold text-foreground mt-0.5">
                {activeWorkspace?.name || 'Unnamed Workspace'}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Section</label>
                <div className="text-sm font-medium text-foreground mt-0.5">
                  {activeWorkspace?.section || 'Default'}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Department</label>
                <div className="text-sm font-medium text-foreground mt-0.5">
                  {activeWorkspace?.department || 'General'}
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {activeWorkspace?.description || 'Collaborative class workspace for schedules and announcements.'}
              </p>
            </div>
          </div>

          {/* Join Code Box */}
          <div className="p-5 rounded-xl bg-secondary/30 border border-border flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-primary" />
                  Join Code
                </span>
                <span className="text-[10px] text-muted-foreground">5-character alphanumeric</span>
              </div>
              <div className="flex items-center gap-3 mt-3">
                <div className="px-4 py-2 rounded-lg bg-background border border-border font-mono text-2xl font-bold tracking-widest text-primary shadow-inner select-all">
                  {activeWorkspace?.joinCode || '-----'}
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-3 py-2 text-xs font-medium rounded-lg bg-secondary hover:bg-secondary/80 text-foreground border border-border transition-colors flex items-center gap-1.5"
                  title="Copy Join Code to clipboard"
                >
                  {copiedCode ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Share this code with your classmates so they can join this ClassSpace.
              </p>
            </div>

            {isCR && (
              <div className="pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowRotateConfirm(true)}
                  disabled={isRotatingCode}
                  className="text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRotatingCode ? 'animate-spin' : ''}`} />
                  <span>Rotate Join Code (if leaked)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Student Class Profile & Avatar */}
      <div className="rounded-xl border border-border bg-card shadow-sm p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Your Student Profile in this Class
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Customize how your name and avatar appear in class messages and attendance
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Role:</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-secondary text-foreground border border-border">
              {currentMember?.role === 'cr'
                ? 'Class Representative'
                : currentMember?.role === 'co_admin'
                ? 'Co-Admin'
                : 'Student'}
            </span>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Avatar Display & Upload */}
            <div className="relative group">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt={displayName}
                  className="w-20 h-20 rounded-full object-cover border-2 border-primary/20 shadow-md"
                />
              ) : (
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center font-bold text-white text-2xl shadow-md"
                  style={{ backgroundColor: userBg }}
                >
                  {userInitial}
                </div>
              )}

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleAvatarChange}
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAvatar}
                className="absolute inset-0 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-[10px] font-medium"
              >
                <Upload className="w-4 h-4 mb-0.5" />
                <span>{isUploadingAvatar ? 'Uploading...' : 'Change'}</span>
              </button>
            </div>

            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-secondary hover:bg-secondary/80 text-foreground border border-border transition-colors flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload New Picture</span>
                </button>
                {avatarPreview && (
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarPreview(null);
                      updateProfile({ avatarUrl: undefined });
                    }}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg text-destructive hover:bg-destructive/10 border border-destructive/20 transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Accepted formats: JPG, PNG, WEBP, GIF. Maximum allowed file size: 2MB.
              </p>
              {avatarError && (
                <p className="text-xs text-destructive font-medium">{avatarError}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-input focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all text-foreground"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Connected Email (Read Only)
              </label>
              <input
                type="text"
                value={currentMember?.email || 'student@domain.edu'}
                disabled
                className="w-full px-3 py-2 text-sm rounded-lg bg-secondary/40 border border-input text-muted-foreground cursor-not-allowed"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isUpdatingProfile || !displayName.trim()}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground shadow hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isUpdatingProfile ? 'Saving...' : 'Save Profile Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* 3. Class Notification Preferences */}
      <div className="rounded-xl border border-border bg-card shadow-sm p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              In-App Notification Alerts
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Control which class workspace events trigger in-app banner and badge notifications
            </p>
          </div>
        </div>

        <div className="divide-y divide-border">
          <div className="py-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-foreground">Schedule Reschedules & Room Swaps</div>
              <div className="text-xs text-muted-foreground">Receive instant alerts when the CR reschedules a lecture or changes a room</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={notifyScheduleChanges}
                onChange={(e) => setNotifyScheduleChanges(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          <div className="py-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-foreground">Class Cancellations & Extra Sessions</div>
              <div className="text-xs text-muted-foreground">Notify when a class is called off or an extra tutorial is added</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={notifyCancellations}
                onChange={(e) => setNotifyCancellations(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          <div className="py-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-foreground">Pinned Announcements</div>
              <div className="text-xs text-muted-foreground">Alert when class representatives pin an important notice to the workspace</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={notifyAnnouncements}
                onChange={(e) => setNotifyAnnouncements(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          <div className="py-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-foreground">Community Discussion Replies</div>
              <div className="text-xs text-muted-foreground">Alert when someone directly replies to one of your messages in community chat</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={notifyReplies}
                onChange={(e) => setNotifyReplies(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        </div>
      </div>

      {/* 4. Danger Zone */}
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 space-y-4">
        <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
          <AlertTriangle className="w-4 h-4" />
          <span>ClassSpace Membership & Exit</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Leaving this workspace will remove your access to the collaborative class timetable, announcements, and group discussions. Your personal attendance records remain saved on your device.
        </p>
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowLeaveConfirm(true)}
            disabled={isLeaving}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Leave {activeWorkspace?.name || 'ClassSpace'}</span>
          </button>
        </div>
      </div>

      {/* Confirm Rotate Join Code Modal */}
      <ConfirmModal
        isOpen={showRotateConfirm}
        title="Rotate ClassSpace Join Code?"
        message="Rotating the join code will immediately invalidate the current code. Existing members will stay enrolled, but new classmates must use the new 5-character code to join."
        confirmLabel="Rotate Join Code"
        cancelLabel="Cancel"
        variant="warning"
        onConfirm={handleRotateCode}
        onCancel={() => setShowRotateConfirm(false)}
      />

      {/* Confirm Leave Workspace Modal */}
      <ConfirmModal
        isOpen={showLeaveConfirm}
        title="Leave this ClassSpace?"
        message={`Are you sure you want to leave ${activeWorkspace?.name}? You will no longer receive live timetable updates or community notices.`}
        confirmLabel="Leave Workspace"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleConfirmLeave}
        onCancel={() => setShowLeaveConfirm(false)}
      />
    </div>
  );
};
