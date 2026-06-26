import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, Users, Sparkles, Settings, LogOut, Search, 
  UserPlus, Check, X, Camera, Plus, PlusCircle, Trash2, Users2, ChevronRight, User,
  Shield, ShieldAlert, Sun, Moon, ArrowLeft, Key, Send
} from 'lucide-react';

const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

function Sidebar() {
  const { user, logout, updateProfile, apiFetch, setIsAdminPortalOpen, updateSecuritySettings, theme, toggleTheme, deleteAccount, handleResponse } = useAuth();
  const { 
    friends, groups, activeChat, selectChat, stories, postStory, viewStory,
    respondFriendRequest, createGroup, leaveGroup
  } = useChat();

  const [activeTab, setActiveTab] = useState('chats'); // 'chats', 'friends', 'stories', 'settings'
  const [settingsSubTab, setSettingsSubTab] = useState(null); // null, 'profile', 'account'

  // Reset settings sub-tab when active tab changes
  useEffect(() => {
    if (activeTab !== 'settings') {
      setSettingsSubTab(null);
    }
  }, [activeTab]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals / Drawers states
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  
  // User Search State
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Group creation wizard state
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [selectedGroupMembers, setSelectedGroupMembers] = useState([]);
  const [groupAvatarFile, setGroupAvatarFile] = useState(null);
  const [groupAvatarPreview, setGroupAvatarPreview] = useState(null);

  // Profile Edit State
  const [editName, setEditName] = useState(user?.displayName || '');
  const [editBio, setEditBio] = useState(user?.bio || '');
  const [editAvatarFile, setEditAvatarFile] = useState(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState(user?.avatarUrl || null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');

  // Security Credentials State
  const [securityPassword, setSecurityPassword] = useState('');
  const [security2fa, setSecurity2fa] = useState(!!user?.twoFactorEnabled);
  const [securitySaving, setSecuritySaving] = useState(false);
  const [securityMessage, setSecurityMessage] = useState('');

  // Sync edit states when user profile updates in background
  useEffect(() => {
    if (user) {
      setEditName(user.displayName || '');
      setEditBio(user.bio || '');
      setEditAvatarPreview(user.avatarUrl || null);
      setSecurity2fa(!!user.twoFactorEnabled);
    }
  }, [user]);

  // Status Post State
  const [statusFile, setStatusFile] = useState(null);
  const [statusCaption, setStatusCaption] = useState('');
  const [postingStatus, setPostingStatus] = useState(false);

  // Immersive Status Viewer state
  const [activeStatusViewer, setActiveStatusViewer] = useState(null); // feed object

  if (!user) return null;

  // --- Profile Edits ---
  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMessage('');
    try {
      await updateProfile(editName, editBio, editAvatarFile);
      setProfileMessage('Profile updated successfully.');
      setTimeout(() => setProfileMessage(''), 3000);
    } catch (err) {
      setProfileMessage(err.message || 'Update failed.');
    } finally {
      setProfileSaving(false);
    }
  };

  // --- Security Settings Update ---
  const handleSecuritySave = async (e) => {
    e.preventDefault();
    setSecuritySaving(true);
    setSecurityMessage('');
    try {
      const pwd = securityPassword.trim() ? securityPassword : undefined;
      await updateSecuritySettings(pwd, security2fa);
      setSecurityMessage('Security settings updated.');
      setSecurityPassword('');
      setTimeout(() => setSecurityMessage(''), 3000);
    } catch (err) {
      setSecurityMessage(err.message || 'Failed to update security settings.');
    } finally {
      setSecuritySaving(false);
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setEditAvatarFile(file);
      setEditAvatarPreview(URL.createObjectURL(file));
    }
  };

  // --- Search Users & Send Request ---
  const handleUserSearch = async (e) => {
    e.preventDefault();
    if (!userSearchQuery.trim()) return;

    setSearchLoading(true);
    try {
      const response = await apiFetch(`/api/users/search?query=${encodeURIComponent(userSearchQuery.trim())}`);
      const data = await handleResponse(response);
      setUserSearchResults(data);
    } catch (err) {
      console.error(err);
    } finally {
      setSearchLoading(false);
    }
  };

  const sendRequest = async (friendId) => {
    try {
      const response = await apiFetch('/api/users/friends/request', {
        method: 'POST',
        body: JSON.stringify({ friendId })
      });
      if (response.ok) {
        // Update local search results state
        setUserSearchResults(prev => prev.map(u => u.id === friendId ? { ...u, friendshipStatus: 'pending_sent' } : u));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // --- Group Creation ---
  const handleGroupAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setGroupAvatarFile(file);
      setGroupAvatarPreview(URL.createObjectURL(file));
    }
  };

  const toggleGroupMemberSelection = (friendId) => {
    setSelectedGroupMembers(prev => 
      prev.includes(friendId) ? prev.filter(id => id !== friendId) : [...prev, friendId]
    );
  };

  const handleCreateGroupSubmit = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) return;

    try {
      await createGroup(groupName.trim(), groupDesc.trim(), selectedGroupMembers, groupAvatarFile);
      // Reset
      setGroupName('');
      setGroupDesc('');
      setSelectedGroupMembers([]);
      setGroupAvatarFile(null);
      setGroupAvatarPreview(null);
      setShowCreateGroupModal(false);
    } catch (err) {
      alert(err.message || 'Failed to create group.');
    }
  };

  // --- Status Uploading ---
  const handleStatusUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const caption = prompt("Enter a status caption (optional):") || "";
    setPostingStatus(true);
    try {
      await postStory(file, caption);
    } catch (err) {
      alert(err.message || 'Failed to upload status.');
    } finally {
      setPostingStatus(false);
    }
  };

  // --- Helper Date Formatter ---
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Filters for Chat/Friends
  const filteredFriends = friends.filter(f => 
    f.friendshipStatus === 'accepted' && 
    (f.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || 
     f.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredGroups = groups.filter(g => 
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pendingReceivedRequests = friends.filter(f => f.friendshipStatus === 'pending_received');

  return (
    <div className="h-full w-full flex flex-col bg-zinc-900/40 text-zinc-100 font-sans select-none border-r border-zinc-800/80 relative">
      
      {/* 1. TOP PROFILE HEADER */}
      <div className="p-4 flex items-center justify-between border-b border-zinc-800/50">
        <div className="flex items-center gap-3">
          <div className="relative group cursor-pointer" onClick={() => setActiveTab('settings')}>
            {user?.avatarUrl ? (
              <img 
                src={user.avatarUrl} 
                alt="Me" 
                className="h-10 w-10 rounded-full object-cover border border-zinc-800 hover:border-emerald-500 transition duration-300"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-zinc-800 flex items-center justify-center font-bold text-emerald-400 uppercase text-sm hover:border-emerald-500 transition duration-300">
                {getInitials(user?.displayName)}
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition duration-200">
              <Camera className="h-4 w-4 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white leading-tight">{user?.displayName}</h1>
            <span className="text-[11px] text-zinc-400 flex items-center gap-1">
              <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full"></span> Active Session
            </span>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1.5">
          <button 
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            onClick={toggleTheme}
            className="p-2 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800/50 rounded-xl transition duration-200"
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <button 
            title="Add Friend"
            onClick={() => {
              setShowSearchModal(true);
              setUserSearchQuery('');
              setUserSearchResults([]);
            }}
            className="p-2 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800/50 rounded-xl transition duration-200"
          >
            <UserPlus className="h-5 w-5" />
          </button>
          <button 
            title="Create Group"
            onClick={() => setShowCreateGroupModal(true)}
            className="p-2 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800/50 rounded-xl transition duration-200"
          >
            <PlusCircle className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* 2. SEARCH / FILTER BAR */}
      {activeTab !== 'settings' && (
        <div className="p-3">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${activeTab}...`}
              className="block w-full pl-9 pr-4 py-2 bg-zinc-950 border border-zinc-800/60 rounded-xl text-zinc-200 placeholder-zinc-500 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition duration-200"
            />
          </div>
        </div>
      )}

      {/* 3. CORE SUB-VIEW CONTENTS */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          
          {/* CHATS TAB */}
          {activeTab === 'chats' && (
            <motion.div 
              key="chats-tab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="divide-y divide-zinc-800/30"
            >
              {/* Groups listing */}
              {filteredGroups.map(group => {
                const isSelected = activeChat && activeChat.groupId && activeChat.id === group.id;
                return (
                  <div 
                    key={group.id}
                    onClick={() => selectChat(group)}
                    className={`p-3.5 flex items-center justify-between cursor-pointer transition duration-200 hover:bg-zinc-800/30 ${isSelected ? 'bg-zinc-800/40 border-l-2 border-emerald-500' : ''}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {group.avatarUrl ? (
                        <img src={group.avatarUrl} alt={group.name} className="h-11 w-11 rounded-full object-cover border border-zinc-850" />
                      ) : (
                        <div className="h-11 w-11 rounded-full bg-gradient-to-tr from-blue-500/20 to-indigo-500/20 border border-zinc-850 flex items-center justify-center text-blue-400 font-bold text-sm">
                          <Users2 className="h-5 w-5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <h2 className="text-xs font-semibold text-white truncate">{group.name}</h2>
                        <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                          {group.lastMessage 
                            ? `${group.lastMessage.senderName}: ${group.lastMessage.type === 'text' ? group.lastMessage.content : `📁 [${group.lastMessage.type}]`}`
                            : 'No messages yet'
                          }
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0 ml-2">
                      <span className="text-[9px] text-zinc-500 font-medium">
                        {group.lastMessage ? formatTime(group.lastMessage.createdAt) : formatTime(group.createdAt)}
                      </span>
                      <span className="text-[9px] text-emerald-400 border border-emerald-500/20 bg-emerald-500/5 px-1.5 py-0.5 rounded-full mt-1.5 uppercase tracking-wider font-semibold">
                        Group
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Friends (Direct message chats) listing */}
              {filteredFriends.map(friend => {
                const isSelected = activeChat && !activeChat.groupId && activeChat.id === friend.id;
                const isOnline = friend.status === 'online';
                
                return (
                  <div 
                    key={friend.id}
                    onClick={() => selectChat(friend)}
                    className={`p-3.5 flex items-center justify-between cursor-pointer transition duration-200 hover:bg-zinc-800/30 ${isSelected ? 'bg-zinc-800/40 border-l-2 border-emerald-500' : ''}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative">
                        {friend.avatarUrl ? (
                          <img src={friend.avatarUrl} alt={friend.displayName} className="h-11 w-11 rounded-full object-cover border border-zinc-850" />
                        ) : (
                          <div className="h-11 w-11 rounded-full bg-gradient-to-tr from-zinc-800 to-zinc-700 border border-zinc-850 flex items-center justify-center text-zinc-300 font-bold text-xs uppercase">
                            {getInitials(friend.displayName)}
                          </div>
                        )}
                        {isOnline && (
                          <span className="absolute bottom-0 right-0 h-3 w-3 bg-emerald-500 border-2 border-zinc-900 rounded-full"></span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-xs font-semibold text-white truncate">{friend.displayName}</h2>
                        <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                          {friend.lastMessage 
                            ? (friend.lastMessage.type === 'text' ? friend.lastMessage.content : `📁 [${friend.lastMessage.type}]`)
                            : friend.bio || 'Available'
                          }
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0 ml-2">
                      <span className="text-[9px] text-zinc-500 font-medium">
                        {friend.lastMessage ? formatTime(friend.lastMessage.createdAt) : ''}
                      </span>
                      {friend.lastMessage && friend.lastMessage.senderId === user.id && (
                        <div className="mt-1.5">
                          {friend.lastMessage.status === 'sent' && <span className="text-zinc-500">✓</span>}
                          {friend.lastMessage.status === 'delivered' && <span className="text-zinc-400">✓✓</span>}
                          {friend.lastMessage.status === 'read' && <span className="text-emerald-400 font-bold">✓✓</span>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {filteredFriends.length === 0 && filteredGroups.length === 0 && (
                <div className="p-8 text-center text-zinc-500 text-xs">
                  No active chats. Use the top icons to add friends or create group chats!
                </div>
              )}
            </motion.div>
          )}

          {/* FRIENDS TAB */}
          {activeTab === 'friends' && (
            <motion.div 
              key="friends-tab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4 space-y-4"
            >
              {/* 1. Pending received requests */}
              {pendingReceivedRequests.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-[10px] uppercase font-bold tracking-wider text-amber-400">Pending Requests ({pendingReceivedRequests.length})</h3>
                  <div className="space-y-1.5">
                    {pendingReceivedRequests.map(reqUser => (
                      <div key={reqUser.id} className="p-3 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {reqUser.avatarUrl ? (
                            <img src={reqUser.avatarUrl} alt={reqUser.displayName} className="h-8 w-8 rounded-full object-cover" />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-300 uppercase">
                              {getInitials(reqUser.displayName)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <h4 className="text-xs font-semibold text-white truncate leading-tight">{reqUser.displayName}</h4>
                            <span className="text-[9px] text-zinc-400 truncate block mt-0.5">{reqUser.email}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => respondFriendRequest(reqUser.id, true)}
                            className="p-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-lg transition"
                            title="Accept"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button 
                            onClick={() => respondFriendRequest(reqUser.id, false)}
                            className="p-1.5 bg-zinc-850 hover:bg-zinc-800 text-red-400 rounded-lg border border-zinc-800 transition"
                            title="Decline"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. Symmetrical Friends listing */}
              <div className="space-y-2">
                <h3 className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">All Friends ({filteredFriends.length})</h3>
                <div className="space-y-1">
                  {filteredFriends.map(friend => (
                    <div 
                      key={friend.id}
                      onClick={() => selectChat(friend)}
                      className="p-3 rounded-2xl bg-zinc-950/20 border border-zinc-900 flex items-center justify-between hover:bg-zinc-800/10 cursor-pointer transition group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pointer-events-none select-none">
                        <div className="relative">
                          {friend.avatarUrl ? (
                            <img src={friend.avatarUrl} alt={friend.displayName} className="h-9 w-9 rounded-full object-cover" />
                          ) : (
                            <div className="h-9 w-9 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-300 uppercase">
                              {getInitials(friend.displayName)}
                            </div>
                          )}
                          {friend.status === 'online' && (
                            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-emerald-500 border-2 border-zinc-900 rounded-full"></span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-semibold text-white truncate leading-tight">{friend.displayName}</h4>
                          <p className="text-[10px] text-zinc-400 truncate mt-0.5">{friend.bio || 'No bio status'}</p>
                        </div>
                      </div>
                      
                      <div 
                        className="p-1.5 text-zinc-500 group-hover:text-emerald-400 bg-zinc-900 border border-zinc-850 rounded-lg opacity-60 group-hover:opacity-100 transition duration-200 flex-shrink-0"
                        title="Chat now"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </div>
                    </div>
                  ))}

                  {filteredFriends.length === 0 && (
                    <div className="p-8 text-center text-zinc-600 text-xs">
                      No friends matching search.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* STATUS STORIES TAB */}
          {activeTab === 'stories' && (
            <motion.div 
              key="stories-tab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4 space-y-4"
            >
              {/* My status card */}
              <div className="space-y-2">
                <h3 className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">My Status</h3>
                
                <div className="p-3 rounded-2xl bg-zinc-950/20 border border-zinc-900 flex items-center justify-between">
                  <div 
                    className="flex items-center gap-3 cursor-pointer" 
                    onClick={() => {
                      if (stories.myStories) {
                        setActiveStatusViewer(stories.myStories);
                      }
                    }}
                  >
                    <div className="relative">
                      {user.avatarUrl ? (
                        <img 
                          src={user.avatarUrl} 
                          alt="Me" 
                          className={`h-11 w-11 rounded-full object-cover p-[2px] border-2 ${stories.myStories ? 'border-emerald-500' : 'border-zinc-700'}`} 
                        />
                      ) : (
                        <div className={`h-11 w-11 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-xs uppercase border-2 ${stories.myStories ? 'border-emerald-500' : 'border-zinc-700'}`}>
                          {getInitials(user.displayName)}
                        </div>
                      )}
                      
                      {/* Plus icon to upload */}
                      <label htmlFor="status-upload-input" className="absolute bottom-0 right-0 h-5 w-5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-full border border-zinc-900 flex items-center justify-center cursor-pointer shadow-md transition duration-200">
                        <Plus className="h-3 w-3" />
                        <input 
                          type="file" 
                          id="status-upload-input"
                          className="hidden" 
                          accept="image/*,video/*"
                          onChange={handleStatusUpload}
                          disabled={postingStatus}
                        />
                      </label>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-white">My Status</h4>
                      <p className="text-[10px] text-zinc-400 mt-0.5">
                        {stories.myStories 
                          ? `${stories.myStories.stories.length} updates posted`
                          : 'Tap "+" to share a 24h status'
                        }
                      </p>
                    </div>
                  </div>

                  {postingStatus && (
                    <div className="h-4 w-4 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                  )}
                </div>
              </div>

              {/* Friends statuses */}
              <div className="space-y-2">
                <h3 className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">Friends' Statuses ({stories.friendsStories.length})</h3>
                <div className="space-y-2">
                  {stories.friendsStories.map(feed => {
                    const allViewed = feed.stories.every(s => s.viewed);
                    const borderClass = allViewed ? 'border-zinc-700' : 'border-emerald-500';
                    
                    return (
                      <div 
                        key={feed.userId}
                        onClick={() => {
                          // Find first unviewed story, or fallback to first story
                          const firstUnviewed = feed.stories.find(s => !s.viewed) || feed.stories[0];
                          // Set up a custom full-screen visual viewer
                          setActiveStatusViewer(feed);
                        }}
                        className="p-3 rounded-2xl bg-zinc-950/20 border border-zinc-900 hover:bg-zinc-800/10 cursor-pointer flex items-center gap-3 transition"
                      >
                        <div className="relative">
                          {feed.avatarUrl ? (
                            <img 
                              src={feed.avatarUrl} 
                              alt={feed.displayName} 
                              className={`h-11 w-11 rounded-full object-cover p-[2px] border-2 ${borderClass}`} 
                            />
                          ) : (
                            <div className={`h-11 w-11 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-xs uppercase border-2 ${borderClass}`}>
                              {getInitials(feed.displayName)}
                            </div>
                          )}
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-white">{feed.displayName}</h4>
                          <p className="text-[10px] text-zinc-400 mt-0.5">
                            {formatTime(feed.stories[feed.stories.length - 1].createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })}

                  {stories.friendsStories.length === 0 && (
                    <div className="p-8 text-center text-zinc-600 text-xs">
                      No status updates from friends yet.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* SETTINGS TAB */}
          {/* SETTINGS TAB */}
          {activeTab === 'settings' && (
            <motion.div 
              key="settings-tab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4 overflow-y-auto max-h-[calc(100vh-120px)] custom-scrollbar"
            >
              {settingsSubTab === null && (
                <div className="space-y-6">
                  {/* User Profile Header Summary */}
                  <div className="flex items-center gap-4 p-4 bg-zinc-900/40 border border-zinc-800/60 rounded-2xl">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.displayName} className="h-12 w-12 rounded-full object-cover border border-zinc-700/50" />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center font-bold text-emerald-400 text-lg uppercase">
                        {getInitials(user.displayName)}
                      </div>
                    )}
                    <div className="min-w-0 text-left">
                      <h3 className="text-sm font-bold text-white truncate leading-snug">{user.displayName}</h3>
                      <p className="text-[10px] text-zinc-500 truncate mt-0.5">{user.bio || "No status set"}</p>
                    </div>
                  </div>

                  {/* Settings Menu Options List */}
                  <div className="flex flex-col bg-zinc-900/30 border border-zinc-800/40 rounded-2xl divide-y divide-zinc-800/30 overflow-hidden">
                    {/* Option 1: Profile */}
                    <button
                      type="button"
                      onClick={() => setSettingsSubTab('profile')}
                      className="flex items-center justify-between p-4 hover:bg-zinc-800/30 transition text-left group"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
                          <User className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-zinc-200 block">Profile</span>
                          <span className="text-[9px] text-zinc-500 block mt-0.5">Name, status, profile photo</span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-zinc-500 group-hover:text-zinc-300 transition" />
                    </button>

                    {/* Option 2: Account */}
                    <button
                      type="button"
                      onClick={() => setSettingsSubTab('account')}
                      className="flex items-center justify-between p-4 hover:bg-zinc-800/30 transition text-left group"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="p-2 bg-sky-500/10 text-sky-400 rounded-xl">
                          <Key className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-zinc-200 block">Account</span>
                          <span className="text-[9px] text-zinc-500 block mt-0.5">Security, 2FA, delete profile</span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-zinc-500 group-hover:text-zinc-300 transition" />
                    </button>

                    {/* Option 3: Logout */}
                    <button
                      type="button"
                      onClick={logout}
                      className="flex items-center justify-between p-4 hover:bg-zinc-850/20 transition text-left group"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="p-2 bg-red-500/10 text-red-400 rounded-xl">
                          <LogOut className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-red-400 block">Logout</span>
                          <span className="text-[9px] text-zinc-500 block mt-0.5">Sign out of this device</span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-zinc-500 group-hover:text-zinc-300 transition" />
                    </button>
                  </div>

                  {/* Administrative Tools Portal Section - Strictly secured to verified admins */}
                  {user?.role === 'admin' && (
                    <div className="pt-2 space-y-3">
                      <div className="flex items-center gap-2 px-1">
                        <Shield className="h-4 w-4 text-purple-400" />
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">Administrative Tools</h4>
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => setIsAdminPortalOpen(true)}
                        className="w-full py-3 px-4 bg-purple-600/10 hover:bg-purple-600/20 border border-purple-500/20 hover:border-purple-500/40 text-purple-350 hover:text-purple-300 font-bold rounded-2xl transition duration-200 text-xs flex items-center justify-center gap-2 shadow-lg"
                      >
                        <ShieldAlert className="h-4 w-4" />
                        Enter Admin Dashboard
                      </button>
                    </div>
                  )}
                </div>
              )}

              {settingsSubTab === 'profile' && (
                <div className="space-y-4">
                  {/* Back button header */}
                  <button
                    type="button"
                    onClick={() => setSettingsSubTab(null)}
                    className="flex items-center gap-2 text-zinc-400 hover:text-white transition text-xs font-semibold mb-4 bg-zinc-900/40 px-3 py-1.5 rounded-lg border border-zinc-800/65"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Back to Settings</span>
                  </button>

                  <form onSubmit={handleProfileSave} className="space-y-4">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-2">Edit Profile</h3>
                    
                    {/* Avatar uploader */}
                    <div className="flex flex-col items-center justify-center py-2">
                      <div className="relative group cursor-pointer">
                        {editAvatarPreview ? (
                          <img src={editAvatarPreview} alt="Preview" className="h-20 w-20 rounded-full object-cover border-2 border-zinc-800" />
                        ) : (
                          <div className="h-20 w-20 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-white text-xl uppercase">
                            {getInitials(user.displayName)}
                          </div>
                        )}
                        <label htmlFor="avatar-file-input" className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition duration-200 cursor-pointer">
                          <Camera className="h-6 w-6 text-white" />
                          <input 
                            type="file" 
                            id="avatar-file-input" 
                            className="hidden" 
                            accept="image/*"
                            onChange={handleAvatarChange}
                          />
                        </label>
                      </div>
                      <span className="text-[10px] text-zinc-500 mt-2">Click photo to upload new</span>
                    </div>

                    {/* Profile form inputs */}
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1">Display Name</label>
                        <input
                          type="text"
                          required
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="block w-full px-3 py-2 bg-zinc-950 border border-zinc-800/80 rounded-xl text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition duration-200"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1">Bio / Status</label>
                        <textarea
                          value={editBio}
                          onChange={(e) => setEditBio(e.target.value)}
                          rows={3}
                          className="block w-full px-3 py-2 bg-zinc-950 border border-zinc-800/80 rounded-xl text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition duration-200 resize-none"
                        />
                      </div>
                    </div>

                    {profileMessage && (
                      <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-[10px] text-zinc-300 text-center font-medium">
                        {profileMessage}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={profileSaving}
                      className="w-full py-2.5 px-4 bg-white hover:bg-zinc-200 text-zinc-950 font-bold rounded-xl shadow transition duration-200 text-xs flex items-center justify-center"
                    >
                      {profileSaving ? 'Saving Updates...' : 'Save Changes'}
                    </button>
                  </form>
                </div>
              )}

              {settingsSubTab === 'account' && (
                <div className="space-y-6">
                  {/* Back button header */}
                  <button
                    type="button"
                    onClick={() => setSettingsSubTab(null)}
                    className="flex items-center gap-2 text-zinc-400 hover:text-white transition text-xs font-semibold mb-4 bg-zinc-900/40 px-3 py-1.5 rounded-lg border border-zinc-800/65"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Back to Settings</span>
                  </button>

                  {/* Security form */}
                  <form onSubmit={handleSecuritySave} className="space-y-4">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">Security & Credentials</h4>
                    
                    {/* Two-Factor Authentication (2FA) Toggle */}
                    <div className="flex items-center justify-between p-3.5 bg-zinc-950/40 border border-zinc-800/45 rounded-2xl">
                      <div className="flex flex-col pr-2">
                        <span className="text-xs font-semibold text-white">Two-Factor Auth (2FA)</span>
                        <span className="text-[10px] text-zinc-400 mt-0.5 leading-relaxed">Requires OTP verification sent to email upon login.</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                        <input 
                          type="checkbox" 
                          checked={security2fa}
                          onChange={(e) => setSecurity2fa(e.target.checked)}
                          className="sr-only peer" 
                        />
                        <div className="w-9 h-5 bg-zinc-800 rounded-full peer peer-focus:ring-1 peer-focus:ring-emerald-500/40 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-zinc-400 peer-checked:after:bg-zinc-950 after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 transition-colors duration-200"></div>
                      </label>
                    </div>

                    {/* Password Configuration */}
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1">
                          {user?.hasPassword ? 'Change Password' : 'Create login password'}
                        </label>
                        <input
                          type="password"
                          value={securityPassword}
                          onChange={(e) => setSecurityPassword(e.target.value)}
                          placeholder={user?.hasPassword ? 'Enter new password...' : 'Choose a password...'}
                          className="block w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800/80 rounded-xl text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition duration-200"
                        />
                        <p className="text-[9px] text-zinc-500 mt-1">
                          {user?.hasPassword 
                            ? 'Update credentials to authenticate via password.' 
                            : 'Configure a password to sign in via password next time.'
                          }
                        </p>
                      </div>
                    </div>

                    {securityMessage && (
                      <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-[10px] text-zinc-300 text-center font-medium">
                        {securityMessage}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={securitySaving}
                      className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-xl shadow transition duration-200 text-xs flex items-center justify-center"
                    >
                      {securitySaving ? 'Updating Security...' : 'Update Security'}
                    </button>
                  </form>

                  {/* Account Deletion (Danger Zone) - Regular users only */}
                  {user?.role !== 'admin' && (
                    <div className="pt-6 border-t border-zinc-800/50 space-y-4">
                      <h4 className="text-xs font-bold text-red-500 uppercase tracking-wider mb-2">Danger Zone</h4>
                      <p className="text-[10px] text-zinc-400 leading-relaxed">
                        Permanently delete your profile, messages, friendships, and all associated chat history. This action is completely irreversible.
                      </p>
                      
                      <button
                        type="button"
                        onClick={async () => {
                          const confirmFirst = confirm('WARNING: Are you sure you want to permanently delete your account? This will erase all your messages, profile details, and friendships.');
                          if (confirmFirst) {
                            const confirmSecond = confirm('FINAL CONFIRMATION: This action is completely irreversible. Are you absolutely certain?');
                            if (confirmSecond) {
                              try {
                                await deleteAccount();
                              } catch (err) {
                                alert(err.message || 'Failed to delete account.');
                              }
                            }
                          }
                        }}
                        className="w-full py-3 px-4 bg-red-600/10 hover:bg-red-600/20 border border-red-500/20 hover:border-red-500/40 text-red-400 hover:text-red-300 font-bold rounded-2xl transition duration-200 text-xs flex items-center justify-center gap-2 shadow-lg"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete Profile & Account
                      </button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 4. FOOTER TAB SELECTOR */}
      <div className="px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-zinc-900/60 border-t border-zinc-800/50 flex items-center justify-around">
        <button 
          onClick={() => setActiveTab('chats')}
          className={`flex flex-col items-center gap-1.5 text-[10px] font-medium transition ${activeTab === 'chats' ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <MessageSquare className="h-5 w-5" />
          <span>Chats</span>
        </button>
        <button 
          onClick={() => setActiveTab('stories')}
          className={`flex flex-col items-center gap-1.5 text-[10px] font-medium transition ${activeTab === 'stories' ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <Sparkles className="h-5 w-5" />
          <span>Status</span>
        </button>
        <button 
          onClick={() => setActiveTab('friends')}
          className={`flex flex-col items-center gap-1.5 text-[10px] font-medium transition ${activeTab === 'friends' ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <Users className="h-5 w-5" />
          <span>Friends</span>
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center gap-1.5 text-[10px] font-medium transition ${activeTab === 'settings' ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <Settings className="h-5 w-5" />
          <span>Settings</span>
        </button>
      </div>

      {/* ================= MODAL WINDOWS ================= */}

      {/* MODAL A: SEARCH USERS & ADD FRIEND */}
      <AnimatePresence>
        {showSearchModal && (
          <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm z-30 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm p-6 bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl relative"
            >
              <button 
                onClick={() => setShowSearchModal(false)}
                className="absolute top-4 right-4 p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
              >
                <X className="h-4 w-4" />
              </button>
              
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-emerald-400" /> Discover People
              </h3>

              <form onSubmit={handleUserSearch} className="flex gap-2 mb-4">
                <input
                  type="text"
                  required
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder="Search by email or name..."
                  className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  type="submit"
                  disabled={searchLoading}
                  className="px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-xl text-xs transition"
                >
                  Search
                </button>
              </form>

              <div className="max-h-60 overflow-y-auto space-y-2">
                {searchLoading ? (
                  <div className="text-center py-6 text-zinc-500 text-xs loader-pulse">Querying database...</div>
                ) : userSearchResults.map(result => (
                  <div key={result.id} className="p-3 rounded-2xl bg-zinc-950/40 border border-zinc-850 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {result.avatarUrl ? (
                        <img src={result.avatarUrl} alt={result.displayName} className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-300 uppercase">
                          {getInitials(result.displayName)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h4 className="text-xs font-semibold text-white truncate leading-tight">{result.displayName}</h4>
                        <span className="text-[9px] text-zinc-500 block truncate">{result.email}</span>
                      </div>
                    </div>

                    {result.friendshipStatus === 'none' && (
                      <button
                        onClick={() => sendRequest(result.id)}
                        className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 rounded-lg text-[10px] font-bold transition"
                      >
                        Add Friend
                      </button>
                    )}
                    {result.friendshipStatus === 'pending_sent' && (
                      <span className="text-[10px] text-zinc-500 font-medium italic">Sent</span>
                    )}
                    {result.friendshipStatus === 'pending_received' && (
                      <span className="text-[10px] text-amber-400 font-medium italic">Pending</span>
                    )}
                    {result.friendshipStatus === 'accepted' && (
                      <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                        <Check className="h-3 w-3" /> Friends
                      </span>
                    )}
                  </div>
                ))}
                
                {!searchLoading && userSearchResults.length === 0 && userSearchQuery && (
                  <div className="text-center py-6 text-zinc-500 text-xs">No users found.</div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL B: CREATE GROUP CHAT */}
      <AnimatePresence>
        {showCreateGroupModal && (
          <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm z-30 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm p-6 bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl relative"
            >
              <button 
                onClick={() => setShowCreateGroupModal(false)}
                className="absolute top-4 right-4 p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
              >
                <X className="h-4 w-4" />
              </button>
              
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Users2 className="h-5 w-5 text-emerald-400" /> New Group Chat
              </h3>

              <form onSubmit={handleCreateGroupSubmit} className="space-y-4">
                
                {/* Group Avatar upload */}
                <div className="flex flex-col items-center justify-center py-1">
                  <div className="relative group cursor-pointer">
                    {groupAvatarPreview ? (
                      <img src={groupAvatarPreview} alt="Group" className="h-14 w-14 rounded-full object-cover border border-zinc-855" />
                    ) : (
                      <div className="h-14 w-14 rounded-full bg-zinc-850 flex items-center justify-center border border-zinc-800">
                        <Camera className="h-5 w-5 text-zinc-500" />
                      </div>
                    )}
                    <label htmlFor="group-avatar-input" className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition cursor-pointer">
                      <Plus className="h-4 w-4 text-white" />
                      <input 
                        type="file" 
                        id="group-avatar-input" 
                        className="hidden" 
                        accept="image/*"
                        onChange={handleGroupAvatarChange}
                      />
                    </label>
                  </div>
                  <span className="text-[9px] text-zinc-500 mt-1">Group Photo</span>
                </div>

                <div className="space-y-3">
                  <input
                    type="text"
                    required
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Group Name *"
                    className="block w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <input
                    type="text"
                    value={groupDesc}
                    onChange={(e) => setGroupDesc(e.target.value)}
                    placeholder="Group Description (optional)..."
                    className="block w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* Add Friends checkboxes */}
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">Select Members</span>
                  <div className="max-h-36 overflow-y-auto border border-zinc-800/50 rounded-xl p-2 space-y-1 bg-zinc-950/40">
                    {friends.filter(f => f.friendshipStatus === 'accepted').map(friend => {
                      const isChecked = selectedGroupMembers.includes(friend.id);
                      return (
                        <div 
                          key={friend.id} 
                          onClick={() => toggleGroupMemberSelection(friend.id)}
                          className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-zinc-800/40 cursor-pointer text-left"
                        >
                          <input 
                            type="checkbox" 
                            checked={isChecked}
                            readOnly
                            className="accent-emerald-500 h-3.5 w-3.5" 
                          />
                          <span className="text-xs font-medium text-zinc-300">{friend.displayName}</span>
                        </div>
                      );
                    })}

                    {friends.filter(f => f.friendshipStatus === 'accepted').length === 0 && (
                      <div className="text-center py-4 text-zinc-600 text-[10px]">No friends available to add.</div>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-xl text-xs shadow transition"
                >
                  Create Group Chat
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= IMMERSIVE STATUS VIEWER OVERLAY ================= */}
      {activeStatusViewer && (
        <StatusViewer 
          feed={activeStatusViewer} 
          onClose={() => {
            setActiveStatusViewer(null);
            loadStories(); // reload feeds to sync viewed status checkmarks
          }} 
          viewStory={viewStory}
        />
      )}

    </div>
  );
}

// ================= SUB-COMPONENT: FULLSCREEN IMMERSIVE STATUS VIEWER =================
function StatusViewer({ feed, onClose, viewStory }) {
  const { user } = useAuth();
  const { sendStatusReply } = useChat();
  
  const initialIndex = feed.stories.findIndex(s => !s.viewed);
  const [currentIndex, setCurrentIndex] = useState(initialIndex !== -1 ? initialIndex : 0);
  const currentStory = feed.stories[currentIndex];
  const progressTimer = useRef(null);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);
  
  const [replyText, setReplyText] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [toast, setToast] = useState('');

  const handleNext = useCallback(() => {
    if (currentIndex < feed.stories.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      onClose();
    }
  }, [currentIndex, feed.stories.length, onClose]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  // Reset progress on story change
  useEffect(() => {
    setProgress(0);
    progressRef.current = 0;
  }, [currentIndex]);

  // Keep progressRef in sync with state
  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  // Record view immediately on render of an unviewed story
  useEffect(() => {
    if (currentStory && !currentStory.viewed) {
      viewStory(currentStory.id, feed.userId);
    }
  }, [currentIndex, currentStory, feed.userId, viewStory]);

  // Handle auto-advancing progress bar (5 seconds per story)
  useEffect(() => {
    if (isPaused) {
      if (progressTimer.current) clearInterval(progressTimer.current);
      return;
    }

    const duration = 5000; // 5s
    const step = 50; // ms
    const increments = duration / step;
    
    // Resume from the saved progress ref value
    let count = Math.round((progressRef.current / 100) * increments);

    progressTimer.current = setInterval(() => {
      count++;
      const currentProgress = (count / increments) * 100;
      setProgress(currentProgress);
      
      if (count >= increments) {
        clearInterval(progressTimer.current);
        handleNext();
      }
    }, step);

    return () => {
      if (progressTimer.current) clearInterval(progressTimer.current);
    };
  }, [currentIndex, handleNext, isPaused]);

  // Keyboard navigation for desktop experience
  useEffect(() => {
    const handleKeyDown = (e) => {
      // If user is focused on the reply input, ignore arrow keys / spacebar for story navigation
      if (document.activeElement?.tagName === 'INPUT') {
        if (e.key === 'Escape') {
          onClose();
        }
        return;
      }

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleNext, handlePrev, onClose]);

  if (!currentStory) return null;

  const isOwnStatus = feed.userId === user.id;

  const handleFocus = () => setIsPaused(true);
  const handleBlur = () => {
    if (!replyText.trim()) {
      setIsPaused(false);
    }
  };

  const submitReply = () => {
    if (!replyText.trim()) return;
    
    sendStatusReply(feed.userId, currentStory, replyText);
    setReplyText('');
    setToast('Reply sent');
    setIsPaused(true);
    
    setTimeout(() => {
      setToast('');
      onClose();
    }, 1500);
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[9999] flex flex-col justify-between select-none animate-fade-in">
      
      {/* Top Segmented Progress Bar & User details - Z-Index 40 so it sits above navigation triggers */}
      <div className="p-4 bg-gradient-to-b from-black/90 to-transparent z-40 w-full absolute top-0">
        
        {/* Segments progress bars row */}
        <div className="flex gap-1.5 w-full mb-3">
          {feed.stories.map((s, idx) => {
            let width = '0%';
            if (idx < currentIndex) width = '100%';
            else if (idx === currentIndex) width = `${progress}%`;
            
            return (
              <div key={s.id} className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-400 transition-all duration-75 ease-linear"
                  style={{ width }}
                ></div>
              </div>
            );
          })}
        </div>

        {/* User Details header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {feed.avatarUrl ? (
              <img src={feed.avatarUrl} alt={feed.displayName} className="h-9 w-9 rounded-full object-cover border border-zinc-800" />
            ) : (
              <div className="h-9 w-9 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-300 uppercase">
                {getInitials(feed.displayName)}
              </div>
            )}
            <div>
              <h4 className="text-xs font-bold text-white leading-tight">{feed.displayName}</h4>
              <span className="text-[10px] text-zinc-400 mt-0.5 block">
                {new Date(currentStory.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          {/* Prominent glassmorphic close button */}
          <button 
            onClick={onClose} 
            className="p-2 bg-white/5 hover:bg-white/15 border border-white/10 rounded-full text-zinc-300 hover:text-white transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg shadow-black/40"
            aria-label="Close status"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Main Interactive Media display area */}
      <div className="flex-1 flex items-center justify-center relative bg-black">
        
        {/* Click/Tap triggers on left/right halves - Z-Index 20 */}
        <div className="absolute top-0 bottom-0 left-0 w-1/2 z-20 cursor-pointer" onClick={handlePrev}></div>
        <div className="absolute top-0 bottom-0 right-0 w-1/2 z-20 cursor-pointer" onClick={handleNext}></div>

        <div className="relative max-w-full max-h-full md:max-w-[90vw] md:max-h-[85vh] flex items-center justify-center p-4">
          {currentStory.mediaType === 'video' ? (
            <video 
              src={currentStory.mediaUrl} 
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl transition-all duration-300 ease-in-out" 
              autoPlay 
              muted
              playsInline
            />
          ) : (
            <img 
              src={currentStory.mediaUrl} 
              alt="Status" 
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl pointer-events-none select-none transition-all duration-300 ease-in-out" 
            />
          )}
        </div>

        {/* Caption - Z-Index 30 so it sits above navigation triggers */}
        {currentStory.caption && (
          <div className={`absolute left-4 right-4 text-center z-30 ${isOwnStatus ? 'bottom-12' : 'bottom-20'}`}>
            <div className="inline-block px-5 py-3 rounded-2xl bg-black/75 backdrop-blur-md border border-white/10 max-w-[85%] text-xs text-white shadow-xl">
              {currentStory.caption}
            </div>
          </div>
        )}
      </div>

      {/* Reply Input Bar (only for friends' statuses) - Z-Index 40 */}
      {!isOwnStatus && (
        <div className="p-4 bg-gradient-to-t from-black/90 to-transparent z-40 w-full absolute bottom-0 flex items-center gap-3">
          <div className="flex-1 relative flex items-center">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submitReply();
                }
              }}
              placeholder="Reply to status..."
              className="w-full py-2.5 pl-4 pr-12 bg-white/10 hover:bg-white/15 focus:bg-white/15 border border-white/10 focus:border-emerald-500/50 rounded-2xl text-xs text-white placeholder-zinc-400 focus:outline-none backdrop-blur-md transition-all duration-200"
            />
            {replyText.trim() && (
              <button
                onClick={submitReply}
                className="absolute right-2 p-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-xl transition hover:scale-105 active:scale-95 shadow-md"
                title="Send reply"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Toast Feedback Banner */}
      {toast && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
          <div className="px-6 py-4 bg-zinc-900/90 border border-white/10 rounded-3xl flex flex-col items-center gap-2 shadow-2xl scale-in">
            <div className="h-12 w-12 rounded-full bg-emerald-500/20 border border-emerald-500 flex items-center justify-center text-emerald-400">
              <Check className="h-6 w-6" />
            </div>
            <span className="text-xs font-bold text-white">{toast}</span>
          </div>
        </div>
      )}

    </div>,
    document.body
  );
}

export default Sidebar;
