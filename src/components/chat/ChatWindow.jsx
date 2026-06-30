import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { useCall } from '../../context/CallContext';
import { motion, AnimatePresence } from 'framer-motion';
import EmojiPicker from './EmojiPicker';

const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const hasOnlyEmojis = (str) => {
  if (!str || !str.trim()) return false;
  const cleaned = str.replace(/\s+/g, '');
  const emojiRegex = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|\u200d|\uFE0F)+$/u;
  return emojiRegex.test(cleaned);
};
import {
  Send, Paperclip, Smile, MoreVertical, MoreHorizontal, ShieldCheck, Phone, Video,
  Info, Image as ImageIcon, FileText, Film, Volume2, ArrowLeft, Trash2, LogOut, Check, CheckCheck,
  Users2, X, Plus, Reply, Pin, PinOff, Pencil, ChevronDown, Download, Mail, User, Calendar,
  Ban, EyeOff, UserMinus
} from 'lucide-react';

function ChatWindow() {
  const { user, getAvatarUrl, apiBase, accessToken, chatBgPattern } = useAuth();
  const {
    activeChat, messages, selectChat, sendMessage, sendMediaMessage,
    setTypingIndicator, typingStatus, leaveGroup, addGroupMembers, removeGroupMember, friends,
    replyingTo, setReplyingTo, editMessage, deleteMessage, pinMessage, reactMessage,
    pinChatAction, unpinChatAction, blockUserAction, unblockUserAction,
    hideChatAction, removeFriendshipAction
  } = useChat();
  const { startCall } = useCall();

  const isGroup = activeChat ? !!activeChat.groupId : false;

  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [selectedFriendsToGroup, setSelectedFriendsToGroup] = useState([]);

  // Chat actions dropdown (header MoreVertical)
  const [showChatMenu, setShowChatMenu] = useState(false);
  const chatMenuRef = useRef(null);
  // Confirmation modal for destructive actions
  const [confirmAction, setConfirmAction] = useState(null); // { type, friendId, friendName }

  // Custom states for editing, highlighting, and scrolling
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editInputText, setEditInputText] = useState('');
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [activeMenuMessageId, setActiveMenuMessageId] = useState(null);
  const messageRefs = useRef(new Map());

  // Helper function to download files locally (forces local browser download)
  const handleDownload = async (url, originalFilename) => {
    try {
      // Local blob or base64 preview URLs can be downloaded directly
      if (url.startsWith('blob:') || url.startsWith('data:')) {
        const link = document.createElement('a');
        link.href = url;
        link.download = originalFilename || 'download';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }

      // Proxy remote (Firebase Storage) or server-stored files through the backend to avoid CORS and force local folder save
      const downloadUrl = `${apiBase}/api/chat/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(originalFilename || '')}&token=${accessToken}`;
      window.open(downloadUrl, '_blank');
    } catch (err) {
      console.error('Failed to download file:', err);
      window.open(url, '_blank');
    }
  };

  const scrollToMessage = (messageId) => {
    const el = messageRefs.current.get(messageId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMessageId(messageId);
      setTimeout(() => {
        setHighlightedMessageId(null);
      }, 2000);
    }
  };

  const handleEmojiSelect = (emoji) => {
    const ref = inputRef.current;
    if (!ref) {
      setInputText(prev => prev + emoji);
      return;
    }
    const start = ref.selectionStart;
    const end = ref.selectionEnd;
    const text = inputText;
    const before = text.substring(0, start);
    const after = text.substring(end);
    setInputText(before + emoji + after);

    const newCursorPos = start + emoji.length;
    setTimeout(() => {
      ref.focus();
      ref.selectionStart = newCursorPos;
      ref.selectionEnd = newCursorPos;
    }, 0);
  };

  // Mentions State
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearchQuery, setMentionSearchQuery] = useState('');
  const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0);
  const [mentionTriggerIndex, setMentionTriggerIndex] = useState(-1);
  const inputRef = useRef(null);

  const filteredMembers = isGroup && activeChat?.members
    ? activeChat.members
      .filter(m => m.id !== user?.id)
      .filter(m => m.displayName.toLowerCase().includes(mentionSearchQuery.toLowerCase()))
    : [];

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingStatus]);

  // Close mention dropdown when active chat changes
  useEffect(() => {
    setShowMentionDropdown(false);
  }, [activeChat?.id]);

  // Auto-focus text input box when active chat changes
  useEffect(() => {
    if (activeChat) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [activeChat?.id]);

  // Close message options dropdown when clicking anywhere else
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (activeMenuMessageId && !e.target.closest('.message-dropdown-container')) {
        setActiveMenuMessageId(null);
      }
      if (showChatMenu && chatMenuRef.current && !chatMenuRef.current.contains(e.target)) {
        setShowChatMenu(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [activeMenuMessageId, showChatMenu]);

  // Handle confirmed destructive actions from the header/profile menu
  const handleConfirmChatAction = async () => {
    if (!confirmAction) return;
    const { type, friendId } = confirmAction;
    if (type === 'block') await blockUserAction(friendId);
    if (type === 'unblock') await unblockUserAction(friendId);
    if (type === 'removeChat') await hideChatAction(friendId);
    if (type === 'removeFriendship') { await removeFriendshipAction(friendId); selectChat(null); }
    setConfirmAction(null);
    setShowGroupInfo(false);
  };

  if (!user) return null;

  // Handle typing indicator debouncer and mention trigger detection
  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputText(val);

    if (!isTyping) {
      setIsTyping(true);
      setTypingIndicator(true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      setTypingIndicator(false);
    }, 1500);

    // Mentions logic in group chats
    if (isGroup) {
      const selectionStart = e.target.selectionStart || 0;
      const textBeforeCursor = val.slice(0, selectionStart);
      const lastAtOffset = textBeforeCursor.lastIndexOf('@');

      if (lastAtOffset !== -1) {
        // Check if the '@' is at the start or preceded by a space
        const isTriggered = lastAtOffset === 0 || textBeforeCursor[lastAtOffset - 1] === ' ';

        if (isTriggered) {
          const query = textBeforeCursor.slice(lastAtOffset + 1);
          // Only show dropdown if the query doesn't contain spaces
          if (!query.includes(' ')) {
            setShowMentionDropdown(true);
            setMentionSearchQuery(query);
            setMentionTriggerIndex(lastAtOffset);
            setMentionSelectedIndex(0);
            return;
          }
        }
      }
    }
    setShowMentionDropdown(false);
  };

  // Keyboard navigation inside mentions dropdown
  const handleKeyDown = (e) => {
    if (showMentionDropdown && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionSelectedIndex(prev => (prev + 1) % filteredMembers.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionSelectedIndex(prev => (prev - 1 + filteredMembers.length) % filteredMembers.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        selectMention(filteredMembers[mentionSelectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowMentionDropdown(false);
      }
    }
  };

  // Insert selected mention into input box
  const selectMention = (member) => {
    if (!member) return;
    const textBeforeMention = inputText.slice(0, mentionTriggerIndex);
    const textAfterCursor = inputText.slice(mentionTriggerIndex + 1 + mentionSearchQuery.length);
    const newText = `${textBeforeMention}@${member.displayName} ${textAfterCursor}`;
    setInputText(newText);
    setShowMentionDropdown(false);

    // Maintain focus and set cursor position right after the mention space
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newCursorPos = mentionTriggerIndex + member.displayName.length + 2; // +1 for '@', +1 for space
        inputRef.current.selectionStart = newCursorPos;
        inputRef.current.selectionEnd = newCursorPos;
      }
    }, 0);
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    sendMessage(inputText.trim(), 'text');
    setInputText('');

    // Clear typing status immediately on send
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    setIsTyping(false);
    setTypingIndicator(false);
    setShowEmojiPicker(false);
  };

  const handleFileUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    setShowAttachMenu(false);
    try {
      await sendMediaMessage(file);
    } catch (err) {
      alert('Failed to send file.');
    }
  };

  // Helper Date Formatter
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Helper to parse and render mentions in text messages
  const renderMessageContent = (content, members) => {
    if (!content) return '';
    if (!members || members.length === 0) return content;

    // Sort members by display name length descending to avoid partial matching bugs (e.g., matching "John" in "John Doe")
    const sortedMembers = [...members].sort((a, b) => b.displayName.length - a.displayName.length);

    // Escape special characters in display names to build a safe regex
    const escapedNames = sortedMembers.map(m => m.displayName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
    if (escapedNames.length === 0) return content;

    // Match exact display names preceded by '@' and followed by space, punctuation, or end of string
    const regex = new RegExp(`@(${escapedNames.join('|')})(?=\\s|$|[.,!?;:])`, 'g');

    const parts = [];
    let lastIndex = 0;
    let match;

    regex.lastIndex = 0;
    while ((match = regex.exec(content)) !== null) {
      const matchIndex = match.index;
      const matchText = match[0];
      const nameOnly = match[1];

      if (matchIndex > lastIndex) {
        parts.push(content.substring(lastIndex, matchIndex));
      }

      const member = sortedMembers.find(m => m.displayName === nameOnly);
      const isCurrentUserMentioned = member?.id === user?.id;

      parts.push(
        <span
          key={matchIndex}
          className={`font-semibold px-1 rounded-md transition-colors ${isCurrentUserMentioned
            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold font-sans'
            : 'text-emerald-400 hover:underline cursor-pointer font-sans'
            }`}
        >
          {matchText}
        </span>
      );

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }

    return parts.length > 0 ? parts : content;
  };

  // Get active typing status text
  const getTypingText = () => {
    if (!activeChat) return null;
    const isGroup = !!activeChat.groupId;
    const chatId = isGroup ? activeChat.id : [user.id, activeChat.id].sort().join('_');
    const chatTypers = typingStatus[chatId];

    if (!chatTypers || Object.keys(chatTypers).length === 0) return null;

    if (isGroup) {
      const names = Object.keys(chatTypers)
        .filter(id => id !== user.id)
        .map(id => {
          const member = activeChat.members?.find(m => m.id === id);
          return member ? member.displayName : 'Someone';
        });

      if (names.length === 0) return null;
      if (names.length === 1) return `${names[0]} is typing...`;
      return `${names.slice(0, 2).join(', ')} are typing...`;
    } else {
      // 1-to-1 chat
      if (chatTypers[activeChat.id]) {
        return 'typing...';
      }
    }
    return null;
  };

  const typingText = getTypingText();

  // --- 1. EMPTY CHAT STATE ---
  if (!activeChat) {
    return (
      <div className="h-full w-full chat-bg flex flex-col items-center justify-center p-8 text-center select-none font-sans relative overflow-hidden" data-bg-pattern={chatBgPattern}>
        <div className="max-w-md p-8 rounded-3xl glass border border-zinc-800/80 shadow-2xl flex flex-col items-center relative z-10">
          <motion.div
            animate={{
              y: [0, -6, 0],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="h-20 w-20 bg-gradient-to-tr from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 rounded-3xl flex items-center justify-center text-5xl mb-6 shadow-lg shadow-emerald-500/5"
          >
            💬
          </motion.div>
          <h2 className="text-xl font-bold tracking-tight text-white font-sans">Talkzen</h2>
          <p className="mt-2.5 text-xs text-zinc-400 max-w-[320px] leading-relaxed">
            All conversations are synchronized in real-time. Direct messages, group channels, and media attachments are isolated securely.
          </p>
          <div className="mt-6 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/5 border border-emerald-500/20 text-[10px] text-emerald-400 font-semibold tracking-wide uppercase">
            <ShieldCheck className="h-3.5 w-3.5" /> End-To-End Synced
          </div>
        </div>
      </div>
    );
  }

  // Determine chat characteristics
  const isOnline = !isGroup && activeChat.status === 'online';

  const emojis = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '🎉'];

  return (
    <div className="h-full w-full flex flex-col bg-zinc-950 font-sans relative overflow-hidden">

      {/* 2. CHAT WINDOW HEADER */}
      <div className="p-4 bg-zinc-900/60 border-b border-zinc-800/50 backdrop-blur-md flex items-center justify-between z-10">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => selectChat(null)}
            className="lg:hidden p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition mr-1"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="relative cursor-pointer" onClick={() => setShowGroupInfo(true)}>
            {activeChat.avatarUrl ? (
              <img src={getAvatarUrl(activeChat.avatarUrl)} alt={activeChat.name || activeChat.displayName} className="h-10 w-10 rounded-full object-cover border border-zinc-800" />
            ) : (
              <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-emerald-500/20 to-emerald-500/10 border border-zinc-800 flex items-center justify-center font-bold text-emerald-400 text-xs uppercase">
                {isGroup ? <Users2 className="h-5 w-5" /> : getInitials(activeChat.displayName)}
              </div>
            )}
            {isOnline && (
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-emerald-500 border-2 border-zinc-900 rounded-full"></span>
            )}
          </div>

          <div className="min-w-0" onClick={() => setShowGroupInfo(true)}>
            <h3 className="text-xs font-semibold text-white truncate leading-tight">
              {isGroup ? activeChat.name : activeChat.displayName}
            </h3>
            <span className="text-[10px] text-zinc-400 block truncate mt-0.5 font-medium">
              {typingText ? (
                <span className="text-emerald-400 font-semibold">{typingText}</span>
              ) : isGroup ? (
                `Group Channel • ${activeChat.memberCount || activeChat.members?.length || 0} Members`
              ) : isOnline ? (
                'online'
              ) : (
                activeChat.lastSeen
                  ? `last seen ${new Date(activeChat.lastSeen).toLocaleDateString()} at ${formatTime(activeChat.lastSeen)}`
                  : 'offline'
              )}
            </span>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => startCall(activeChat.id, activeChat.displayName, activeChat.avatarUrl)}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800/50 rounded-xl transition"
            title="Start Audio Call"
          >
            <Phone className="h-4 w-4" />
          </button>
          <button
            onClick={() => startCall(activeChat.id, activeChat.displayName, activeChat.avatarUrl, 'video')}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800/50 rounded-xl transition"
            title="Start Video Call"
          >
            <Video className="h-4 w-4" />
          </button>
          {isGroup ? (
            <button
              onClick={() => setShowGroupInfo(true)}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800/50 rounded-xl transition"
            >
              <Info className="h-4 w-4" />
            </button>
          ) : (
            <div className="relative" ref={chatMenuRef}>
              <button
                onClick={() => setShowChatMenu(prev => !prev)}
                className={`p-2 text-zinc-400 hover:text-white hover:bg-zinc-800/50 rounded-xl transition ${showChatMenu ? 'bg-zinc-800 text-white' : ''}`}
              >
                <MoreVertical className="h-4 w-4" />
              </button>

              {showChatMenu && (
                <div className="absolute right-0 top-10 w-52 bg-zinc-950/95 backdrop-blur-md border border-zinc-800/80 rounded-xl shadow-2xl py-1.5 z-50">
                  {/* Pin / Unpin */}
                  <button
                    onClick={() => {
                      if (activeChat.isPinned) unpinChatAction(activeChat.id);
                      else pinChatAction(activeChat.id);
                      setShowChatMenu(false);
                    }}
                    className="w-full px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800/50 hover:text-white transition flex items-center gap-2"
                  >
                    {activeChat.isPinned
                      ? <><PinOff className="h-3.5 w-3.5 text-zinc-400" /> Unpin Chat</>
                      : <><Pin className="h-3.5 w-3.5 text-emerald-400 rotate-45" /> Pin Chat</>}
                  </button>

                  {/* Block / Unblock */}
                  <button
                    onClick={() => {
                      setConfirmAction({ type: activeChat.isBlocked ? 'unblock' : 'block', friendId: activeChat.id, friendName: activeChat.displayName });
                      setShowChatMenu(false);
                    }}
                    className="w-full px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800/50 hover:text-white transition flex items-center gap-2"
                  >
                    <Ban className="h-3.5 w-3.5 text-amber-500" />
                    {activeChat.isBlocked ? 'Unblock User' : 'Block User'}
                  </button>

                  {/* Remove Chat */}
                  <button
                    onClick={() => {
                      setConfirmAction({ type: 'removeChat', friendId: activeChat.id, friendName: activeChat.displayName });
                      setShowChatMenu(false);
                    }}
                    className="w-full px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800/50 hover:text-white transition flex items-center gap-2"
                  >
                    <EyeOff className="h-3.5 w-3.5 text-zinc-400" />
                    Remove Chat
                  </button>

                  <div className="border-t border-zinc-800/60 my-1" />

                  {/* Remove Friend */}
                  <button
                    onClick={() => {
                      setConfirmAction({ type: 'removeFriendship', friendId: activeChat.id, friendName: activeChat.displayName });
                      setShowChatMenu(false);
                    }}
                    className="w-full px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 transition flex items-center gap-2"
                  >
                    <UserMinus className="h-3.5 w-3.5 text-rose-500" />
                    Remove Friend
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Pinned Messages Banner */}
      {(() => {
        const pinnedMessage = [...messages].reverse().find(m => m.isPinned === 1);
        if (!pinnedMessage) return null;
        return (
          <div
            onClick={() => scrollToMessage(pinnedMessage.id)}
            className="px-4 py-2 bg-zinc-900/95 border-b border-zinc-850/60 flex items-center justify-between cursor-pointer hover:bg-zinc-850/60 transition backdrop-blur-md z-10"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs">📌</span>
              <div className="min-w-0 text-left">
                <span className="text-[9px] font-bold text-emerald-400 block leading-none font-sans">Pinned Message</span>
                <span className="text-[10px] text-zinc-300 truncate block mt-0.5">
                  {pinnedMessage.type === 'deleted'
                    ? 'This message was deleted'
                    : pinnedMessage.type === 'text'
                      ? pinnedMessage.content
                      : `[${pinnedMessage.type}]`}
                </span>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                pinMessage(pinnedMessage.id, false);
              }}
              className="p-1 text-zinc-500 hover:text-zinc-350 rounded-lg transition"
              title="Unpin message"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })()}

      {/* 3. MESSAGES SCROLL LIST */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 chat-bg relative" data-bg-pattern={chatBgPattern}>

        {messages.map((msg) => {
          const isMe = msg.senderId === user.id;
          const isHighlighted = highlightedMessageId === msg.id;

          // Render group system notifications differently
          if (!msg.receiverId && !msg.groupId && !msg.senderId) {
            // It's a system notice
            return (
              <div key={msg.id} className="flex justify-center my-2">
                <span className="px-3 py-1 bg-zinc-900/80 border border-zinc-800/60 rounded-full text-[9px] text-zinc-400 tracking-wider uppercase font-medium">
                  {msg.content}
                </span>
              </div>
            );
          }

          // System message check (fallback based on content)
          const isSystem = msg.content.includes('created') || msg.content.includes('added') || msg.content.includes('left') || msg.content.includes('was added');
          if (isSystem && isGroup) {
            return (
              <div key={msg.id} className="flex justify-center my-2 w-full">
                <span className="px-3 py-1 bg-zinc-900/60 border border-zinc-800/40 rounded-full text-[9px] text-zinc-400 font-medium text-center max-w-[80%]">
                  {msg.content}
                </span>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              ref={el => {
                if (el) messageRefs.current.set(msg.id, el);
                else messageRefs.current.delete(msg.id);
              }}
              className={`flex ${isMe ? 'justify-end' : 'justify-start'} group relative`}
            >
              <div
                onDoubleClick={() => {
                  if (msg.type !== 'deleted') {
                    setReplyingTo(msg);
                    if (inputRef.current) {
                      inputRef.current.focus();
                    }
                  }
                }}
                className={`relative max-w-[75%] py-2 px-3.5 rounded-2xl shadow-md flex flex-col transition-all duration-300 ${isHighlighted ? 'ring-2 ring-emerald-500/60 scale-[1.02] bg-emerald-500/10' : ''
                  } ${isMe
                    ? 'bg-gradient-to-tr from-emerald-500/15 to-emerald-400/5 border border-emerald-500/20 text-white bubble-out'
                    : 'bg-zinc-900/85 backdrop-blur-sm border border-zinc-800/80 text-zinc-200 bubble-in'
                  }`}
                title={msg.type !== 'deleted' ? "Double-click to reply" : undefined}
              >
                {/* Sender Name in Groups */}
                {isGroup && !isMe && (
                  <span className="text-[9px] font-bold text-emerald-400 mb-0.5 leading-none">
                    {msg.senderName}
                  </span>
                )}

                {/* Reply Context Block */}
                {msg.parentMessageId && (
                  <div
                    onClick={() => scrollToMessage(msg.parentMessageId)}
                    className="mb-1.5 p-2 bg-zinc-950/40 hover:bg-zinc-950/60 transition border-l-2 border-emerald-500 rounded-r-lg text-left cursor-pointer select-none max-w-full"
                  >
                    <span className="text-[9px] font-bold text-emerald-400 block leading-tight font-sans">
                      {msg.parentMessageSenderId === user.id ? 'You' : msg.parentMessageSenderName}
                    </span>
                    <span className="text-[10px] text-zinc-400 truncate block mt-0.5 font-sans">
                      {msg.parentMessageType === 'deleted'
                        ? 'This message was deleted'
                        : msg.parentMessageType === 'text'
                          ? msg.parentMessageContent
                          : `[${msg.parentMessageType}]`}
                    </span>
                  </div>
                )}

                {/* Inline Editing or normal rendering */}
                {msg.type === 'deleted' ? (
                  <p className="text-xs leading-relaxed italic text-zinc-500 select-none flex items-center gap-1.5 py-0.5">
                    🚫 This message was deleted
                  </p>
                ) : editingMessageId === msg.id ? (
                  <div className="flex flex-col gap-2 w-full mt-1 min-w-[200px]">
                    <textarea
                      value={editInputText}
                      onChange={(e) => setEditInputText(e.target.value)}
                      className="w-full p-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                      rows={2}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingMessageId(null)}
                        className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-750 text-zinc-350 rounded-md text-[10px] font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (editInputText.trim()) {
                            editMessage(msg.id, editInputText.trim());
                            setEditingMessageId(null);
                          }
                        }}
                        className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-md text-[10px] font-bold"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Status Reply Message */}
                    {msg.type === 'status_reply' && (
                      <div className="flex flex-col gap-2.5 min-w-[240px] max-w-[290px]">
                        {(() => {
                          try {
                            const parsed = JSON.parse(msg.content);
                            return (
                              <>
                                {/* Glassmorphic Quoted Status Box */}
                                <div className="flex gap-2.5 p-2 bg-black/40 border-l-4 border-emerald-500 rounded-r-xl rounded-l-sm text-[10px] text-zinc-300 items-center justify-between shadow-inner">
                                  <div className="flex flex-col min-w-0 pr-1 text-left">
                                    <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Status Update</span>
                                    <span className="truncate italic mt-0.5 text-zinc-400">
                                      {parsed.mediaType === 'video' ? '🎥 Video status' : '📷 Image status'}
                                    </span>
                                  </div>
                                  {parsed.mediaUrl && (
                                    <div className="h-9 w-9 bg-zinc-900 rounded overflow-hidden flex-shrink-0 border border-zinc-800 shadow-sm">
                                      {parsed.mediaType === 'video' ? (
                                        <video src={getAvatarUrl(parsed.mediaUrl)} className="h-full w-full object-cover" muted />
                                      ) : (
                                        <img src={getAvatarUrl(parsed.mediaUrl)} alt="Status update" className="h-full w-full object-cover" />
                                      )}
                                    </div>
                                  )}
                                </div>
                                {/* User's Text Reply */}
                                <p className="text-xs leading-relaxed whitespace-pre-wrap select-text break-words pr-4">
                                  {parsed.text}
                                </p>
                              </>
                            );
                          } catch (err) {
                            return (
                              <p className="text-xs leading-relaxed whitespace-pre-wrap select-text break-words italic text-zinc-500">
                                [Invalid status reply]
                              </p>
                            );
                          }
                        })()}
                      </div>
                    )}

                    {/* A: Text Content */}
                    {msg.type === 'text' && (
                      <p className={`leading-relaxed whitespace-pre-wrap select-text break-words ${hasOnlyEmojis(msg.content) ? 'text-3xl py-0.5' : 'text-xs'}`}>
                        {renderMessageContent(msg.content, activeChat.members)}
                      </p>
                    )}

                    {/* B: Image Media Attachment */}
                    {msg.type === 'image' && (
                      <div className="relative group/media max-w-[280px] my-1 rounded-xl overflow-hidden border border-zinc-800">
                        <div
                          onClick={() => setLightboxImage(msg.content)}
                          className="cursor-pointer hover:opacity-90 transition duration-200"
                        >
                          <img src={getAvatarUrl(msg.content)} alt="Chat attachment" className="w-full h-auto object-cover max-h-48" />
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(msg.content, `image_${msg.id}.png`);
                          }}
                          className="absolute bottom-2 right-2 p-1.5 bg-black/60 hover:bg-zinc-900/90 text-white hover:text-emerald-400 border border-zinc-850 rounded-lg backdrop-blur-sm opacity-0 group-hover/media:opacity-100 transition-opacity duration-200 shadow-lg"
                          title="Download image"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    {/* C: Video Media Attachment */}
                    {msg.type === 'video' && (
                      <div className="relative group/media max-w-[280px] my-1 rounded-xl overflow-hidden border border-zinc-800">
                        <video src={getAvatarUrl(msg.content)} controls className="w-full h-auto max-h-48" />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(msg.content, `video_${msg.id}.mp4`);
                          }}
                          className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-zinc-900/90 text-white hover:text-emerald-400 border border-zinc-850 rounded-lg backdrop-blur-sm opacity-0 group-hover/media:opacity-100 transition-opacity duration-200 shadow-lg z-10"
                          title="Download video"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    {/* D: Audio Media Attachment */}
                    {msg.type === 'audio' && (
                      <div className="flex items-center gap-3 p-2 bg-zinc-950/40 border border-zinc-800 rounded-xl my-1 min-w-[260px]">
                        <Volume2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                        <audio src={getAvatarUrl(msg.content)} controls className="w-full h-7 accent-emerald-500" />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(msg.content, `audio_${msg.id}.mp3`);
                          }}
                          className="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-emerald-400 border border-zinc-800 rounded-lg transition flex-shrink-0"
                          title="Download audio"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    {/* E: Generic File Attachment */}
                    {msg.type === 'file' && (
                      <div
                        onClick={() => handleDownload(msg.content, 'attachment')}
                        className="flex items-center justify-between gap-3 p-2.5 bg-zinc-950/40 border border-zinc-800 rounded-xl my-1 hover:bg-zinc-800/20 transition duration-200 cursor-pointer min-w-[200px]"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                          <div className="min-w-0 text-left">
                            <p className="text-[11px] font-semibold text-white truncate leading-tight">Attachment</p>
                            <span className="text-[9px] text-zinc-500 block mt-0.5">Click to download</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-emerald-400 border border-zinc-800 rounded-lg transition"
                          title="Download file"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                  </>
                )}

                {/* Bubble Footer Metadata Row */}
                <div className="flex items-center justify-end gap-1 mt-1.5 self-end leading-none">
                  {msg.isEdited === 1 && msg.type !== 'deleted' && (
                    <span className="text-[8px] text-zinc-500 font-medium italic mr-1">edited</span>
                  )}
                  {msg.isPinned === 1 && msg.type !== 'deleted' && (
                    <span className="text-[9px] text-emerald-400 mr-1" title="Pinned message">📌</span>
                  )}
                  <span className="text-[9px] text-zinc-500 font-medium">
                    {formatTime(msg.createdAt)}
                  </span>

                  {isMe && (
                    <div className="ml-1 flex items-center">
                      {msg.status === 'sent' && (
                        <Check className="h-3 w-3 text-zinc-500 stroke-[2.5]" />
                      )}
                      {msg.status === 'delivered' && (
                        <div className="relative flex items-center w-[14px] h-3">
                          <Check className="absolute left-0 h-3 w-3 text-zinc-450 stroke-[2.5]" />
                          <Check className="absolute left-[3.5px] h-3 w-3 text-zinc-450 stroke-[2.5]" />
                        </div>
                      )}
                      {msg.status === 'read' && (
                        <div className="relative flex items-center w-[14px] h-3">
                          <Check className="absolute left-0 h-3 w-3 text-sky-400 stroke-[2.5]" />
                          <Check className="absolute left-[3.5px] h-3 w-3 text-sky-400 stroke-[2.5]" />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Interactive Emoji reaction display badge */}
                {msg.reaction && (
                  <span className="absolute -bottom-2.5 right-2 px-1.5 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-[10px] shadow-sm select-none">
                    {msg.reaction}
                  </span>
                )}

                {/* Quick Hover Actions Bar (WhatsApp Style) */}
                {msg.type !== 'deleted' && (
                  <div
                    className={`absolute top-1/2 -translate-y-1/2 z-30 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center gap-0.5 bg-zinc-900/95 border border-zinc-800/80 p-1 rounded-full shadow-xl backdrop-blur-md ${isMe ? 'right-full mr-2.5' : 'left-full ml-2.5'
                      }`}
                  >
                    {/* Reply Icon Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setReplyingTo(msg);
                        if (inputRef.current) {
                          inputRef.current.focus();
                        }
                      }}
                      className="p-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800 rounded-full transition-all duration-150 active:scale-95"
                      title="Reply"
                    >
                      <Reply className="h-3.5 w-3.5" />
                    </button>

                    {/* Pin Icon Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        pinMessage(msg.id, msg.isPinned !== 1);
                      }}
                      className="p-1.5 text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 rounded-full transition-all duration-150 active:scale-95"
                      title={msg.isPinned === 1 ? "Unpin" : "Pin"}
                    >
                      <Pin className={`h-3.5 w-3.5 ${msg.isPinned === 1 ? 'text-amber-400 fill-amber-400/20' : ''}`} />
                    </button>

                    {/* More Actions Menu Button */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuMessageId(prev => prev === msg.id ? null : msg.id);
                        }}
                        className={`p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-all duration-150 active:scale-95 ${activeMenuMessageId === msg.id ? 'bg-zinc-800 text-white' : ''}`}
                        title="More options"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>

                      {/* Glassmorphic Dropdown Actions Menu */}
                      {activeMenuMessageId === msg.id && (
                        <div className={`message-dropdown-container absolute z-40 w-36 p-1.5 bg-zinc-900/95 border border-zinc-800 rounded-xl shadow-2xl flex flex-col gap-0.5 backdrop-blur-md ${isMe ? 'right-0 top-8' : 'left-0 top-8'
                          }`}>
                          {/* Emojis Reaction Row inside Dropdown */}
                          <div className="flex justify-between items-center border-b border-zinc-800/60 pb-1.5 pt-0.5 px-1 mb-1 gap-0.5">
                            {emojis.slice(0, 5).map(emoji => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  reactMessage(msg.id, msg.reaction === emoji ? null : emoji);
                                  setActiveMenuMessageId(null);
                                }}
                                className="text-xs hover:scale-130 transition duration-150 p-0.5"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>

                          {/* Edit Option (Sender & text messages only) */}
                          {isMe && msg.type === 'text' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingMessageId(msg.id);
                                setEditInputText(msg.content);
                                setActiveMenuMessageId(null);
                              }}
                              className="flex items-center gap-2 w-full px-2.5 py-1.5 hover:bg-zinc-800 text-left text-[11px] font-semibold text-zinc-300 hover:text-white rounded-lg transition"
                            >
                              <Pencil className="h-3.5 w-3.5 text-zinc-400" />
                              <span>Edit</span>
                            </button>
                          )}

                          {/* Delete Option (Sender only) */}
                          {isMe && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm('Are you sure you want to delete this message?')) {
                                  deleteMessage(msg.id);
                                }
                                setActiveMenuMessageId(null);
                              }}
                              className="flex items-center gap-2 w-full px-2.5 py-1.5 hover:bg-zinc-800 text-left text-[11px] font-semibold text-red-400 hover:text-red-300 rounded-lg transition"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-red-400/80" />
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>
            </div>
          );
        })}

        {/* typing indicator bubbles */}
        {typingText && (
          <div className="flex justify-start">
            <div className="bg-zinc-900/80 backdrop-blur-sm border border-zinc-800/80 px-4 py-2.5 rounded-2xl bubble-in shadow flex items-center gap-2">
              <span className="text-[10px] text-zinc-400 font-medium">{typingText.split(' ')[0]} is typing</span>
              <div className="flex items-center gap-1 ml-1.5 h-3">
                <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full typing-dot"></span>
                <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full typing-dot"></span>
                <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full typing-dot"></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 4. CHAT INPUT ATTACHMENT MENU / QUICK ACTION MENU */}
      <AnimatePresence>
        {showAttachMenu && (
          <motion.div
            initial={{ y: 15, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 15, opacity: 0 }}
            className="absolute bottom-20 left-4 p-3 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col gap-2 z-20 min-w-[150px]"
          >
            <label className="flex items-center gap-2.5 px-3 py-2 hover:bg-zinc-800 rounded-xl cursor-pointer text-xs font-semibold text-zinc-300 hover:text-white transition">
              <ImageIcon className="h-5 w-5 text-emerald-400" />
              <span>Image</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'image')} />
            </label>
            <label className="flex items-center gap-2.5 px-3 py-2 hover:bg-zinc-800 rounded-xl cursor-pointer text-xs font-semibold text-zinc-300 hover:text-white transition">
              <Film className="h-5 w-5 text-sky-400" />
              <span>Video</span>
              <input type="file" accept="video/*" className="hidden" onChange={(e) => handleFileUpload(e, 'video')} />
            </label>
            <label className="flex items-center gap-2.5 px-3 py-2 hover:bg-zinc-800 rounded-xl cursor-pointer text-xs font-semibold text-zinc-300 hover:text-white transition">
              <Volume2 className="h-5 w-5 text-amber-400" />
              <span>Audio</span>
              <input type="file" accept="audio/*" className="hidden" onChange={(e) => handleFileUpload(e, 'audio')} />
            </label>
            <label className="flex items-center gap-2.5 px-3 py-2 hover:bg-zinc-800 rounded-xl cursor-pointer text-xs font-semibold text-zinc-300 hover:text-white transition">
              <FileText className="h-5 w-5 text-indigo-400" />
              <span>Document</span>
              <input type="file" accept="*" className="hidden" onChange={(e) => handleFileUpload(e, 'file')} />
            </label>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Threaded Reply Preview Card */}
      {replyingTo && (
        <div className="mx-4 mb-2 p-3 bg-zinc-900/90 border border-zinc-800/80 rounded-2xl flex items-center justify-between backdrop-blur-md z-10 border-l-4 border-l-emerald-500 shadow-lg">
          <div className="flex items-center gap-2 min-w-0 pl-1">
            <div className="text-left min-w-0">
              <span className="text-[9px] font-bold text-emerald-400 block leading-tight font-sans">
                Replying to {replyingTo.senderId === user.id ? 'yourself' : replyingTo.senderName}
              </span>
              <span className="text-[10px] text-zinc-300 truncate block mt-0.5 font-sans">
                {replyingTo.type === 'deleted'
                  ? 'This message was deleted'
                  : replyingTo.type === 'text'
                    ? replyingTo.content
                    : `[${replyingTo.type}]`}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            className="p-1 text-zinc-500 hover:text-zinc-300 rounded-lg transition"
            title="Cancel reply"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 5. BOTTOM TEXT ENTRY BOX */}
      <form
        onSubmit={handleSend}
        className="px-4 h-16 bg-zinc-900/60 border-t border-zinc-800/40 backdrop-blur-md flex items-center gap-2.5 z-10"
      >
        <button
          type="button"
          onClick={() => {
            setShowAttachMenu(prev => !prev);
            setShowEmojiPicker(false);
          }}
          className={`p-2.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-850 rounded-xl transition duration-150 flex-shrink-0 ${showAttachMenu ? 'bg-zinc-850 text-emerald-400' : ''}`}
        >
          <Paperclip className="h-5 w-5" />
        </button>

        <div className="flex-1 relative">
          <AnimatePresence>
            {showMentionDropdown && filteredMembers.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute bottom-full left-0 mb-3 w-72 max-h-60 bg-zinc-900/95 backdrop-blur-md border border-zinc-800/80 rounded-2xl shadow-2xl overflow-y-auto z-50 py-2 custom-scrollbar"
              >
                <div className="px-3 py-1 text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800/40 mb-1">
                  Mention Group Member
                </div>
                {filteredMembers.map((member, idx) => {
                  const isSelected = idx === mentionSelectedIndex;
                  return (
                    <div
                      key={member.id}
                      onMouseDown={(e) => {
                        e.preventDefault(); // Prevents input from losing focus
                        selectMention(member);
                      }}
                      onMouseEnter={() => setMentionSelectedIndex(idx)}
                      className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition duration-150 ${isSelected
                        ? 'bg-emerald-500/10 text-emerald-400 border-l-2 border-emerald-500'
                        : 'text-zinc-300 hover:bg-zinc-800/40'
                        }`}
                    >
                      {member.avatarUrl ? (
                        <img
                          src={getAvatarUrl(member.avatarUrl)}
                          alt={member.displayName}
                          className="h-6 w-6 rounded-full object-cover border border-zinc-800"
                        />
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-zinc-800 border border-zinc-700/80 flex items-center justify-center font-bold text-[10px] text-zinc-400 uppercase">
                          {getInitials(member.displayName)}
                        </div>
                      )}
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold truncate leading-tight">
                          {member.displayName}
                        </span>
                        <span className="text-[9px] text-zinc-500 truncate">
                          @{member.displayName.toLowerCase().replace(/\s+/g, '')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Searchable categorized Emoji Picker popover anchored to Smile button */}
          {showEmojiPicker && (
            <div className="absolute bottom-full right-0 mb-3 z-50">
              <EmojiPicker onSelect={handleEmojiSelect} />
            </div>
          )}

          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="block w-full pl-4 pr-11 py-2.5 bg-zinc-950 border border-zinc-800/80 rounded-xl text-zinc-200 placeholder-zinc-500 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition duration-150"
          />

          <button
            type="button"
            onClick={() => {
              setShowEmojiPicker(prev => !prev);
              setShowAttachMenu(false);
            }}
            className={`absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-emerald-400 transition ${showEmojiPicker ? 'text-emerald-400' : ''}`}
          >
            <Smile className="h-5 w-5" />
          </button>
        </div>

        <button
          type="submit"
          disabled={!inputText.trim()}
          className="p-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-950 rounded-xl shadow-lg shadow-emerald-500/5 transition duration-150 flex-shrink-0"
        >
          <Send className="h-5 w-5" />
        </button>
      </form>

      {/* 7. FULLSCREEN LIGHTBOX FOR IMAGES */}
      <AnimatePresence>
        {lightboxImage && (
          <div
            className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4"
            onClick={() => setLightboxImage(null)}
          >
            {/* Action Bar inside Lightbox */}
            <div className="absolute top-4 right-4 flex gap-3" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => handleDownload(lightboxImage, 'image.png')}
                className="p-2 bg-zinc-900 text-white hover:text-emerald-400 rounded-full border border-zinc-800 hover:bg-zinc-800 transition duration-150 shadow-lg"
                title="Download image"
              >
                <Download className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="p-2 bg-zinc-900 text-white rounded-full border border-zinc-800 hover:bg-zinc-800 transition duration-150 shadow-lg"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              src={getAvatarUrl(lightboxImage)}
              alt="Attachment Full size"
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </AnimatePresence>


      {/* 8. SLIDE-OUT INFO DRAWER */}
      <AnimatePresence>
        {showGroupInfo && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs z-30 flex justify-end">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full max-w-xs h-full bg-zinc-900 border-l border-zinc-800 p-6 flex flex-col justify-between overflow-y-auto"
            >
              {isGroup ? (
                // GROUP INFO SIDEBAR
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Group Info</h3>
                    <button
                      onClick={() => setShowGroupInfo(false)}
                      className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Group Details */}
                  <div className="flex flex-col items-center text-center pb-6 border-b border-zinc-850">
                    {activeChat.avatarUrl ? (
                      <img src={getAvatarUrl(activeChat.avatarUrl)} alt="Group" className="h-16 w-16 rounded-full object-cover border border-zinc-800" />
                    ) : (
                      <div className="h-16 w-16 rounded-full bg-gradient-to-tr from-emerald-500/20 to-emerald-500/10 border border-zinc-800 flex items-center justify-center text-emerald-400 font-bold text-lg">
                        <Users2 className="h-8 w-8" />
                      </div>
                    )}
                    <h4 className="text-sm font-bold text-white mt-3 leading-tight">{activeChat.name}</h4>
                    <p className="text-[10px] text-zinc-400 mt-1 max-w-[180px]">{activeChat.description || 'No description provided.'}</p>
                  </div>

                  {/* Members list */}
                  <div className="py-6">
                    {activeChat.members?.find(m => m.id === user.id)?.role === 'admin' && (
                      <button
                        onClick={() => setShowAddMemberModal(true)}
                        className="w-full mb-4 py-2 px-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
                      >
                        <Plus className="h-4 w-4" /> Add Member
                      </button>
                    )}
                    <h5 className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-3">Members ({activeChat.members?.length || 0})</h5>
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {activeChat.members?.map(member => {
                        const isCurrentUser = member.id === user.id;
                        const isAdmin = activeChat.members?.find(m => m.id === user.id)?.role === 'admin';
                        const canRemove = isAdmin && !isCurrentUser && member.role !== 'admin';
                        
                        return (
                          <div key={member.id} className="flex items-center justify-between py-1">
                            <div className="flex items-center gap-2 min-w-0">
                              {member.avatarUrl ? (
                                <img src={getAvatarUrl(member.avatarUrl)} alt={member.displayName} className="h-7 w-7 rounded-full object-cover" />
                              ) : (
                                <div className="h-7 w-7 rounded-full bg-zinc-800 flex items-center justify-center text-[9px] font-bold text-zinc-300 uppercase">
                                  {getInitials(member.displayName)}
                                </div>
                              )}
                              <div className="min-w-0">
                                <span className="text-xs font-semibold text-white truncate block">{member.displayName}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-md ${member.role === 'admin'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-zinc-800 text-zinc-400'
                                }`}>
                                {member.role}
                              </span>
                              {canRemove && (
                                <button
                                  onClick={async () => {
                                    if (confirm(`Remove ${member.displayName} from the group?`)) {
                                      try {
                                        await removeGroupMember(activeChat.id, member.id);
                                      } catch (err) {
                                        alert(err.message || 'Failed to remove member');
                                      }
                                    }
                                  }}
                                  className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                                  title="Remove member"
                                >
                                  <UserMinus className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-zinc-850">
                    <button
                      onClick={() => {
                        if (confirm('Are you sure you want to leave this group chat?')) {
                          leaveGroup(activeChat.id);
                          setShowGroupInfo(false);
                        }
                      }}
                      className="w-full py-2.5 px-4 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
                    >
                      <LogOut className="h-4 w-4" /> Leave Group Channel
                    </button>
                  </div>
                </div>
              ) : (
                // FRIEND PROFILE SIDEBAR
                <div className="flex flex-col h-full justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">Friend Profile</h3>
                      <button
                        onClick={() => setShowGroupInfo(false)}
                        className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    {/* Centered Avatar and Name */}
                    <div className="flex flex-col items-center text-center pb-6 border-b border-zinc-850">
                      <div className="relative">
                        {activeChat.avatarUrl ? (
                          <img src={getAvatarUrl(activeChat.avatarUrl)} alt={activeChat.displayName} className="h-20 w-20 rounded-full object-cover border-2 border-zinc-800 shadow-xl" />
                        ) : (
                          <div className="h-20 w-20 rounded-full bg-gradient-to-tr from-emerald-500/20 to-emerald-500/10 border-2 border-zinc-800 flex items-center justify-center text-emerald-400 font-bold text-2xl uppercase shadow-xl">
                            {getInitials(activeChat.displayName)}
                          </div>
                        )}
                        {activeChat.status === 'online' && (
                          <span className="absolute bottom-0 right-0 h-4 w-4 bg-emerald-500 border-4 border-zinc-900 rounded-full animate-pulse"></span>
                        )}
                      </div>
                      <h4 className="text-base font-bold text-white mt-4 leading-tight">{activeChat.displayName}</h4>
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mt-2 inline-block ${activeChat.status === 'online'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15'
                        : 'bg-zinc-800 text-zinc-450 border border-zinc-750'
                        }`}>
                        {activeChat.status === 'online' ? 'Active now' : 'Offline'}
                      </span>
                    </div>

                    {/* Detailed Metadata fields */}
                    <div className="py-6 space-y-5">
                      {/* Email address */}
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-zinc-550 flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-zinc-450" /> Email Address
                        </span>
                        <span className="text-xs text-zinc-200 block bg-zinc-950/30 border border-zinc-850/50 p-2.5 rounded-xl break-all">
                          {activeChat.email || 'N/A'}
                        </span>
                      </div>

                      {/* Bio Status */}
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-zinc-550 flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-zinc-450" /> Personal Bio
                        </span>
                        <p className="text-xs text-zinc-300 bg-zinc-950/30 border border-zinc-850/50 p-2.5 rounded-xl leading-relaxed whitespace-pre-wrap">
                          {activeChat.bio || 'Hey there! I am using Talkzen.'}
                        </p>
                      </div>

                      {/* Last Seen indicator */}
                      {activeChat.status !== 'online' && activeChat.lastSeen && (
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase font-bold text-zinc-550 flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-zinc-450" /> Last Active
                          </span>
                          <span className="text-xs text-zinc-400 block bg-zinc-950/30 border border-zinc-850/50 p-2.5 rounded-xl font-mono">
                            {new Date(activeChat.lastSeen).toLocaleDateString()} at {formatTime(activeChat.lastSeen)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Chat Action Buttons ── */}
                  <div className="pt-5 border-t border-zinc-800/60 space-y-2">
                    <h5 className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-3">Chat Actions</h5>

                    {/* Pin / Unpin */}
                    <button
                      onClick={() => {
                        if (activeChat.isPinned) unpinChatAction(activeChat.id);
                        else pinChatAction(activeChat.id);
                        setShowGroupInfo(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-zinc-800/40 hover:bg-zinc-800 text-zinc-300 hover:text-white transition text-xs font-medium"
                    >
                      {activeChat.isPinned
                        ? <><PinOff className="h-4 w-4 text-zinc-400 flex-shrink-0" /> Unpin Chat</>
                        : <><Pin className="h-4 w-4 text-emerald-400 rotate-45 flex-shrink-0" /> Pin Chat</>}
                    </button>

                    {/* Block / Unblock */}
                    <button
                      onClick={() => setConfirmAction({ type: activeChat.isBlocked ? 'unblock' : 'block', friendId: activeChat.id, friendName: activeChat.displayName })}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-zinc-800/40 hover:bg-amber-500/10 text-zinc-300 hover:text-amber-400 transition text-xs font-medium"
                    >
                      <Ban className="h-4 w-4 text-amber-500 flex-shrink-0" />
                      {activeChat.isBlocked ? 'Unblock User' : 'Block User'}
                    </button>

                    {/* Remove Chat */}
                    <button
                      onClick={() => setConfirmAction({ type: 'removeChat', friendId: activeChat.id, friendName: activeChat.displayName })}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-zinc-800/40 hover:bg-zinc-800 text-zinc-300 hover:text-white transition text-xs font-medium"
                    >
                      <EyeOff className="h-4 w-4 text-zinc-400 flex-shrink-0" />
                      Remove Chat
                    </button>

                    {/* Remove Friend */}
                    <button
                      onClick={() => setConfirmAction({ type: 'removeFriendship', friendId: activeChat.id, friendName: activeChat.displayName })}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-rose-500/5 hover:bg-rose-500/15 text-rose-400 hover:text-rose-300 transition text-xs font-medium border border-rose-500/10"
                    >
                      <UserMinus className="h-4 w-4 text-rose-500 flex-shrink-0" />
                      Remove Friend
                    </button>
                  </div>

                  {/* Close connection indicator */}
                  <div className="pt-4 border-t border-zinc-850 text-center mt-4">
                    <span className="text-[9px] uppercase tracking-widest text-zinc-650 font-bold block">
                      End-to-End Encrypted Session
                    </span>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= CHAT ACTION CONFIRM MODAL ================= */}
      <AnimatePresence>
        {confirmAction && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="w-full max-w-sm p-6 bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-4">
                {confirmAction.type === 'block' && <Ban className="h-5 w-5 text-amber-500" />}
                {confirmAction.type === 'unblock' && <Ban className="h-5 w-5 text-emerald-500" />}
                {confirmAction.type === 'removeChat' && <EyeOff className="h-5 w-5 text-zinc-400" />}
                {confirmAction.type === 'removeFriendship' && <UserMinus className="h-5 w-5 text-rose-500" />}
                <h3 className="text-sm font-bold text-white">
                  {confirmAction.type === 'block' && 'Block User'}
                  {confirmAction.type === 'unblock' && 'Unblock User'}
                  {confirmAction.type === 'removeChat' && 'Remove Chat'}
                  {confirmAction.type === 'removeFriendship' && 'Remove Friend'}
                </h3>
              </div>
              <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
                {confirmAction.type === 'block' && `Are you sure you want to block ${confirmAction.friendName}? You will no longer receive messages from them.`}
                {confirmAction.type === 'unblock' && `Are you sure you want to unblock ${confirmAction.friendName}?`}
                {confirmAction.type === 'removeChat' && `Remove the chat history with ${confirmAction.friendName} from your sidebar?`}
                {confirmAction.type === 'removeFriendship' && `Remove ${confirmAction.friendName} from your friends list? This will also delete your chat history.`}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmAction(null)}
                  className="flex-1 py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold rounded-xl text-xs transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmChatAction}
                  className={`flex-1 py-2.5 px-4 font-semibold rounded-xl text-xs transition ${confirmAction.type === 'removeFriendship' || confirmAction.type === 'block'
                    ? 'bg-rose-500 hover:bg-rose-400 text-white'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950'
                    }`}
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= ADD MEMBER MODAL OVERLAY ================= */}
      <AnimatePresence>
        {showAddMemberModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm p-6 bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl relative"
            >
              <button
                onClick={() => {
                  setShowAddMemberModal(false);
                  setSelectedFriendsToGroup([]);
                }}
                className="absolute top-4 right-4 p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
              >
                <X className="h-4 w-4" />
              </button>

              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Users2 className="h-5 w-5 text-emerald-400" /> Add Members to Group
              </h3>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">Select Friends</span>
                  <div className="max-h-48 overflow-y-auto border border-zinc-800/50 rounded-xl p-2 space-y-1 bg-zinc-950/40">
                    {friends
                      .filter(f => f.friendshipStatus === 'accepted')
                      .filter(f => !activeChat.members?.some(m => m.id === f.id))
                      .map(friend => {
                        const isChecked = selectedFriendsToGroup.includes(friend.id);
                        return (
                          <div
                            key={friend.id}
                            onClick={() => {
                              setSelectedFriendsToGroup(prev =>
                                prev.includes(friend.id)
                                  ? prev.filter(id => id !== friend.id)
                                  : [...prev, friend.id]
                              );
                            }}
                            className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-zinc-850 cursor-pointer text-left transition"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              readOnly
                              className="accent-emerald-500 h-4 w-4 rounded border-zinc-750 bg-zinc-950"
                            />
                            {friend.avatarUrl ? (
                              <img src={getAvatarUrl(friend.avatarUrl)} alt={friend.displayName} className="h-6 w-6 rounded-full object-cover" />
                            ) : (
                              <div className="h-6 w-6 rounded-full bg-zinc-800 flex items-center justify-center text-[8px] font-bold text-zinc-400 uppercase">
                                {getInitials(friend.displayName)}
                              </div>
                            )}
                            <span className="text-xs font-medium text-zinc-200">{friend.displayName}</span>
                          </div>
                        );
                      })}

                    {friends.filter(f => f.friendshipStatus === 'accepted').filter(f => !activeChat.members?.some(m => m.id === f.id)).length === 0 && (
                      <div className="text-center py-6 text-zinc-500 text-xs">All active friends are already members of this group.</div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddMemberModal(false);
                      setSelectedFriendsToGroup([]);
                    }}
                    className="flex-1 py-2 px-4 bg-zinc-800 hover:bg-zinc-755 text-zinc-300 font-bold rounded-xl text-xs transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={selectedFriendsToGroup.length === 0}
                    onClick={async () => {
                      try {
                        await addGroupMembers(activeChat.id, selectedFriendsToGroup);
                        setShowAddMemberModal(false);
                        setSelectedFriendsToGroup([]);
                      } catch (err) {
                        alert(err.message || 'Failed to add members.');
                      }
                    }}
                    className="flex-1 py-2 px-4 bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-950 font-bold rounded-xl text-xs shadow transition"
                  >
                    Add ({selectedFriendsToGroup.length})
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

export default ChatWindow;
