import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const { user, apiFetch, accessToken, handleResponse } = useAuth();
  const { socket, connected } = useSocket();

  const [friends, setFriends] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activeChat, setActiveChat] = useState(null); // Either a user (friend) or group
  const [messages, setMessages] = useState([]);
  const [stories, setStories] = useState({ myStories: null, friendsStories: [] });
  const [typingStatus, setTypingStatus] = useState({}); // chatId -> { userId -> isTyping }
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [replyingTo, setReplyingTo] = useState(null);
  
  // Custom sound triggers
  const sendSound = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2357/2357-84.wav'));
  const receiveSound = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2633/2633-84.wav'));
  
  // Volume adjustments
  useEffect(() => {
    sendSound.current.volume = 0.3;
    receiveSound.current.volume = 0.35;
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
  }, [user, loadFriends, loadGroups, loadStories]);

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

  const selectChat = useCallback(async (chat) => {
    setActiveChat(chat);
    if (!chat) {
      setMessages([]);
      return;
    }

    const isGroup = !!chat.groupId;
    const chatId = isGroup ? chat.id : get1to1ChatId(user.id, chat.id);
    loadChatHistory(chatId);

    // If this is a group, asynchronously fetch the full group info to get the member roster
    if (isGroup) {
      try {
        const response = await apiFetch(`/api/chat/groups/${chat.id}`);
        const detailedGroup = await handleResponse(response);
        // Ensure we preserve the groupId and state mapping
        setActiveChat({ ...detailedGroup, groupId: detailedGroup.id });
      } catch (err) {
        console.error('Failed to load group roster:', err);
      }
    }
  }, [user, apiFetch, get1to1ChatId, loadChatHistory, handleResponse]);

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
    sendSound.current.cloneNode(true).play().catch(() => {});

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
    sendSound.current.cloneNode(true).play().catch(() => {});

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

      if (currentChatId === msgChatId) {
        // Play receive audio
        receiveSound.current.cloneNode(true).play().catch(() => {});

        setMessages(prev => [...prev, msg]);
        
        // Notify server that we've read this immediately since chat is active
        if (!isGroup) {
          socket.emit('mark_as_read', { chatId: msgChatId, senderId: msg.senderId });
        }
      } else {
        // Play receive sound for background chats as well
        receiveSound.current.cloneNode(true).play().catch(() => {});
        
        // Optional: show local Toast notification or increment unread counts
      }

      // Update previews in list
      if (isGroup) {
        setGroups(prev => prev.map(g => g.id === msg.groupId ? { ...g, lastMessage: msg } : g));
      } else {
        setFriends(prev => prev.map(f => f.id === msg.senderId || f.id === msg.receiverId ? { ...f, lastMessage: msg } : f));
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
    };

    // D: Read status sync (blue double checkmarks!)
    const handleMessagesRead = ({ chatId, readerId }) => {
      setMessages(prev => prev.map(m => m.chatId === chatId && m.senderId === user.id ? { ...m, status: 'read' } : m));
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
      receiveSound.current.cloneNode(true).play().catch(() => {});
      loadFriends();
    };

    const handleFriendAccept = ({ friend }) => {
      receiveSound.current.cloneNode(true).play().catch(() => {});
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
      receiveSound.current.cloneNode(true).play().catch(() => {});
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

    socket.on('new_message', handleNewMessage);
    socket.on('user_typing', handleUserTyping);
    socket.on('message_status_update', handleMessageStatusUpdate);
    socket.on('messages_read', handleMessagesRead);
    socket.on('user_status_change', handleUserStatusChange);
    socket.on('friend_request', handleFriendRequest);
    socket.on('friend_accept', handleFriendAccept);
    socket.on('friend_decline', handleFriendDecline);
    socket.on('added_to_group', handleAddedToGroup);
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
    editMessage,
    deleteMessage,
    pinMessage,
    reactMessage,
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
