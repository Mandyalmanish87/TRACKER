import React, { useState, useRef, useEffect } from 'react';
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
} from 'lucide-react';
import { useClassSpace } from '../../context/ClassSpaceContext';
import { getAvatarInitials, getAvatarColor } from '../../utils/classSpaceUtils';
import { ClassMessage } from '../../types/classSpace';

const EMOJI_PALETTE = ['👍', '❤️', '🔥', '🙌', '💡', '👏'];

export const ClassCommunityTab: React.FC = () => {
  const {
    activeWorkspace,
    messages,
    savedMessages,
    pinnedMessages,
    sendMessage,
    addReaction,
    removeReaction,
    editMessage,
    deleteMessage,
    togglePinMessage,
    toggleSaveMessage,
    canModerateChat,
    currentMember,
  } = useClassSpace();

  const [inputContent, setInputContent] = useState('');
  const [replyingTo, setReplyingTo] = useState<ClassMessage | null>(null);
  const [editingMsg, setEditingMsg] = useState<ClassMessage | null>(null);
  const [editContent, setEditContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSavedOnly, setShowSavedOnly] = useState(false);

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

    await sendMessage(inputContent.trim(), replyingTo ? {
      id: replyingTo.id,
      content: replyingTo.content,
      senderName: replyingTo.senderName,
    } : undefined);

    setInputContent('');
    setReplyingTo(null);
  };

  const handleSaveEdit = async () => {
    if (!editingMsg || !editContent.trim()) return;
    await editMessage(editingMsg.id, editContent.trim());
    setEditingMsg(null);
  };

  const savedMsgIdSet = new Set(savedMessages.map((s) => s.messageId));

  const filteredMessages = messages.filter((m) => {
    if (showSavedOnly && !savedMsgIdSet.has(m.id)) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        m.content.toLowerCase().includes(q) ||
        m.senderName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="flex flex-col h-[750px] space-y-4">
      {/* Top Bar: Search, Starred Filter, Stats */}
      <div className="p-4 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-espresso-400" />
            <input
              type="text"
              placeholder="Search class discussions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-950 dark:text-ivory-50 placeholder-espresso-400 focus:outline-none focus:ring-2 focus:ring-terracotta-400"
            />
          </div>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="p-2 text-espresso-400 hover:text-espresso-700"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSavedOnly(!showSavedOnly)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
              showSavedOnly
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300'
                : 'border border-ivory-300 dark:border-espresso-700 text-espresso-600 dark:text-espresso-300 hover:bg-ivory-100'
            }`}
          >
            {showSavedOnly ? <BookmarkCheck className="w-3.5 h-3.5 text-amber-600" /> : <Bookmark className="w-3.5 h-3.5" />}
            <span>Starred ({savedMessages.length})</span>
          </button>
        </div>
      </div>

      {/* Pinned Announcements Drawer if any */}
      {pinnedMessages.length > 0 && !showSavedOnly && !searchQuery && (
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
              {showSavedOnly ? 'No starred messages found.' : searchQuery ? 'No matching messages.' : 'No messages yet.'}
            </p>
            <p className="text-xs text-espresso-400 dark:text-espresso-500 max-w-sm">
              {showSavedOnly
                ? 'Star important homework links, test syllabus notes, or reminders to view them here.'
                : 'Start the conversation! Post questions, schedule reminders, or share study materials with your classmates.'}
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
                className={`group relative flex items-start gap-3 p-2 rounded-2xl transition hover:bg-ivory-50 dark:hover:bg-espresso-800/60 ${
                  msg.isPinned ? 'border-l-4 border-amber-500 bg-amber-50/30 dark:bg-amber-950/10' : ''
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
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {msg.isEdited && (
                      <span className="text-[9px] italic text-espresso-400">(edited)</span>
                    )}
                  </div>

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

                  {/* Message Text Content */}
                  <div className="mt-1 text-xs text-espresso-800 dark:text-ivory-200 leading-relaxed break-words">
                    {msg.isDeleted ? (
                      <span className="italic text-espresso-400">This message was removed.</span>
                    ) : (
                      msg.content
                    )}
                  </div>

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
                        {isSaved ? <BookmarkCheck className="w-3 h-3" /> : <Bookmark className="w-3 h-3" />}
                      </button>

                      {/* Pin (CR/Admin only) */}
                      {canModerateChat && (
                        <button
                          onClick={() => togglePinMessage(msg.id)}
                          className={`p-1 rounded text-[11px] hover:bg-ivory-100 dark:hover:bg-espresso-800 ${
                            msg.isPinned ? 'text-terracotta-600' : 'text-espresso-400 hover:text-espresso-700'
                          }`}
                          title="Pin as announcement"
                        >
                          <Pin className="w-3 h-3" />
                        </button>
                      )}

                      {/* Edit (Author only) */}
                      {isMe && (
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
            <span className="text-xs font-bold text-ochre-800 dark:text-ochre-300">Edit Message</span>
            <button onClick={() => setEditingMsg(null)} className="p-1 text-espresso-400 hover:text-espresso-700">
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
              Replying to <strong className="font-semibold">{replyingTo.senderName}</strong>: "{replyingTo.content}"
            </span>
          </div>
          <button onClick={() => setReplyingTo(null)} className="p-1 text-espresso-400 hover:text-espresso-700">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Message Input Bar */}
      <form onSubmit={handleSend} className="flex items-center gap-2 shrink-0">
        <input
          type="text"
          value={inputContent}
          onChange={(e) => setInputContent(e.target.value)}
          placeholder={`Message #${activeWorkspace?.name || 'ClassSpace'}...`}
          className="flex-1 px-4 py-3 text-xs sm:text-sm rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 text-espresso-950 dark:text-ivory-50 placeholder-espresso-400 focus:outline-none focus:ring-2 focus:ring-terracotta-400 shadow-subtle"
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
  );
};
