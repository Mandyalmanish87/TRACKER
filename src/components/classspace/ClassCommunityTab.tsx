import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Send,
  Reply,
  Bookmark,
  BookmarkCheck,
  Pin,
  Edit2,
  Trash2,
  Search,
  X,
  CornerDownRight,
  BarChart2,
  Link2,
  Megaphone,
  Check,
  Copy,
  ExternalLink,
  Lock,
  Users,
  FileText,
  BookOpen,
  Video,
  Hash,
  Zap,
  Plus,
} from 'lucide-react';
import { useClassSpace } from '../../context/ClassSpaceContext';
import { getAvatarInitials, getAvatarColor } from '../../utils/classSpaceUtils';
import { ClassMessage } from '../../types/classSpace';
import { CreatePollModal } from './CreatePollModal';
import { ShareResourceModal } from './ShareResourceModal';

const EMOJI_PALETTE = ['👍', '❤️', '🔥', '🙌', '💡', '👏'];

type CommunityFilter = 'all' | 'polls' | 'notices' | 'resources' | 'starred';

export const ClassCommunityTab: React.FC = () => {
  const {
    activeWorkspace,
    messages,
    savedMessages,
    pinnedMessages,
    channels,
    activeChannel,
    activeChannelId,
    setActiveChannelId,
    createChannel,
    sendMessage,
    createPoll,
    votePoll,
    closePoll,
    shareResource,
    addReaction,
    removeReaction,
    editMessage,
    deleteMessage,
    togglePinMessage,
    toggleSaveMessage,
    canModerateChat,
    canPublishNotices,
    isCR,
    currentMember,
  } = useClassSpace();

  const [inputContent, setInputContent] = useState('');
  const [replyingTo, setReplyingTo] = useState<ClassMessage | null>(null);
  const [editingMsg, setEditingMsg] = useState<ClassMessage | null>(null);
  const [editContent, setEditContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<CommunityFilter>('all');
  const [isAnnouncementMode, setIsAnnouncementMode] = useState(false);

  // New Channel Modal State
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');
  const [channelError, setChannelError] = useState<string | null>(null);

  // Modals state
  const [showCreatePollModal, setShowCreatePollModal] = useState(false);
  const [showShareResourceModal, setShowShareResourceModal] = useState(false);
  const [copiedPollId, setCopiedPollId] = useState<string | null>(null);
  const [copiedResourceId, setCopiedResourceId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom on new messages (safeguarded against JSDOM)
  useEffect(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputContent.trim()) return;

    await sendMessage(inputContent.trim(), {
      replyTo: replyingTo
        ? {
            id: replyingTo.id,
            content: replyingTo.content,
            senderName: replyingTo.senderName,
          }
        : undefined,
      isAnnouncement: isAnnouncementMode,
      isPinned: isAnnouncementMode,
      channelId: activeChannel?.id,
    });

    setInputContent('');
    setReplyingTo(null);
    setIsAnnouncementMode(false);
  };

  const handleSaveEdit = async () => {
    if (!editingMsg || !editContent.trim()) return;
    await editMessage(editingMsg.id, editContent.trim());
    setEditingMsg(null);
  };

  const handleCreateChannelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    setChannelError(null);
    const res = await createChannel(newChannelName.trim(), newChannelDesc.trim() || undefined);
    if (res.error) {
      setChannelError(res.error);
    } else {
      setNewChannelName('');
      setNewChannelDesc('');
      setShowCreateChannelModal(false);
    }
  };

  const savedMsgIdSet = new Set(savedMessages.map((s) => s.messageId));

  // Filter messages by active channel
  const channelMessages = useMemo(() => {
    if (!activeChannel) return messages;
    return messages.filter(
      (m) =>
        m.channelId === activeChannel.id ||
        (!m.channelId && activeChannel.slug === 'the-commons')
    );
  }, [messages, activeChannel]);

  // Category counts
  const pollCount = channelMessages.filter((m) => m.poll || m.messageType === 'poll').length;
  const noticeCount = channelMessages.filter((m) => m.isPinned || m.messageType === 'announcement').length;
  const resourceCount = channelMessages.filter((m) => m.resource || m.messageType === 'resource').length;

  const filteredMessages = channelMessages.filter((m) => {
    if (activeFilter === 'starred' && !savedMsgIdSet.has(m.id)) return false;
    if (activeFilter === 'polls' && !m.poll && m.messageType !== 'poll') return false;
    if (activeFilter === 'notices' && !m.isPinned && m.messageType !== 'announcement') return false;
    if (activeFilter === 'resources' && !m.resource && m.messageType !== 'resource') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const inContent = m.content.toLowerCase().includes(q);
      const inSender = m.senderName.toLowerCase().includes(q);
      const inPoll =
        m.poll?.question.toLowerCase().includes(q) ||
        m.poll?.options.some((o) => o.text.toLowerCase().includes(q));
      const inResource =
        m.resource?.title.toLowerCase().includes(q) ||
        m.resource?.description?.toLowerCase().includes(q);
      return inContent || inSender || Boolean(inPoll) || Boolean(inResource);
    }
    return true;
  });

  return (
    <div className="flex flex-col h-[750px] space-y-3">
      {/* ── Channel Navigation Bar ── */}
      <div className="p-2.5 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle flex items-center justify-between gap-2 overflow-x-auto shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          {channels.map((chan) => {
            const isChanActive = (activeChannel?.id === chan.id) || (chan.slug === 'the-commons' && !activeChannelId);
            return (
              <button
                key={chan.id}
                onClick={() => setActiveChannelId(chan.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  isChanActive
                    ? 'bg-terracotta-600 text-white shadow-2xs'
                    : 'text-espresso-700 dark:text-ivory-200 hover:bg-ivory-100 dark:hover:bg-espresso-800'
                }`}
              >
                {chan.slug === 'class-pulse' ? (
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                ) : chan.slug === 'study-vault' ? (
                  <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                ) : (
                  <Hash className="w-3.5 h-3.5 text-terracotta-400" />
                )}
                <span>{chan.name}</span>
              </button>
            );
          })}
        </div>

        {isCR && (
          <button
            onClick={() => setShowCreateChannelModal(true)}
            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-terracotta-600 hover:bg-terracotta-50 dark:hover:bg-terracotta-950/40 border border-terracotta-300 dark:border-terracotta-800 transition cursor-pointer flex items-center gap-1 shrink-0"
            title="Create a new class channel"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Channel</span>
          </button>
        )}
      </div>

      {/* Active Channel Topic & Description */}
      {activeChannel && (
        <div className="px-4 py-2 rounded-xl bg-ivory-100/70 dark:bg-espresso-800/50 border border-ivory-300/80 dark:border-espresso-750 flex items-center justify-between text-xs text-espresso-600 dark:text-espresso-300 shrink-0">
          <div className="flex items-center gap-2 truncate">
            <span className="font-bold text-espresso-900 dark:text-ivory-100 flex items-center gap-1">
              <Hash className="w-3.5 h-3.5 text-terracotta-500" />
              {activeChannel.name}
            </span>
            <span>&bull;</span>
            <span className="truncate text-espresso-500 dark:text-espresso-400">{activeChannel.description || 'Channel discussion'}</span>
          </div>
        </div>
      )}

      {/* Top Bar: Search, Category Filters, Pinned announcements indicator */}
      <div className="p-3.5 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle space-y-3 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-espresso-400" />
            <input
              type="text"
              placeholder="Search polls, resources, and notices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-950 dark:text-ivory-50 placeholder-espresso-400 focus:outline-none focus:ring-2 focus:ring-terracotta-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-espresso-400 hover:text-espresso-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer ${
                activeFilter === 'all'
                  ? 'bg-terracotta-600 text-white shadow-2xs'
                  : 'border border-ivory-300 dark:border-espresso-700 text-espresso-700 dark:text-ivory-200 hover:bg-ivory-100 dark:hover:bg-espresso-800'
              }`}
            >
              All
            </button>

            <button
              onClick={() => setActiveFilter('polls')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeFilter === 'polls'
                  ? 'bg-terracotta-600 text-white shadow-2xs'
                  : 'border border-ivory-300 dark:border-espresso-700 text-espresso-700 dark:text-ivory-200 hover:bg-ivory-100 dark:hover:bg-espresso-800'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Polls</span>
              {pollCount > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    activeFilter === 'polls'
                      ? 'bg-white/30 text-white'
                      : 'bg-ivory-200 dark:bg-espresso-750 text-espresso-800 dark:text-ivory-100'
                  }`}
                >
                  {pollCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveFilter('notices')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeFilter === 'notices'
                  ? 'bg-terracotta-600 text-white shadow-2xs'
                  : 'border border-ivory-300 dark:border-espresso-700 text-espresso-700 dark:text-ivory-200 hover:bg-ivory-100 dark:hover:bg-espresso-800'
              }`}
            >
              <Pin className="w-3.5 h-3.5" />
              <span>Notices</span>
              {noticeCount > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    activeFilter === 'notices'
                      ? 'bg-white/30 text-white'
                      : 'bg-ivory-200 dark:bg-espresso-750 text-espresso-800 dark:text-ivory-100'
                  }`}
                >
                  {noticeCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveFilter('resources')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeFilter === 'resources'
                  ? 'bg-terracotta-600 text-white shadow-2xs'
                  : 'border border-ivory-300 dark:border-espresso-700 text-espresso-700 dark:text-ivory-200 hover:bg-ivory-100 dark:hover:bg-espresso-800'
              }`}
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>Resources</span>
              {resourceCount > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    activeFilter === 'resources'
                      ? 'bg-white/30 text-white'
                      : 'bg-ivory-200 dark:bg-espresso-750 text-espresso-800 dark:text-ivory-100'
                  }`}
                >
                  {resourceCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveFilter(activeFilter === 'starred' ? 'all' : 'starred')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeFilter === 'starred'
                  ? 'bg-amber-500 text-white shadow-2xs'
                  : 'border border-ivory-300 dark:border-espresso-700 text-espresso-700 dark:text-ivory-200 hover:bg-ivory-100 dark:hover:bg-espresso-800'
              }`}
            >
              {activeFilter === 'starred' ? (
                <BookmarkCheck className="w-3.5 h-3.5 text-white" />
              ) : (
                <Bookmark className="w-3.5 h-3.5 text-amber-500" />
              )}
              <span>Starred</span>
              {savedMessages.length > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    activeFilter === 'starred'
                      ? 'bg-white/30 text-white'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  }`}
                >
                  {savedMessages.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Pinned Announcements Drawer if any */}
      {pinnedMessages.length > 0 && activeFilter === 'all' && !searchQuery && (
        <div className="p-3.5 rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 shrink-0 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
            <Pin className="w-3.5 h-3.5" />
            <span>Pinned Class Announcements ({pinnedMessages.length})</span>
          </div>
          <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
            {pinnedMessages.map((msg) => (
              <div
                key={msg.id}
                className="p-2 rounded-xl bg-white dark:bg-espresso-850 border border-amber-200 dark:border-amber-900/40 text-xs flex items-center justify-between gap-3 shadow-2xs"
              >
                <div className="min-w-0">
                  <span className="font-semibold text-espresso-950 dark:text-ivory-50 mr-1.5">
                    {msg.senderName}:
                  </span>
                  <span className="text-espresso-700 dark:text-espresso-300 truncate">
                    {msg.content}
                  </span>
                </div>
                {canModerateChat && (
                  <button
                    onClick={() => togglePinMessage(msg.id)}
                    className="p-1 text-espresso-400 hover:text-rose-600 shrink-0"
                    title="Unpin announcement"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Message History Stream */}
      <div className="flex-1 overflow-y-auto p-4 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle space-y-4">
        {filteredMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-2">
            <Bookmark className="w-8 h-8 text-espresso-300 dark:text-espresso-600 mb-1" />
            <p className="text-sm font-semibold text-espresso-700 dark:text-ivory-200">
              {activeFilter === 'starred'
                ? 'No starred messages found.'
                : activeFilter === 'polls'
                ? 'No polls posted yet. Launch the first poll below!'
                : activeFilter === 'resources'
                ? 'No study materials or links shared yet.'
                : activeFilter === 'notices'
                ? 'No official announcements posted yet.'
                : searchQuery
                ? 'No matching results found.'
                : 'No messages yet.'}
            </p>
            <p className="text-xs text-espresso-400 dark:text-espresso-500 max-w-sm">
              Use the tools below to launch a class poll with multi-choice options, share lecture slides, or discuss questions with classmates.
            </p>
          </div>
        ) : (
          filteredMessages.map((msg) => {
            const isMe = msg.senderId === currentMember?.userId;
            const isSaved = savedMsgIdSet.has(msg.id);
            const avatarBg = getAvatarColor(msg.senderName);
            const initials = getAvatarInitials(msg.senderName);

            return (
              <div
                key={msg.id}
                className={`group relative flex items-start gap-3 p-3 rounded-2xl transition hover:bg-ivory-50 dark:hover:bg-espresso-800/60 ${
                  msg.isPinned
                    ? 'border-l-4 border-amber-500 bg-amber-50/30 dark:bg-amber-950/10'
                    : ''
                }`}
              >
                {/* Avatar */}
                <div className="shrink-0 mt-0.5">
                  {msg.senderAvatarUrl ? (
                    <img
                      src={msg.senderAvatarUrl}
                      alt={msg.senderName}
                      className="w-8 h-8 rounded-full object-cover border border-ivory-300 dark:border-espresso-700"
                    />
                  ) : (
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-[10px] shadow-2xs"
                      style={{ backgroundColor: avatarBg }}
                    >
                      {initials}
                    </div>
                  )}
                </div>

                {/* Message Body */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-espresso-950 dark:text-ivory-50">
                      {msg.senderName}
                    </span>
                    {msg.senderRole === 'owner' && (
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-semibold bg-terracotta-100 dark:bg-terracotta-950/60 text-terracotta-800 dark:text-terracotta-300 border border-terracotta-300 dark:border-terracotta-800">
                        Owner
                      </span>
                    )}
                    {msg.senderRole === 'cr' && (
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                        CR
                      </span>
                    )}
                    {msg.senderRole === 'co_admin' && (
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-semibold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                        Co-Admin
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-espresso-400 dark:text-espresso-500">
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {msg.isEdited && (
                      <span className="text-[9px] italic text-espresso-400">(edited)</span>
                    )}
                  </div>

                  {/* Official Notice Indicator Header */}
                  {(msg.isPinned || msg.messageType === 'announcement') && (
                    <div className="my-2 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-between text-xs text-amber-700 dark:text-amber-300 font-semibold shadow-2xs">
                      <div className="flex items-center gap-1.5">
                        <Pin className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                        <span>📢 OFFICIAL CLASS NOTICE</span>
                      </div>
                      {canPublishNotices && (
                        <button
                          onClick={() => togglePinMessage(msg.id)}
                          className="hover:underline text-[10px] text-amber-600 dark:text-amber-400 cursor-pointer font-medium"
                        >
                          {msg.isPinned ? 'Unpin' : 'Pin'}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Quoted Reply if any */}
                  {msg.replyToContent && (
                    <div className="mt-1 p-1.5 pl-2 rounded-lg bg-ivory-100 dark:bg-espresso-800 border-l-2 border-terracotta-500 text-[11px] text-espresso-600 dark:text-espresso-300">
                      <span className="font-semibold text-espresso-800 dark:text-ivory-100 mr-1">
                        @{msg.replyToSenderName}:
                      </span>
                      <span className="truncate inline-block max-w-[400px] align-bottom">
                        {msg.replyToContent}
                      </span>
                    </div>
                  )}

                  {/* Standard Message Text Content */}
                  <div className="mt-1 text-xs text-espresso-800 dark:text-ivory-200 leading-relaxed break-words">
                    {msg.isDeleted ? (
                      <span className="italic text-espresso-400">This message was removed.</span>
                    ) : (
                      msg.content
                    )}
                  </div>

                  {/* ── Interactive Poll Card ── */}
                  {msg.poll && !msg.isDeleted && (
                    <div className="mt-3 p-4 rounded-2xl border border-terracotta-200 dark:border-terracotta-900/60 bg-gradient-to-br from-terracotta-50/50 via-white to-ivory-50/60 dark:from-terracotta-950/30 dark:via-espresso-850 dark:to-espresso-900 shadow-xs space-y-3">
                      {/* Poll Title & Meta */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-terracotta-100 dark:bg-terracotta-950 text-terracotta-700 dark:text-terracotta-300 border border-terracotta-200 dark:border-terracotta-800 flex items-center gap-1">
                            <BarChart2 className="w-3 h-3" />
                            <span>Class Poll</span>
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-ivory-100 dark:bg-espresso-800 text-espresso-600 dark:text-ivory-300">
                            {msg.poll.allowMultipleAnswers ? 'Multi-Option (Choose Any)' : 'Single Choice'}
                          </span>
                        </div>

                        {msg.poll.isClosed ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-espresso-200 dark:bg-espresso-750 text-espresso-600 dark:text-espresso-400">
                            Closed
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Active Voting</span>
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-bold text-espresso-950 dark:text-ivory-50">
                        {msg.poll.question}
                      </h4>

                      {/* Options List */}
                      <div className="space-y-2 pt-1">
                        {msg.poll.options.map((option) => {
                          const isSelected = Boolean(
                            currentMember && option.votes.includes(currentMember.userId)
                          );
                          const voteCount = option.votes.length;
                          const total = msg.poll!.totalVotes || 0;
                          const percent = total > 0 ? Math.round((voteCount / total) * 100) : 0;

                          return (
                            <button
                              key={option.id}
                              type="button"
                              disabled={msg.poll!.isClosed}
                              onClick={() => votePoll(msg.id, option.id)}
                              className={`w-full relative overflow-hidden text-left p-3 rounded-xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                                isSelected
                                  ? 'border-terracotta-500 bg-terracotta-50/70 dark:bg-terracotta-950/40 ring-1 ring-terracotta-400'
                                  : 'border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-800 hover:border-terracotta-300 dark:hover:border-terracotta-800'
                              } ${msg.poll!.isClosed ? 'cursor-default opacity-85' : ''}`}
                            >
                              {/* Background percentage fill bar */}
                              <div
                                className={`absolute top-0 bottom-0 left-0 transition-all duration-500 ${
                                  isSelected
                                    ? 'bg-terracotta-200/50 dark:bg-terracotta-900/50'
                                    : 'bg-ivory-200/50 dark:bg-espresso-700/40'
                                }`}
                                style={{ width: `${percent}%` }}
                              />

                              {/* Option Selection Indicator & Text */}
                              <div className="relative flex items-center gap-2.5 z-10 min-w-0 flex-1">
                                {msg.poll!.allowMultipleAnswers ? (
                                  <div
                                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition ${
                                      isSelected
                                        ? 'border-terracotta-600 bg-terracotta-600 text-white'
                                        : 'border-espresso-300 dark:border-espresso-600 bg-white dark:bg-espresso-900'
                                    }`}
                                  >
                                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                  </div>
                                ) : (
                                  <div
                                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition ${
                                      isSelected
                                        ? 'border-terracotta-600 bg-terracotta-600 text-white'
                                        : 'border-espresso-300 dark:border-espresso-600 bg-white dark:bg-espresso-900'
                                    }`}
                                  >
                                    {isSelected && (
                                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                    )}
                                  </div>
                                )}
                                <span
                                  className={`text-xs font-semibold truncate ${
                                    isSelected
                                      ? 'text-espresso-950 dark:text-ivory-50'
                                      : 'text-espresso-800 dark:text-ivory-200'
                                  }`}
                                >
                                  {option.text}
                                </span>
                              </div>

                              {/* Vote Percentage & Count */}
                              <div className="relative z-10 shrink-0 text-right font-mono text-xs">
                                <span className="font-bold text-espresso-900 dark:text-ivory-100">
                                  {percent}%
                                </span>
                                <span className="text-[11px] text-espresso-400 dark:text-espresso-500 ml-1.5">
                                  ({voteCount})
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Poll Footer */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-ivory-200/70 dark:border-espresso-800/80 text-[11px] text-espresso-500 dark:text-ivory-400">
                        <div className="flex items-center gap-3">
                          <span>
                            {msg.poll.totalVotes} {msg.poll.totalVotes === 1 ? 'vote' : 'votes'} total
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            {msg.poll.isAnonymous ? (
                              <>
                                <Lock className="w-3 h-3 text-espresso-400" /> Anonymous
                              </>
                            ) : (
                              <>
                                <Users className="w-3 h-3 text-espresso-400" /> Public
                              </>
                            )}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const summary = `📊 Poll: ${msg.poll!.question}\n${msg.poll!.options
                                .map((o) => `• ${o.text}: ${o.votes.length} votes`)
                                .join('\n')}\nTotal Votes: ${msg.poll!.totalVotes}`;
                              navigator.clipboard.writeText(summary);
                              setCopiedPollId(msg.id);
                              setTimeout(() => setCopiedPollId(null), 2000);
                            }}
                            className="px-2.5 py-1 rounded-lg border border-ivory-300 dark:border-espresso-700 hover:bg-ivory-100 dark:hover:bg-espresso-800 text-[11px] font-medium transition cursor-pointer flex items-center gap-1"
                          >
                            {copiedPollId === msg.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" /> Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" /> Copy Summary
                              </>
                            )}
                          </button>

                          {!msg.poll.isClosed &&
                            (msg.senderId === currentMember?.userId || canModerateChat) && (
                              <button
                                type="button"
                                onClick={() => closePoll(msg.id)}
                                className="px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-[11px] font-medium transition cursor-pointer"
                              >
                                Close Poll
                              </button>
                            )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Interactive Resource Card ── */}
                  {msg.resource && !msg.isDeleted && (
                    <div className="mt-3 p-3.5 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-ivory-50/70 dark:bg-espresso-900/50 shadow-2xs space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="p-2 rounded-xl bg-terracotta-100 dark:bg-terracotta-950/60 text-terracotta-600 dark:text-terracotta-400 shrink-0 mt-0.5">
                            {msg.resource.category === 'slides' ? (
                              <BookOpen className="w-4 h-4" />
                            ) : msg.resource.category === 'recording' ? (
                              <Video className="w-4 h-4" />
                            ) : msg.resource.category === 'assignment' ? (
                              <Bookmark className="w-4 h-4" />
                            ) : (
                              <FileText className="w-4 h-4" />
                            )}
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider bg-ivory-200 dark:bg-espresso-800 text-espresso-700 dark:text-ivory-300">
                              {msg.resource.category}
                            </span>
                            <h4 className="text-xs font-bold text-espresso-950 dark:text-ivory-50 truncate pt-0.5">
                              {msg.resource.title}
                            </h4>
                            {msg.resource.description && (
                              <p className="text-[11px] text-espresso-600 dark:text-ivory-300 line-clamp-2">
                                {msg.resource.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(msg.resource!.url);
                              setCopiedResourceId(msg.id);
                              setTimeout(() => setCopiedResourceId(null), 2000);
                            }}
                            className="p-1.5 rounded-lg border border-ivory-300 dark:border-espresso-700 hover:bg-ivory-100 dark:hover:bg-espresso-800 text-espresso-500 hover:text-espresso-800 transition cursor-pointer"
                            title="Copy link"
                          >
                            {copiedResourceId === msg.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <a
                            href={msg.resource.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-xl bg-terracotta-600 hover:bg-terracotta-700 text-white text-xs font-semibold shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                          >
                            <span>Open</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Emoji Reactions Bar */}
                  {!msg.isDeleted && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {Object.entries(msg.reactions || {}).map(([emoji, users]) => {
                        if (!users || users.length === 0) return null;
                        const hasReacted = currentMember && users.includes(currentMember.userId);
                        return (
                          <button
                            key={emoji}
                            onClick={() => {
                              if (hasReacted) removeReaction(msg.id, emoji);
                              else addReaction(msg.id, emoji);
                            }}
                            className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 border transition ${
                              hasReacted
                                ? 'bg-terracotta-100 dark:bg-terracotta-950/60 border-terracotta-300 text-terracotta-800 dark:text-terracotta-300 font-bold'
                                : 'border-ivory-200 dark:border-espresso-750 bg-ivory-50 dark:bg-espresso-900 text-espresso-700 dark:text-espresso-300 hover:bg-ivory-100'
                            }`}
                          >
                            <span>{emoji}</span>
                            <span className="text-[10px] font-mono">{users.length}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Action Bar on hover */}
                  {!msg.isDeleted && (
                    <div className="opacity-0 group-hover:opacity-100 transition absolute right-3 top-3 flex items-center gap-1 bg-white/95 dark:bg-espresso-850/95 backdrop-blur-xs p-1 rounded-xl border border-ivory-300 dark:border-espresso-750 shadow-subtle">
                      {/* Quick Reactions */}
                      {EMOJI_PALETTE.slice(0, 3).map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => addReaction(msg.id, emoji)}
                          className="p-1 rounded hover:bg-ivory-100 dark:hover:bg-espresso-800 text-xs transition"
                          title={`React ${emoji}`}
                        >
                          {emoji}
                        </button>
                      ))}

                      {/* Reply */}
                      <button
                        onClick={() => setReplyingTo(msg)}
                        className="p-1 rounded text-espresso-400 hover:text-espresso-700 dark:hover:text-ivory-200 hover:bg-ivory-100 dark:hover:bg-espresso-800 text-[11px]"
                        title="Reply in thread"
                      >
                        <Reply className="w-3 h-3" />
                      </button>

                      {/* Star / Save */}
                      <button
                        onClick={() => toggleSaveMessage(msg.id)}
                        className={`p-1 rounded text-[11px] hover:bg-ivory-100 dark:hover:bg-espresso-800 ${
                          isSaved ? 'text-amber-500' : 'text-espresso-400 hover:text-espresso-700'
                        }`}
                        title={isSaved ? 'Starred message' : 'Star message'}
                      >
                        {isSaved ? (
                          <BookmarkCheck className="w-3 h-3" />
                        ) : (
                          <Bookmark className="w-3 h-3" />
                        )}
                      </button>

                      {/* Pin (CR / Authorized Co-Admin only) */}
                      {canPublishNotices && (
                        <button
                          onClick={() => togglePinMessage(msg.id)}
                          className={`p-1 rounded text-[11px] hover:bg-ivory-100 dark:hover:bg-espresso-800 ${
                            msg.isPinned
                              ? 'text-terracotta-600'
                              : 'text-espresso-400 hover:text-espresso-700'
                          }`}
                          title="Pin as official notice"
                        >
                          <Pin className="w-3 h-3" />
                        </button>
                      )}

                      {/* Edit (Author only) */}
                      {isMe && !msg.poll && (
                        <button
                          onClick={() => {
                            setEditingMsg(msg);
                            setEditContent(msg.content);
                          }}
                          className="p-1 rounded text-espresso-400 hover:text-espresso-700 dark:hover:text-ivory-200 hover:bg-ivory-100 dark:hover:bg-espresso-800 text-[11px]"
                          title="Edit message"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      )}

                      {/* Delete (Author or CR/Admin) */}
                      {(isMe || canModerateChat) && (
                        <button
                          onClick={() => deleteMessage(msg.id)}
                          className="p-1 rounded text-espresso-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-[11px]"
                          title="Delete message"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Edit Message Modal/Drawer */}
      {editingMsg && (
        <div className="p-3 rounded-2xl border border-ochre-300 dark:border-ochre-800 bg-ochre-50/70 dark:bg-ochre-950/40 space-y-2 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ochre-800 dark:text-ochre-300">
              Edit Message
            </span>
            <button
              onClick={() => setEditingMsg(null)}
              className="p-1 text-espresso-400 hover:text-espresso-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-900 text-espresso-950 dark:text-ivory-50 focus:outline-none"
            />
            <button
              onClick={handleSaveEdit}
              className="px-3 py-1.5 rounded-xl bg-ochre-600 hover:bg-ochre-700 text-white text-xs font-semibold"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Replying Banner above input */}
      {replyingTo && (
        <div className="p-2.5 rounded-xl bg-ivory-100 dark:bg-espresso-800 border-l-4 border-terracotta-500 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <CornerDownRight className="w-3.5 h-3.5 text-terracotta-600" />
            <span className="text-xs text-espresso-700 dark:text-ivory-200 truncate">
              Replying to <strong className="font-semibold">{replyingTo.senderName}</strong>:{' '}
              "{replyingTo.content}"
            </span>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="p-1 text-espresso-400 hover:text-espresso-700"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Quick Tools & Message Input Bar */}
      <div className="space-y-2 shrink-0">
        {/* Quick Tools Toolbar */}
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-1.5">
            {/* Create Poll Button */}
            <button
              type="button"
              onClick={() => setShowCreatePollModal(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 hover:bg-ivory-100 dark:hover:bg-espresso-800 text-espresso-800 dark:text-ivory-200 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <BarChart2 className="w-3.5 h-3.5 text-terracotta-600" />
              <span>Create Poll</span>
            </button>

            {/* Share Resource Button */}
            <button
              type="button"
              onClick={() => setShowShareResourceModal(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 hover:bg-ivory-100 dark:hover:bg-espresso-800 text-espresso-800 dark:text-ivory-200 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <Link2 className="w-3.5 h-3.5 text-terracotta-600" />
              <span>Share Resource</span>
            </button>

            {/* Announcement Mode Toggle for CR / Permitted Co-Admin */}
            {canPublishNotices && (
              <button
                type="button"
                onClick={() => setIsAnnouncementMode(!isAnnouncementMode)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                  isAnnouncementMode
                    ? 'bg-amber-500 text-white border border-amber-600 ring-2 ring-amber-400'
                    : 'border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 text-espresso-800 dark:text-ivory-200 hover:bg-ivory-100 dark:hover:bg-espresso-800'
                }`}
                title="Post as official announcement pinned to the top"
              >
                <Megaphone className="w-3.5 h-3.5" />
                <span>Notice Mode</span>
              </button>
            )}
          </div>
        </div>

        {/* Message Input Form */}
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <input
            type="text"
            value={inputContent}
            onChange={(e) => setInputContent(e.target.value)}
            placeholder={
              isAnnouncementMode
                ? '📢 Write official class notice (pinned announcement)...'
                : `Message #${activeChannel?.name || activeWorkspace?.name || 'chat'}...`
            }
            className={`flex-1 px-4 py-3 text-xs sm:text-sm rounded-2xl border bg-white dark:bg-espresso-850 text-espresso-950 dark:text-ivory-50 placeholder-espresso-400 focus:outline-none focus:ring-2 focus:ring-terracotta-400 shadow-subtle ${
              isAnnouncementMode
                ? 'border-amber-400 ring-2 ring-amber-300'
                : 'border-ivory-300 dark:border-espresso-750'
            }`}
          />
          <button
            type="submit"
            disabled={!inputContent.trim()}
            className="p-3 rounded-2xl bg-terracotta-600 hover:bg-terracotta-700 disabled:opacity-40 text-white shadow-subtle transition cursor-pointer shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Create Poll Modal */}
      <CreatePollModal
        isOpen={showCreatePollModal}
        onClose={() => setShowCreatePollModal(false)}
        onSubmit={async (question, options, allowMultipleAnswers, isAnonymous) => {
          return createPoll(question, options, allowMultipleAnswers, isAnonymous);
        }}
      />

      {/* Share Resource Modal */}
      <ShareResourceModal
        isOpen={showShareResourceModal}
        onClose={() => setShowShareResourceModal(false)}
        onSubmit={async (title, url, category, description) => {
          return shareResource(title, url, category, description);
        }}
      />

      {/* Create Channel Modal (CR Only) */}
      {showCreateChannelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Hash className="w-4 h-4 text-primary" />
                <span>Create Class Channel</span>
              </h3>
              <button
                onClick={() => setShowCreateChannelModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {channelError && (
              <div className="p-2.5 rounded-xl text-xs bg-destructive/10 text-destructive border border-destructive/20">
                {channelError}
              </div>
            )}

            <form onSubmit={handleCreateChannelSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground">Channel Name</label>
                <input
                  type="text"
                  placeholder="e.g. Project Teams, Lab Q&A"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-xs rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Description (Optional)</label>
                <input
                  type="text"
                  placeholder="What is this channel for?"
                  value={newChannelDesc}
                  onChange={(e) => setNewChannelDesc(e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-xs rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateChannelModal(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-muted-foreground hover:bg-secondary transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newChannelName.trim()}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-xs disabled:opacity-50"
                >
                  Create Channel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
