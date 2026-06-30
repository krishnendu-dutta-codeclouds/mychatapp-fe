import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const { user, apiFetch, accessToken, handleResponse, loading } = useAuth();
  const { socket, connected } = useSocket();

  const [friends, setFriends] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activeChat, setActiveChat] = useState(null); // Either a user (friend) or group
  const [messages, setMessages] = useState([]);
  const [stories, setStories] = useState({ myStories: null, friendsStories: [] });
  const [typingStatus, setTypingStatus] = useState({}); // chatId -> { userId -> isTyping }
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [replyingTo, setReplyingTo] = useState(null);
  
  const playSynthesizedChime = useCallback((type) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      
      const ctx = new AudioCtx();
      
      if (type === 'send') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } else if (type === 'message') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
        osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.08); // A5
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.setValueAtTime(0.05, ctx.currentTime + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      } else if (type === 'friend') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08); // E5
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.16); // G5
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.setValueAtTime(0.06, ctx.currentTime + 0.16);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else if (type === 'group') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(783.99, ctx.currentTime); // G5
        osc.frequency.setValueAtTime(587.33, ctx.currentTime + 0.1); // D5
        osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.2); // E5
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (e) {
      console.warn('Synthesizer play failed:', e);
    }
  }, []);

  // Helper to determine chatId for 1-to-1 chat between two users
  const get1to1ChatId = useCallback((userAId, userBId) => {
    return [userAId, userBId].sort().join('_');
  }, []);

  // Load friends list
  const loadFriends = useCallback(async () => {
    if (!user) return;
    try {
      const response = await apiFetch('/api/users/friends');
      const data = await handleResponse(response);
      setFriends(data);
      
      // Populate initial online status
      const onlineSet = new Set();
      data.forEach(f => {
        if (f.status === 'online') onlineSet.add(f.id);
      });
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        onlineSet.forEach(id => newSet.add(id));
        return newSet;
      });
    } catch (err) {
      console.error('Failed to load friends:', err);
    }
  }, [user, apiFetch, handleResponse]);

  // Load groups list
  const loadGroups = useCallback(async () => {
    if (!user) return;
    try {
      const response = await apiFetch('/api/chat/groups');
      const data = await handleResponse(response);
      // Ensure every group has a groupId property mapped to its id
      const mapped = data.map(g => ({ ...g, groupId: g.id }));
      setGroups(mapped);
    } catch (err) {
      console.error('Failed to load groups:', err);
    }
  }, [user, apiFetch, handleResponse]);

  // Load stories feed
  const loadStories = useCallback(async () => {
    if (!user) return;
    try {
      const response = await apiFetch('/api/stories');
      const data = await handleResponse(response);
      setStories(data);
    } catch (err) {
      console.error('Failed to load stories:', err);
    }
  }, [user, apiFetch, handleResponse]);

  // Triggered on login/initial mount
  useEffect(() => {
    if (loading) return; // Wait until backend URL resolution and token refresh are done!

    if (user) {
      loadFriends();
      loadGroups();
      loadStories();
    } else {
      setFriends([]);
      setGroups([]);
      setActiveChat(null);
      setMessages([]);
      setStories({ myStories: null, friendsStories: [] });
      setTypingStatus({});
      setOnlineUsers(new Set());
      setReplyingTo(null);
    }
  }, [user, loading, loadFriends, loadGroups, loadStories]);

  // Retrieve chat history when active chat changes
  const loadChatHistory = useCallback(async (chatId) => {
    try {
      const response = await apiFetch(`/api/chat/history/${chatId}`);
      const data = await handleResponse(response);
      setMessages(data);

      // Mark messages as read if they were sent by the other user
      if (socket && activeChat) {
        const otherUserId = activeChat.groupId ? null : activeChat.id;
        if (otherUserId) {
          socket.emit('mark_as_read', { chatId, senderId: otherUserId });
        }
      }
    } catch (err) {
      console.error('Failed to load chat history:', err);
    }
  }, [apiFetch, socket, activeChat, handleResponse]);

  const selectChat = useCallback((chat) => {
    if (!chat) {
      setMessages([]);
      setActiveChat(null);
      return;
    }

    const isGroup = !!chat.groupId;
    const chatId = isGroup ? chat.id : get1to1ChatId(user.id, chat.id);
    loadChatHistory(chatId);

    // Clear unread count for selected chat in friends/groups lists
    if (isGroup) {
      setGroups(prev => prev.map(g => g.id === chat.id ? { ...g, unreadCount: 0 } : g));
    } else {
      setFriends(prev => prev.map(f => f.id === chat.id ? { ...f, unreadCount: 0 } : f));
    }

    // Set active chat
    if (isGroup) {
      // If this is a group, asynchronously fetch the full group info to get the member roster
      apiFetch(`/api/chat/groups/${chat.id}`)
        .then(response => handleResponse(response))
        .then(detailedGroup => {
          setActiveChat({ ...detailedGroup, groupId: detailedGroup.id, unreadCount: 0 });
        })
        .catch(err => {
          console.error('Failed to load group roster:', err);
          setActiveChat({ ...chat, unreadCount: 0 });
        });
    } else {
      setActiveChat({ ...chat, unreadCount: 0 });
    }
  }, [user, apiFetch, get1to1ChatId, loadChatHistory, handleResponse, setGroups, setFriends]);

  // Send a text message
  const sendMessage = useCallback((content, type = 'text') => {
    if (!socket || !activeChat || !content.trim()) return;

    const isGroup = !!activeChat.groupId;
    const chatId = isGroup ? activeChat.id : get1to1ChatId(user.id, activeChat.id);
    
    const messagePayload = {
      chatId,
      senderId: user.id,
      receiverId: isGroup ? null : activeChat.id,
      groupId: isGroup ? activeChat.id : null,
      content: content.trim(),
      type,
      parentMessageId: replyingTo ? replyingTo.id : null
    };

    // Play send audio
    playSynthesizedChime('send');

    socket.emit('send_message', messagePayload, (savedMsg) => {
      if (savedMsg.error) {
        console.error('Failed to send message:', savedMsg.error);
        return;
      }
      
      // Append directly to our local messages feed
      setMessages(prev => [...prev, savedMsg]);

      // Update groups/friends list preview dynamically
      if (isGroup) {
        setGroups(prev => prev.map(g => g.id === activeChat.id ? { ...g, lastMessage: savedMsg } : g));
      } else {
        setFriends(prev => prev.map(f => f.id === activeChat.id ? { ...f, lastMessage: savedMsg } : f));
      }
    });

    // Clear reply state
    setReplyingTo(null);
  }, [socket, activeChat, user, get1to1ChatId, replyingTo]);

  // Send a status reply message
  const sendStatusReply = useCallback((receiverId, story, replyText) => {
    if (!socket || !receiverId || !replyText.trim() || !story) return;

    const chatId = get1to1ChatId(user.id, receiverId);
    
    // Build JSON content for the status reply
    const replyContent = JSON.stringify({
      text: replyText.trim(),
      storyId: story.id,
      mediaUrl: story.mediaUrl,
      mediaType: story.mediaType
    });

    const messagePayload = {
      chatId,
      senderId: user.id,
      receiverId,
      groupId: null,
      content: replyContent,
      type: 'status_reply',
      parentMessageId: null
    };

    // Play send audio
    playSynthesizedChime('send');

    socket.emit('send_message', messagePayload, (savedMsg) => {
      if (savedMsg.error) {
        console.error('Failed to send status reply:', savedMsg.error);
        return;
      }
      
      // If the active chat is with this friend, append the message to our local list
      if (activeChat && activeChat.id === receiverId) {
        setMessages(prev => [...prev, savedMsg]);
      }

      // Update friends list preview dynamically
      setFriends(prev => prev.map(f => f.id === receiverId ? { ...f, lastMessage: savedMsg } : f));
    });
  }, [socket, user, get1to1ChatId, activeChat]);

  // Send a media attachment message
  const sendMediaMessage = useCallback(async (file) => {
    if (!activeChat || !file) return;

    const formData = new FormData();
    formData.append('media', file);

    try {
      // 1. Upload to server using apiFetch for automatic token refreshing
      const response = await apiFetch('/api/chat/media/upload', {
        method: 'POST',
        body: formData
      });

      const uploadData = await handleResponse(response);
      
      // 2. Send media URL as a chat message
      sendMessage(uploadData.mediaUrl, uploadData.type);
    } catch (err) {
      console.error('Error sending media message:', err);
    }
  }, [activeChat, sendMessage, apiFetch, handleResponse]);

  // Emit typing indicators
  const setTypingIndicator = useCallback((isTyping) => {
    if (!socket || !activeChat) return;

    const isGroup = !!activeChat.groupId;
    const chatId = isGroup ? activeChat.id : get1to1ChatId(user.id, activeChat.id);

    socket.emit('typing', {
      chatId,
      receiverId: isGroup ? null : activeChat.id,
      groupId: isGroup ? activeChat.id : null,
      isTyping
    });
  }, [socket, activeChat, user, get1to1ChatId]);

  // Post status/story
  const postStory = useCallback(async (file, caption = '') => {
    const formData = new FormData();
    formData.append('media', file);
    if (caption) formData.append('caption', caption);

    try {
      const response = await apiFetch('/api/stories', {
        method: 'POST',
        body: formData
      });

      await handleResponse(response);
      await loadStories();
    } catch (err) {
      console.error('Error posting story:', err);
      throw err;
    }
  }, [loadStories, apiFetch, handleResponse]);

  // View status
  const viewStoryItem = useCallback(async (storyId, storyUserId) => {
    try {
      const response = await apiFetch(`/api/stories/${storyId}/view`, { method: 'POST' });
      if (response.ok) {
        // Update local state to mark viewed
        setStories(prev => {
          const updateViewed = (storiesList) => 
            storiesList.map(s => s.id === storyId ? { ...s, viewed: true } : s);

          if (storyUserId === user.id && prev.myStories) {
            return {
              ...prev,
              myStories: {
                ...prev.myStories,
                stories: updateViewed(prev.myStories.stories)
              }
            };
          } else {
            return {
              ...prev,
              friendsStories: prev.friendsStories.map(fs => fs.userId === storyUserId ? {
                ...fs,
                stories: updateViewed(fs.stories)
              } : fs)
            };
          }
        });
      }
    } catch (err) {
      console.error('Error viewing story:', err);
    }
  }, [user, apiFetch]);

  // Respond to friend request
  const respondFriendRequest = useCallback(async (friendId, accept) => {
    try {
      const response = await apiFetch('/api/users/friends/respond', {
        method: 'POST',
        body: JSON.stringify({ friendId, accept })
      });
      if (response.ok) {
        await loadFriends();
        await loadStories();
      }
    } catch (err) {
      console.error('Error responding to friend request:', err);
    }
  }, [loadFriends, loadStories, apiFetch]);

  // Create a new group
  const createGroupChat = useCallback(async (name, description, memberIds, avatarFile) => {
    const formData = new FormData();
    formData.append('name', name);
    if (description) formData.append('description', description);
    formData.append('members', JSON.stringify(memberIds));
    if (avatarFile) formData.append('avatar', avatarFile);

    try {
      const response = await apiFetch('/api/chat/groups', {
        method: 'POST',
        body: formData
      });

      const data = await handleResponse(response);
      await loadGroups();
      return { ...data.group, groupId: data.group.id };
    } catch (err) {
      console.error('Error creating group:', err);
      throw err;
    }
  }, [loadGroups, apiFetch, handleResponse]);

  // Add members to an existing group
  const addGroupMembers = useCallback(async (groupId, memberIds) => {
    try {
      const response = await apiFetch(`/api/chat/groups/${groupId}/members`, {
        method: 'POST',
        body: JSON.stringify({ members: memberIds })
      });

      const data = await handleResponse(response);
      // Update activeChat's members list in state if we're still viewing this group
      setActiveChat(prev => {
        if (prev && prev.id === groupId) {
          return { ...prev, members: data.members };
        }
        return prev;
      });
      // Refresh groups to sync sidebar member counts
      await loadGroups();
      return data;
    } catch (err) {
      console.error('Error adding group members:', err);
      throw err;
    }
  }, [apiFetch, loadGroups, handleResponse]);

  // Leave a group
  const leaveGroupChat = useCallback(async (groupId) => {
    try {
      const response = await apiFetch(`/api/chat/groups/${groupId}/leave`, { method: 'POST' });
      if (response.ok) {
        selectChat(null);
        await loadGroups();
      }
    } catch (err) {
      console.error('Error leaving group:', err);
    }
  }, [loadGroups, selectChat, apiFetch]);

  // Remove a member from a group (admin only)
  const removeGroupMember = useCallback(async (groupId, memberId) => {
    try {
      const response = await apiFetch(`/api/chat/groups/${groupId}/members/${memberId}`, {
        method: 'DELETE'
      });
      const data = await handleResponse(response);
      // Update activeChat's members list in state if we're still viewing this group
      setActiveChat(prev => {
        if (prev && prev.id === groupId) {
          return { ...prev, members: data.members };
        }
        return prev;
      });
      // Refresh groups to sync sidebar member counts
      await loadGroups();
      return data;
    } catch (err) {
      console.error('Error removing group member:', err);
      throw err;
    }
  }, [apiFetch, loadGroups, handleResponse]);

  // Leave a deleted group (for members of soft-deleted groups)
  const leaveDeletedGroupChat = useCallback(async (groupId) => {
    try {
      const response = await apiFetch(`/api/chat/groups/${groupId}/leave-deleted`, { method: 'POST' });
      if (response.ok) {
        selectChat(null);
        await loadGroups();
      }
    } catch (err) {
      console.error('Error leaving deleted group:', err);
    }
  }, [loadGroups, selectChat, apiFetch]);

  // Edit a message via socket
  const editMessage = useCallback((messageId, newContent) => {
    if (!socket || !activeChat || !newContent.trim()) return;
    const isGroup = !!activeChat.groupId;
    const chatId = isGroup ? activeChat.id : get1to1ChatId(user.id, activeChat.id);

    socket.emit('edit_message', { messageId, chatId, content: newContent.trim() }, (response) => {
      if (response.error) {
        console.error('Failed to edit message:', response.error);
      } else {
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: newContent.trim(), isEdited: 1 } : m));
        
        // Update previews in sidebar
        setFriends(prev => prev.map(f => f.lastMessage?.id === messageId ? { ...f, lastMessage: { ...f.lastMessage, content: newContent.trim(), isEdited: 1 } } : f));
        setGroups(prev => prev.map(g => g.lastMessage?.id === messageId ? { ...g, lastMessage: { ...g.lastMessage, content: newContent.trim(), isEdited: 1 } } : g));
      }
    });
  }, [socket, activeChat, user, get1to1ChatId]);

  // Soft-delete a message via socket
  const deleteMessage = useCallback((messageId) => {
    if (!socket || !activeChat) return;
    const isGroup = !!activeChat.groupId;
    const chatId = isGroup ? activeChat.id : get1to1ChatId(user.id, activeChat.id);

    socket.emit('delete_message', { messageId, chatId }, (response) => {
      if (response.error) {
        console.error('Failed to delete message:', response.error);
      } else {
        const deletedContent = 'This message was deleted';
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: deletedContent, type: 'deleted' } : m));
        
        // Update previews in sidebar
        setFriends(prev => prev.map(f => f.lastMessage?.id === messageId ? { ...f, lastMessage: { ...f.lastMessage, content: deletedContent, type: 'deleted' } } : f));
        setGroups(prev => prev.map(g => g.lastMessage?.id === messageId ? { ...g, lastMessage: { ...g.lastMessage, content: deletedContent, type: 'deleted' } } : g));
      }
    });
  }, [socket, activeChat, user, get1to1ChatId]);

  // Pin/unpin a message via socket
  const pinMessage = useCallback((messageId, isPinned) => {
    if (!socket || !activeChat) return;
    const isGroup = !!activeChat.groupId;
    const chatId = isGroup ? activeChat.id : get1to1ChatId(user.id, activeChat.id);
    const pinVal = isPinned ? 1 : 0;

    socket.emit('pin_message', { messageId, chatId, isPinned: pinVal }, (response) => {
      if (response.error) {
        console.error('Failed to pin message:', response.error);
      } else {
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isPinned: pinVal } : m));
      }
    });
  }, [socket, activeChat, user, get1to1ChatId]);

  // React to a message with an emoji via socket
  const reactMessage = useCallback((messageId, reaction) => {
    if (!socket || !activeChat) return;
    const isGroup = !!activeChat.groupId;
    const chatId = isGroup ? activeChat.id : get1to1ChatId(user.id, activeChat.id);

    socket.emit('react_message', { messageId, chatId, reaction }, (response) => {
      if (response.error) {
        console.error('Failed to react to message:', response.error);
      } else {
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reaction } : m));
      }
    });
  }, [socket, activeChat, user, get1to1ChatId]);

  // ---- Chat Settings Functions ----

  // Pin a chat (persisted server-side)
  const pinChatAction = useCallback(async (friendId) => {
    try {
      const response = await apiFetch('/api/users/chat/pin', {
        method: 'POST',
        body: JSON.stringify({ friendId })
      });
      if (response.ok) {
        setFriends(prev => prev.map(f => f.id === friendId ? { ...f, isPinned: true } : f));
      }
    } catch (err) {
      console.error('Error pinning chat:', err);
    }
  }, [apiFetch]);

  // Unpin a chat
  const unpinChatAction = useCallback(async (friendId) => {
    try {
      const response = await apiFetch('/api/users/chat/unpin', {
        method: 'POST',
        body: JSON.stringify({ friendId })
      });
      if (response.ok) {
        setFriends(prev => prev.map(f => f.id === friendId ? { ...f, isPinned: false } : f));
      }
    } catch (err) {
      console.error('Error unpinning chat:', err);
    }
  }, [apiFetch]);

  // Block a user
  const blockUserAction = useCallback(async (friendId) => {
    try {
      const response = await apiFetch('/api/users/block', {
        method: 'POST',
        body: JSON.stringify({ blockedId: friendId })
      });
      if (response.ok) {
        setFriends(prev => prev.map(f => f.id === friendId ? { ...f, isBlocked: true } : f));
        // If we have this user as active chat, deselect
        if (activeChat && activeChat.id === friendId) {
          selectChat(null);
        }
      }
    } catch (err) {
      console.error('Error blocking user:', err);
    }
  }, [apiFetch, activeChat, selectChat]);

  // Unblock a user
  const unblockUserAction = useCallback(async (friendId) => {
    try {
      const response = await apiFetch('/api/users/unblock', {
        method: 'POST',
        body: JSON.stringify({ blockedId: friendId })
      });
      if (response.ok) {
        setFriends(prev => prev.map(f => f.id === friendId ? { ...f, isBlocked: false } : f));
      }
    } catch (err) {
      console.error('Error unblocking user:', err);
    }
  }, [apiFetch]);

  // Hide chat (remove from sidebar without deleting friendship)
  const hideChatAction = useCallback(async (friendId) => {
    try {
      const response = await apiFetch('/api/users/chat/hide', {
        method: 'POST',
        body: JSON.stringify({ friendId })
      });
      if (response.ok) {
        setFriends(prev => prev.map(f => f.id === friendId ? { ...f, isHidden: true, isPinned: false } : f));
        // Deselect if this is the active chat
        if (activeChat && activeChat.id === friendId) {
          selectChat(null);
        }
      }
    } catch (err) {
      console.error('Error hiding chat:', err);
    }
  }, [apiFetch, activeChat, selectChat]);

  // Remove friendship entirely
  const removeFriendshipAction = useCallback(async (friendId) => {
    try {
      const response = await apiFetch('/api/users/friends/remove', {
        method: 'DELETE',
        body: JSON.stringify({ friendId })
      });
      if (response.ok) {
        setFriends(prev => prev.filter(f => f.id !== friendId));
        // Deselect if this is the active chat
        if (activeChat && activeChat.id === friendId) {
          selectChat(null);
        }
      }
    } catch (err) {
      console.error('Error removing friendship:', err);
    }
  }, [apiFetch, activeChat, selectChat]);

  // Setup Real-time socket event bindings
  useEffect(() => {
    if (!socket) return;

    // A: Real-time Message Reception
    const handleNewMessage = (msg) => {
      const isGroup = !!msg.groupId;
      const msgChatId = msg.chatId;

      // Check if message belongs to active chat screen
      const currentChatId = activeChat 
        ? (activeChat.groupId ? activeChat.id : get1to1ChatId(user.id, activeChat.id))
        : null;

      const isUnread = currentChatId !== msgChatId;

      if (!isUnread) {
        // Play receive audio
        playSynthesizedChime('message');

        setMessages(prev => [...prev, msg]);
        
        // Notify server that we've read this immediately since chat is active
        if (!isGroup) {
          socket.emit('mark_as_read', { chatId: msgChatId, senderId: msg.senderId });
        }
      } else {
        // Play receive sound for background chats as well
        playSynthesizedChime('message');
      }

      // Update previews in list and increment unread count if background chat
      if (isGroup) {
        setGroups(prev => prev.map(g => g.id === msg.groupId ? { 
          ...g, 
          lastMessage: msg,
          unreadCount: isUnread ? (g.unreadCount || 0) + 1 : 0
        } : g));
      } else {
        setFriends(prev => prev.map(f => f.id === msg.senderId || f.id === msg.receiverId ? { 
          ...f, 
          lastMessage: msg,
          unreadCount: isUnread && f.id === msg.senderId ? (f.unreadCount || 0) + 1 : f.unreadCount
        } : f));
      }
    };

    // B: Typing status updates
    const handleUserTyping = ({ chatId, userId: typingUserId, isTyping }) => {
      setTypingStatus(prev => {
        const chatTypers = { ...prev[chatId] };
        if (isTyping) {
          chatTypers[typingUserId] = true;
        } else {
          delete chatTypers[typingUserId];
        }
        return { ...prev, [chatId]: chatTypers };
      });
    };

    // C: Status updates (delivered checkmarks)
    const handleMessageStatusUpdate = ({ messageId, chatId, status }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, status } : m));
      // Also update lastMessage status in friends list
      setFriends(prev => prev.map(f => {
        if (f.lastMessage && f.lastMessage.id === messageId) {
          return { ...f, lastMessage: { ...f.lastMessage, status } };
        }
        return f;
      }));
    };

    // D: Read status sync (blue double checkmarks!)
    const handleMessagesRead = ({ chatId, readerId }) => {
      setMessages(prev => prev.map(m => m.chatId === chatId && m.senderId === user.id ? { ...m, status: 'read' } : m));
      // Also update lastMessage status in friends list
      setFriends(prev => prev.map(f => {
        const fChatId = [user.id, f.id].sort().join('_');
        if (fChatId === chatId && f.lastMessage && f.lastMessage.senderId === user.id) {
          return { ...f, lastMessage: { ...f.lastMessage, status: 'read' } };
        }
        return f;
      }));
    };

    // E: Friend online status changes
    const handleUserStatusChange = ({ userId: statusUserId, status, lastSeen }) => {
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        if (status === 'online') {
          newSet.add(statusUserId);
        } else {
          newSet.delete(statusUserId);
        }
        return newSet;
      });

      setFriends(prev => prev.map(f => f.id === statusUserId ? { ...f, status, lastSeen } : f));
      
      // Update active chat's status if they are the one changing status
      if (activeChat && !activeChat.groupId && activeChat.id === statusUserId) {
        setActiveChat(prev => ({ ...prev, status, lastSeen }));
      }
    };

    // F: Friend requests and acceptances in real-time
    const handleFriendRequest = ({ sender }) => {
      playSynthesizedChime('friend');
      loadFriends();
    };

    const handleFriendAccept = ({ friend }) => {
      playSynthesizedChime('friend');
      loadFriends();
      loadStories();
    };

    const handleFriendDecline = ({ friendId }) => {
      loadFriends();
    };

    // G: Real-time notification for when we are added to a group
    const handleAddedToGroup = (group) => {
      const mappedGroup = { ...group, groupId: group.id };
      setGroups(prev => {
        if (prev.some(g => g.id === mappedGroup.id)) return prev;
        return [mappedGroup, ...prev];
      });
      playSynthesizedChime('group');
    };

    const handleMessageEdited = ({ messageId, content }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content, isEdited: 1 } : m));
      setFriends(prev => prev.map(f => f.lastMessage?.id === messageId ? { ...f, lastMessage: { ...f.lastMessage, content, isEdited: 1 } } : f));
      setGroups(prev => prev.map(g => g.lastMessage?.id === messageId ? { ...g, lastMessage: { ...g.lastMessage, content, isEdited: 1 } } : g));
    };

    const handleMessageDeleted = ({ messageId, content, type }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content, type } : m));
      setFriends(prev => prev.map(f => f.lastMessage?.id === messageId ? { ...f, lastMessage: { ...f.lastMessage, content, type } } : f));
      setGroups(prev => prev.map(g => g.lastMessage?.id === messageId ? { ...g, lastMessage: { ...g.lastMessage, content, type } } : g));
    };

    const handleMessagePinned = ({ messageId, isPinned }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isPinned } : m));
    };

    const handleMessageReacted = ({ messageId, reaction }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reaction } : m));
    };

    // Handle group members updated (when members are added/removed)
    const handleGroupMembersUpdated = ({ groupId, members, memberCount }) => {
      // Update the group in the groups list
      setGroups(prev => prev.map(g => 
        g.id === groupId ? { ...g, members, memberCount } : g
      ));
      
      // Update activeChat if it's the current group
      setActiveChat(prev => {
        if (prev && prev.id === groupId) {
          return { ...prev, members, memberCount };
        }
        return prev;
      });
    };

    // Handle being removed from a group
    const handleRemovedFromGroup = ({ groupId, groupName, removedBy }) => {
      // Remove the group from the groups list
      setGroups(prev => prev.filter(g => g.id !== groupId));
      
      // If this was the active chat, clear it
      setActiveChat(prev => {
        if (prev && prev.id === groupId) {
          return null;
        }
        return prev;
      });
      
      // Clear messages for this group
      setMessages(prev => prev.filter(m => m.groupId !== groupId));
      
      // Show notification
      playSynthesizedChime('group');
      console.log(`You were removed from group: ${groupName}`);
    };

    socket.on('new_message', handleNewMessage);
    socket.on('user_typing', handleUserTyping);
    socket.on('message_status_update', handleMessageStatusUpdate);
    socket.on('messages_read', handleMessagesRead);
    socket.on('user_status_change', handleUserStatusChange);
    socket.on('friend_request', handleFriendRequest);
    socket.on('friend_accept', handleFriendAccept);
    socket.on('friend_decline', handleFriendDecline);
    socket.on('added_to_group', handleAddedToGroup);
    socket.on('group_members_updated', handleGroupMembersUpdated);
    socket.on('removed_from_group', handleRemovedFromGroup);
    socket.on('message_edited', handleMessageEdited);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('message_pinned', handleMessagePinned);
    socket.on('message_reacted', handleMessageReacted);

    // Pull currently active users list on connection
    socket.emit('get_active_users', (userIds) => {
      setOnlineUsers(new Set(userIds));
    });

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('user_typing', handleUserTyping);
      socket.off('message_status_update', handleMessageStatusUpdate);
      socket.off('messages_read', handleMessagesRead);
      socket.off('user_status_change', handleUserStatusChange);
      socket.off('friend_request', handleFriendRequest);
      socket.off('friend_accept', handleFriendAccept);
      socket.off('friend_decline', handleFriendDecline);
      socket.off('added_to_group', handleAddedToGroup);
      socket.off('group_members_updated', handleGroupMembersUpdated);
      socket.off('removed_from_group', handleRemovedFromGroup);
      socket.off('message_edited', handleMessageEdited);
      socket.off('message_deleted', handleMessageDeleted);
      socket.off('message_pinned', handleMessagePinned);
      socket.off('message_reacted', handleMessageReacted);
    };
  }, [socket, activeChat, user, get1to1ChatId]);

  const value = {
    friends,
    groups,
    activeChat,
    messages,
    stories,
    typingStatus,
    onlineUsers,
    replyingTo,
    setReplyingTo,
    selectChat,
    sendMessage,
    sendStatusReply,
    sendMediaMessage,
    setTypingIndicator,
    postStory,
    viewStory: viewStoryItem,
    loadFriends,
    loadGroups,
    loadStories,
    respondFriendRequest,
    createGroup: createGroupChat,
    addGroupMembers,
    leaveGroup: leaveGroupChat,
    leaveDeletedGroup: leaveDeletedGroupChat,
    removeGroupMember,
    editMessage,
    deleteMessage,
    pinMessage,
    reactMessage,
    pinChatAction,
    unpinChatAction,
    blockUserAction,
    unblockUserAction,
    hideChatAction,
    removeFriendshipAction,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
