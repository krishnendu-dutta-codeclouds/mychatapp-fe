import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Users, MessageSquare, Activity, Server, UserX, UserCheck,
  Trash2, TrendingUp, Clock, ArrowLeft, Search, MessageCircle, X,
  FileText, RefreshCw, AlertTriangle, ShieldCheck, ShieldAlert
} from 'lucide-react';

const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export default function AdminDashboard({ onClose }) {
  const { apiFetch, user: currentUser, handleResponse } = useAuth();
  const { socket } = useChat();

  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'users', 'chats', 'logs'
  const [stats, setStats] = useState({
    totalUsers: 0,
    onlineUsers: 0,
    totalMessages: 0,
    totalGroups: 0,
    activeStories: 0,
    serverUptime: 0,
    dbConnected: false
  });
  
  const [users, setUsers] = useState([]);
  const [chats, setChats] = useState({ groups: [], directChats: [] });
  
  // Filtering & Selection
  const [userSearch, setUserSearch] = useState('');
  const [chatSearch, setChatSearch] = useState('');
  
  // Auditing
  const [selectedAuditChat, setSelectedAuditChat] = useState(null); // { id, name, isGroup }
  const [auditHistory, setAuditHistory] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null); // stores active userId or groupId being modified
  
  // System logs stream
  const [logs, setLogs] = useState([]);
  const logsEndRef = useRef(null);

  // Load Initial Data
  const fetchStats = async () => {
    try {
      const res = await apiFetch('/api/admin/stats');
      const data = await handleResponse(res);
      setStats(data);
    } catch (err) {
      console.error('Error fetching admin stats:', err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await apiFetch('/api/admin/users');
      const data = await handleResponse(res);
      setUsers(data);
    } catch (err) {
      console.error('Error fetching admin users:', err);
    }
  };

  const fetchChats = async () => {
    try {
      const res = await apiFetch('/api/admin/chats');
      const data = await handleResponse(res);
      setChats(data);
    } catch (err) {
      console.error('Error fetching admin chats:', err);
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchStats(), fetchUsers(), fetchChats()]);
      addLog('System', 'Fetched latest administrative directory archives.');
    } catch (err) {
      setError('Failed to sync administrative control panel data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Hook into sockets for real-time logs and live stats updates!
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg) => {
      // Update message counts in real-time
      setStats(prev => ({ ...prev, totalMessages: prev.totalMessages + 1 }));
      addLog('Message', `New transmission routed. Origin: User [${msg.senderId}], Room: [${msg.chatId}]`);
    };

    const handleStatusChange = (data) => {
      // Update online counts in real-time
      if (data.status === 'online') {
        setStats(prev => ({ ...prev, onlineUsers: Math.min(prev.totalUsers, prev.onlineUsers + 1) }));
        addLog('Status', `User [${data.userId}] established socket handshake. Status: ONLINE.`);
      } else {
        setStats(prev => ({ ...prev, onlineUsers: Math.max(0, prev.onlineUsers - 1) }));
        addLog('Status', `User [${data.userId}] closed socket connection. Status: OFFLINE.`);
      }
    };

    socket.on('new_message', handleNewMessage);
    socket.on('user_status_change', handleStatusChange);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('user_status_change', handleStatusChange);
    };
  }, [socket]);

  // Scroll logs to bottom
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  if (!currentUser) return null;

  // Helper to add system logs
  const addLog = (category, message) => {
    const newLog = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      category,
      message
    };
    setLogs(prev => [...prev.slice(-99), newLog]); // Cap at 100 logs
  };

  // --- Admin Moderation Actions ---
  
  const handleToggleBan = async (userId, displayName, currentBanState) => {
    setActionLoading(userId);
    try {
      const nextBanState = currentBanState === 1 ? 0 : 1;
      const res = await apiFetch(`/api/admin/users/${userId}/ban`, {
        method: 'PUT',
        body: JSON.stringify({ ban: nextBanState === 1 })
      });

      await handleResponse(res);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, isBanned: nextBanState, status: nextBanState === 1 ? 'offline' : u.status } : u));
      addLog('Moderation', `Banned status toggled for "${displayName}" [ID: ${userId}] -> ${nextBanState === 1 ? 'SUSPENDED' : 'ACTIVE'}.`);
      fetchStats(); // Update online users
    } catch (err) {
      console.error(err);
      alert(err.message || 'Network failure processing suspension.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleRole = async (userId, displayName, currentRole) => {
    setActionLoading(userId);
    try {
      const nextRole = currentRole === 'admin' ? 'user' : 'admin';
      const res = await apiFetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role: nextRole })
      });

      await handleResponse(res);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: nextRole } : u));
      addLog('Security', `Privilege adjustment: "${displayName}" updated to role [${nextRole.toUpperCase()}].`);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Network failure updating credentials.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async (userId, displayName) => {
    if (!confirm(`Are you absolutely sure you want to PERMANENTLY delete user "${displayName}"?\nThis deletes their profile, friendships, stories, and messages from the SQLite database. This action is irreversible.`)) {
      return;
    }

    setActionLoading(userId);
    try {
      const res = await apiFetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      await handleResponse(res);
      setUsers(prev => prev.filter(u => u.id !== userId));
      addLog('Moderation', `Deleted user account "${displayName}" [ID: ${userId}] permanently.`);
      loadAllData(); // Refresh everything
    } catch (err) {
      console.error(err);
      alert(err.message || 'Network failure purging user.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteGroup = async (groupId, groupName) => {
    if (!confirm(`Are you sure you want to delete the group "${groupName}"? This removes all memberships and messages in the channel.`)) {
      return;
    }

    setActionLoading(groupId);
    try {
      const res = await apiFetch(`/api/admin/chats/groups/${groupId}`, { method: 'DELETE' });
      await handleResponse(res);
      setChats(prev => ({
        ...prev,
        groups: prev.groups.filter(g => g.id !== groupId)
      }));
      addLog('Moderation', `Purged group channel "${groupName}" [ID: ${groupId}] from systems.`);
      fetchStats();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Network failure purging group.');
    } finally {
      setActionLoading(null);
    }
  };

  // --- Audit & Message History ---
  const handleOpenAudit = async (chatId, name, isGroup) => {
    setSelectedAuditChat({ id: chatId, name, isGroup });
    setAuditHistory([]);
    setAuditLoading(true);
    try {
      const res = await apiFetch(`/api/chat/history/${chatId}`);
      const data = await handleResponse(res);
      setAuditHistory(data);
      addLog('Audit', `Loaded historical archives for chat Room [${chatId}].`);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to retrieve chat history.');
    } finally {
      setAuditLoading(false);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!confirm('Permanently delete this message from the system archives?')) return;

    try {
      const res = await apiFetch(`/api/admin/messages/${messageId}`, { method: 'DELETE' });
      if (res.ok) {
        setAuditHistory(prev => prev.filter(m => m.id !== messageId));
        addLog('Moderation', `Deleted message ID [${messageId}] during active audit.`);
        fetchStats();
      } else {
        alert('Failed to delete message.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Filter Users List
  const filteredUsers = users.filter(u =>
    u.displayName?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.id?.toLowerCase().includes(userSearch.toLowerCase())
  );

  // Filter Chats List
  const filteredGroups = chats.groups.filter(g =>
    g.name?.toLowerCase().includes(chatSearch.toLowerCase())
  );
  const filteredDirects = chats.directChats.filter(d =>
    d.userAName?.toLowerCase().includes(chatSearch.toLowerCase()) ||
    d.userBName?.toLowerCase().includes(chatSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-zinc-950/95 backdrop-blur-2xl z-50 flex overflow-hidden text-zinc-100 font-sans">
      
      {/* LEFT NAVIGATION PANEL */}
      <div className="w-64 border-r border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md flex flex-col justify-between flex-shrink-0">
        <div>
          {/* Dashboard Title Header */}
          <div className="p-6 flex items-center gap-3 border-b border-zinc-800/60">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xs font-bold tracking-widest text-zinc-400 uppercase leading-none">Console</h1>
              <span className="text-[13px] font-bold text-white mt-1 block">Admin Portal</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition duration-200 ${
                activeTab === 'overview'
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/30 border border-transparent'
              }`}
            >
              <Activity className="h-4 w-4" />
              Overview
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition duration-200 ${
                activeTab === 'users'
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/30 border border-transparent'
              }`}
            >
              <Users className="h-4 w-4" />
              User Directory
            </button>
            <button
              onClick={() => setActiveTab('chats')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition duration-200 ${
                activeTab === 'chats'
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/30 border border-transparent'
              }`}
            >
              <MessageSquare className="h-4 w-4" />
              Chat Moderation
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition duration-200 ${
                activeTab === 'logs'
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/30 border border-transparent'
              }`}
            >
              <FileText className="h-4 w-4" />
              Real-Time Logs
            </button>
          </nav>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-zinc-800/60">
          <button
            onClick={onClose}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-zinc-800/40 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white rounded-xl text-xs font-semibold transition duration-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Exit Command Portal
          </button>
        </div>
      </div>

      {/* MAIN VIEWPORT */}
      <div className="flex-1 flex flex-col overflow-hidden bg-zinc-950">
        
        {/* Top Header Panel */}
        <header className="h-16 border-b border-zinc-800/60 flex items-center justify-between px-8 bg-zinc-900/20">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 bg-emerald-500 rounded-full animate-ping"></span>
            <h2 className="text-xs uppercase tracking-widest font-semibold text-zinc-400">
              System Gateway Online
            </h2>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={loadAllData}
              title="Refresh Data"
              className="p-2 text-zinc-400 hover:text-emerald-400 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl transition duration-200"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-xl text-xs">
              <span className="font-semibold text-zinc-400">Operator:</span>
              <span className="text-emerald-400 font-bold">{currentUser?.displayName}</span>
            </div>
          </div>
        </header>

        {/* Dynamic Content Container */}
        <main className="flex-1 overflow-y-auto p-8 relative">
          
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/80">
              <div className="h-12 w-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
              <span className="mt-4 text-xs font-semibold text-zinc-400 tracking-wider">Syncing control panel...</span>
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl bg-red-500/5 border border-red-500/15 text-center space-y-4 max-w-md mx-auto mt-16">
              <AlertTriangle className="h-10 w-10 text-red-400 mx-auto" />
              <h3 className="font-semibold text-white">Administrative Decoupling</h3>
              <p className="text-xs text-zinc-400">{error}</p>
              <button
                onClick={loadAllData}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-850 rounded-xl text-xs border border-zinc-800 font-bold"
              >
                Retry Security Verification
              </button>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              
              {/* OVERVIEW TAB */}
              {activeTab === 'overview' && (
                <motion.div
                  key="overview-panel"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  {/* Glowing metrics grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Card 1: Users */}
                    <div className="p-6 rounded-3xl bg-zinc-900/35 border border-zinc-800/80 backdrop-blur-md relative overflow-hidden group hover:border-blue-500/30 transition duration-300">
                      <div className="h-12 w-12 rounded-2xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-400 mb-4">
                        <Users className="h-5 w-5" />
                      </div>
                      <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest block">Total Registered</span>
                      <h3 className="text-3xl font-bold text-white mt-1">{stats.totalUsers}</h3>
                      <div className="absolute top-0 right-0 h-24 w-24 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition duration-300"></div>
                    </div>

                    {/* Card 2: Online */}
                    <div className="p-6 rounded-3xl bg-zinc-900/35 border border-zinc-800/80 backdrop-blur-md relative overflow-hidden group hover:border-emerald-500/30 transition duration-300">
                      <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 mb-4">
                        <Activity className="h-5 w-5 animate-pulse" />
                      </div>
                      <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest block">Active Sockets</span>
                      <h3 className="text-3xl font-bold text-white mt-1">{stats.onlineUsers}</h3>
                      <div className="absolute top-0 right-0 h-24 w-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition duration-300"></div>
                    </div>

                    {/* Card 3: Messages */}
                    <div className="p-6 rounded-3xl bg-zinc-900/35 border border-zinc-800/80 backdrop-blur-md relative overflow-hidden group hover:border-purple-500/30 transition duration-300">
                      <div className="h-12 w-12 rounded-2xl bg-purple-500/10 border border-purple-500/25 flex items-center justify-center text-purple-400 mb-4">
                        <MessageSquare className="h-5 w-5" />
                      </div>
                      <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest block">Database Packets</span>
                      <h3 className="text-3xl font-bold text-white mt-1">{stats.totalMessages}</h3>
                      <div className="absolute top-0 right-0 h-24 w-24 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition duration-300"></div>
                    </div>

                    {/* Card 4: Groups */}
                    <div className="p-6 rounded-3xl bg-zinc-900/35 border border-zinc-800/80 backdrop-blur-md relative overflow-hidden group hover:border-pink-500/30 transition duration-300">
                      <div className="h-12 w-12 rounded-2xl bg-pink-500/10 border border-pink-500/25 flex items-center justify-center text-pink-400 mb-4">
                        <TrendingUp className="h-5 w-5" />
                      </div>
                      <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest block">Active Groups</span>
                      <h3 className="text-3xl font-bold text-white mt-1">{stats.totalGroups}</h3>
                      <div className="absolute top-0 right-0 h-24 w-24 bg-pink-500/5 rounded-full blur-2xl group-hover:bg-pink-500/10 transition duration-300"></div>
                    </div>
                  </div>

                  {/* System overview & charts */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Left: Server Infrastructure */}
                    <div className="p-6 rounded-3xl bg-zinc-900/35 border border-zinc-800/80 backdrop-blur-md lg:col-span-1 space-y-4">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                        <Server className="h-4 w-4 text-emerald-400" /> Infrastructure Health
                      </h3>
                      
                      <div className="space-y-3.5 mt-2">
                        <div className="flex items-center justify-between border-b border-zinc-800/40 pb-2.5">
                          <span className="text-xs text-zinc-400">Database Engine</span>
                          <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                            <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full"></span> SQLite3 Local
                          </span>
                        </div>
                        <div className="flex items-center justify-between border-b border-zinc-800/40 pb-2.5">
                          <span className="text-xs text-zinc-400">API Gateway Status</span>
                          <span className="text-xs font-bold text-emerald-400">Operational</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-zinc-800/40 pb-2.5">
                          <span className="text-xs text-zinc-400">Real-Time Engine</span>
                          <span className="text-xs font-bold text-teal-400">Socket.IO Active</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-zinc-800/40 pb-2.5">
                          <span className="text-xs text-zinc-400">Uptime</span>
                          <span className="text-xs font-mono text-zinc-200">
                            {Math.floor(stats.serverUptime / 3600)}h {Math.floor((stats.serverUptime % 3600) / 60)}m
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-zinc-400">Security Layers</span>
                          <span className="text-xs font-bold text-blue-400">JWT + requireAdmin</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Growth Analytics Charts */}
                    <div className="p-6 rounded-3xl bg-zinc-900/35 border border-zinc-800/80 backdrop-blur-md lg:col-span-2 space-y-4">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-blue-400" /> Messaging & Traffic Analytics
                      </h3>
                      
                      {/* Premium Custom SVG Chart */}
                      <div className="h-48 w-full bg-zinc-950/30 border border-zinc-900 rounded-2xl flex items-center justify-center p-4 relative">
                        <svg className="w-full h-full" viewBox="0 0 500 150">
                          {/* Grid Lines */}
                          <line x1="0" y1="37.5" x2="500" y2="37.5" stroke="#27272a" strokeWidth="0.5" strokeDasharray="4,4" />
                          <line x1="0" y1="75" x2="500" y2="75" stroke="#27272a" strokeWidth="0.5" strokeDasharray="4,4" />
                          <line x1="0" y1="112.5" x2="500" y2="112.5" stroke="#27272a" strokeWidth="0.5" strokeDasharray="4,4" />
                          
                          {/* Smooth gradient curve for activity */}
                          <defs>
                            <linearGradient id="chartGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                              <stop offset="0%" stopColor="#10b981" stopOpacity="0.18" />
                              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>
                          
                          {/* Area path */}
                          <path
                            d="M 0 150 Q 50 120 100 110 T 200 90 T 300 130 T 400 45 T 500 65 L 500 150 Z"
                            fill="url(#chartGrad)"
                          />

                          {/* Line path */}
                          <path
                            d="M 0 150 Q 50 120 100 110 T 200 90 T 300 130 T 400 45 T 500 65"
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />
                          
                          {/* Indicator dots */}
                          <circle cx="400" cy="45" r="4" fill="#10b981" />
                          <circle cx="500" cy="65" r="4" fill="#10b981" />
                        </svg>

                        <div className="absolute top-3 right-4 flex items-center gap-3">
                          <span className="text-[9px] font-bold uppercase text-emerald-400 bg-emerald-500/10 border border-emerald-500/15 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <span className="h-1 w-1 bg-emerald-500 rounded-full animate-ping"></span> Real-time Network Log
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between text-[10px] text-zinc-500 font-semibold px-2">
                        <span>08:00 AM</span>
                        <span>10:00 AM</span>
                        <span>12:00 PM</span>
                        <span>02:00 PM</span>
                        <span>Active Monitoring</span>
                      </div>
                    </div>

                  </div>
                </motion.div>
              )}

              {/* USER DIRECTORY TAB */}
              {activeTab === 'users' && (
                <motion.div
                  key="users-panel"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  {/* Filter and Search controls */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-sm">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                        <Search className="h-4 w-4" />
                      </div>
                      <input
                        type="text"
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        placeholder="Search operators and users..."
                        className="block w-full pl-10 pr-4 py-2.5 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl text-zinc-200 placeholder-zinc-500 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <span className="text-xs font-semibold text-zinc-400">
                      Total: <span className="text-white">{filteredUsers.length}</span> / {users.length}
                    </span>
                  </div>

                  {/* Users Table */}
                  <div className="rounded-3xl bg-zinc-900/35 border border-zinc-800/80 backdrop-blur-md overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-zinc-800/60 bg-zinc-900/10 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                            <th className="px-6 py-4">Participant</th>
                            <th className="px-6 py-4">Role / Privileges</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">System ID</th>
                            <th className="px-6 py-4">Enrolled</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/40 text-xs">
                          {filteredUsers.map(user => {
                            const isMe = user.id === currentUser.id;
                            const isBanned = user.isBanned === 1;
                            const isUserOnline = user.status === 'online';
                            
                            return (
                              <tr 
                                key={user.id}
                                className={`hover:bg-zinc-800/10 transition duration-150 ${
                                  isBanned ? 'bg-red-500/[0.02]' : ''
                                }`}
                              >
                                {/* User Info */}
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center gap-3">
                                    {user.avatarUrl ? (
                                      <img 
                                        src={user.avatarUrl} 
                                        alt={user.displayName} 
                                        className="h-9 w-9 rounded-full object-cover border border-zinc-800" 
                                      />
                                    ) : (
                                      <div className="h-9 w-9 rounded-full bg-zinc-800 border border-zinc-800 flex items-center justify-center font-bold text-zinc-300 text-[10px] uppercase">
                                        {getInitials(user.displayName)}
                                      </div>
                                    )}
                                    <div>
                                      <div className="font-bold text-white flex items-center gap-1.5">
                                        {user.displayName}
                                        {isMe && (
                                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md bg-zinc-800 border border-zinc-750 text-zinc-400">
                                            Operator
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[10px] text-zinc-500 mt-0.5">{user.email}</div>
                                    </div>
                                  </div>
                                </td>

                                {/* Privilege Role */}
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase border ${
                                    user.role === 'admin' 
                                      ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' 
                                      : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                                  }`}>
                                    {user.role}
                                  </span>
                                </td>

                                {/* Connection Status */}
                                <td className="px-6 py-4 whitespace-nowrap">
                                  {isBanned ? (
                                    <span className="text-red-400 font-bold flex items-center gap-1">
                                      <UserX className="h-3.5 w-3.5" /> BANNED
                                    </span>
                                  ) : isUserOnline ? (
                                    <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                                      <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse"></span> ONLINE
                                    </span>
                                  ) : (
                                    <span className="text-zinc-500 font-medium">OFFLINE</span>
                                  )}
                                </td>

                                {/* Database ID */}
                                <td className="px-6 py-4 whitespace-nowrap font-mono text-[10px] text-zinc-500">
                                  {user.id}
                                </td>

                                {/* Creation date */}
                                <td className="px-6 py-4 whitespace-nowrap text-zinc-400 font-medium">
                                  {new Date(user.createdAt).toLocaleDateString()}
                                </td>

                                {/* Admin Actions */}
                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    
                                    {/* Role toggle (Admin/User) */}
                                    <button
                                      onClick={() => handleToggleRole(user.id, user.displayName, user.role)}
                                      disabled={isMe || actionLoading === user.id}
                                      title={user.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}
                                      className={`p-1.5 rounded-lg border transition ${
                                        user.role === 'admin'
                                          ? 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border-purple-500/20'
                                          : 'bg-zinc-900 hover:bg-zinc-850 text-zinc-400 border-zinc-850'
                                      } ${isMe ? 'opacity-30 cursor-not-allowed' : ''}`}
                                    >
                                      <Shield className="h-3.5 w-3.5" />
                                    </button>

                                    {/* Suspension Toggle */}
                                    <button
                                      onClick={() => handleToggleBan(user.id, user.displayName, user.isBanned)}
                                      disabled={isMe || actionLoading === user.id}
                                      title={isBanned ? 'Unban User' : 'Ban User'}
                                      className={`p-1.5 rounded-lg border transition ${
                                        isBanned
                                          ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20'
                                          : 'bg-zinc-900 hover:bg-zinc-850 text-zinc-400 border-zinc-850'
                                      } ${isMe ? 'opacity-30 cursor-not-allowed' : ''}`}
                                    >
                                      {isBanned ? <UserCheck className="h-3.5 w-3.5" /> : <UserX className="h-3.5 w-3.5" />}
                                    </button>

                                    {/* Delete Account */}
                                    <button
                                      onClick={() => handleDeleteUser(user.id, user.displayName)}
                                      disabled={isMe || actionLoading === user.id}
                                      title="Delete Account"
                                      className={`p-1.5 bg-zinc-900 hover:bg-red-500/10 text-zinc-500 hover:text-red-400 border border-zinc-850 hover:border-red-500/20 rounded-lg transition ${
                                        isMe ? 'opacity-30 cursor-not-allowed' : ''
                                      }`}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                    
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* CHAT MODERATION TAB */}
              {activeTab === 'chats' && (
                <motion.div
                  key="chats-panel"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-sm">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                        <Search className="h-4 w-4" />
                      </div>
                      <input
                        type="text"
                        value={chatSearch}
                        onChange={(e) => setChatSearch(e.target.value)}
                        placeholder="Search channels and groups..."
                        className="block w-full pl-10 pr-4 py-2.5 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl text-zinc-200 placeholder-zinc-500 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    {/* Left: Group Chats */}
                    <div className="p-6 rounded-3xl bg-zinc-900/35 border border-zinc-800/80 backdrop-blur-md space-y-4">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                        <Users className="h-4 w-4 text-emerald-400" /> Group Channels ({filteredGroups.length})
                      </h3>

                      <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                        {filteredGroups.map(group => (
                          <div key={group.id} className="p-3.5 rounded-2xl bg-zinc-950/20 border border-zinc-900 flex items-center justify-between hover:bg-zinc-800/10 transition">
                            <div className="flex items-center gap-3 min-w-0">
                              {group.avatarUrl ? (
                                <img src={group.avatarUrl} alt={group.name} className="h-9 w-9 rounded-full object-cover border border-zinc-800" />
                              ) : (
                                <div className="h-9 w-9 rounded-full bg-zinc-800 border border-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-300">
                                  G
                                </div>
                              )}
                              <div className="min-w-0">
                                <h4 className="text-xs font-bold text-white truncate">{group.name}</h4>
                                <p className="text-[10px] text-zinc-500 mt-0.5 truncate">
                                  Creator: {group.creatorName} • {group.memberCount} members
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                              <button
                                onClick={() => handleOpenAudit(group.id, group.name, true)}
                                className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-850 hover:border-zinc-800 text-zinc-300 rounded-lg text-[10px] font-semibold transition"
                              >
                                Audit Logs
                              </button>
                              <button
                                onClick={() => handleDeleteGroup(group.id, group.name)}
                                className="p-1.5 bg-zinc-900 hover:bg-red-500/10 border border-zinc-850 hover:border-red-500/20 text-zinc-500 hover:text-red-400 rounded-lg transition"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}

                        {filteredGroups.length === 0 && (
                          <div className="text-center py-8 text-zinc-600 text-xs">No groups matching query.</div>
                        )}
                      </div>
                    </div>

                    {/* Right: Direct Active DM Rooms */}
                    <div className="p-6 rounded-3xl bg-zinc-900/35 border border-zinc-800/80 backdrop-blur-md space-y-4">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                        <MessageCircle className="h-4 w-4 text-blue-400" /> Active Direct Rooms ({filteredDirects.length})
                      </h3>

                      <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                        {filteredDirects.map(direct => (
                          <div key={direct.chatId} className="p-3.5 rounded-2xl bg-zinc-950/20 border border-zinc-900 flex items-center justify-between hover:bg-zinc-800/10 transition">
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                                <span className="truncate">{direct.userAName}</span>
                                <span className="text-zinc-600 font-semibold">↔</span>
                                <span className="truncate">{direct.userBName}</span>
                              </h4>
                              <p className="text-[10px] text-zinc-500 mt-0.5">
                                Volume: {direct.messageCount} packets • Active: {new Date(direct.lastActive).toLocaleTimeString()}
                              </p>
                            </div>

                            <button
                              onClick={() => handleOpenAudit(direct.chatId, `${direct.userAName} & ${direct.userBName}`, false)}
                              className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-850 hover:border-zinc-800 text-zinc-300 rounded-lg text-[10px] font-semibold transition"
                            >
                              Audit Logs
                            </button>
                          </div>
                        ))}

                        {filteredDirects.length === 0 && (
                          <div className="text-center py-8 text-zinc-600 text-xs">No active direct rooms found.</div>
                        )}
                      </div>
                    </div>

                  </div>
                </motion.div>
              )}

              {/* SYSTEM LOGS TAB */}
              {activeTab === 'logs' && (
                <motion.div
                  key="logs-panel"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 bg-emerald-500 rounded-full animate-ping"></span>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                        Live System Command Log (Socket.IO Connection)
                      </h3>
                    </div>
                    <button
                      onClick={() => setLogs([])}
                      className="px-2.5 py-1 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-[10px] text-zinc-400 hover:text-white font-bold transition"
                    >
                      Clear Terminal
                    </button>
                  </div>

                  {/* Terminal Log Container */}
                  <div className="h-[480px] bg-zinc-950/80 border border-zinc-900 rounded-3xl p-6 font-mono text-[11px] overflow-y-auto flex flex-col gap-2 relative shadow-2xl">
                    <div className="absolute top-4 right-6 text-[9px] font-bold text-zinc-600 select-none">
                      ANTIGRAVITY SYSTEMS DEPLOYED
                    </div>
                    
                    <div className="text-zinc-600 border-b border-zinc-900 pb-2">
                      --- HANDSHAKE ESTABLISHED CORE LOGGING CLIENT ---
                      <br />
                      --- LISTENING ON PORT 5000 SYNCED TO SQLITE ARCHIVES ---
                    </div>
                    
                    {logs.map(log => {
                      let catColor = 'text-blue-400';
                      if (log.category === 'Status') catColor = 'text-teal-400';
                      if (log.category === 'Moderation') catColor = 'text-red-400';
                      if (log.category === 'Security') catColor = 'text-purple-400';
                      
                      return (
                        <div key={log.id} className="flex gap-2.5 leading-relaxed items-start hover:bg-zinc-900/30 py-0.5 rounded px-1 transition duration-100">
                          <span className="text-zinc-600 font-semibold">{log.timestamp}</span>
                          <span className={`${catColor} font-bold`}>[{log.category.toUpperCase()}]</span>
                          <span className="text-zinc-300">{log.message}</span>
                        </div>
                      );
                    })}

                    {logs.length === 0 && (
                      <div className="text-zinc-600 text-center py-20 italic">
                        Logs empty. Awaiting client connections or operator actions...
                      </div>
                    )}
                    <div ref={logsEndRef} />
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          )}
        </main>
      </div>

      {/* FULLSCREEN AUDIT HISTORY PORTAL (Drawer / Modal overlay) */}
      <AnimatePresence>
        {selectedAuditChat && (
          <div className="fixed inset-0 bg-zinc-950/90 backdrop-blur-md z-50 flex items-center justify-end">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className="w-full max-w-lg h-full bg-zinc-900 border-l border-zinc-800 flex flex-col"
            >
              {/* Drawer Header */}
              <div className="p-6 border-b border-zinc-800/60 flex items-center justify-between bg-zinc-900/40">
                <div>
                  <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/15 px-2 py-0.5 rounded-full">
                    Audit Inspection
                  </span>
                  <h3 className="text-xs font-bold text-white truncate mt-2 max-w-[320px]">
                    {selectedAuditChat.name}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedAuditChat(null)}
                  className="p-2 text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-750 border border-zinc-800 rounded-xl transition duration-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* History Stream */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-zinc-950/30">
                {auditLoading ? (
                  <div className="text-center py-20">
                    <div className="h-8 w-8 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto"></div>
                    <span className="text-[11px] text-zinc-500 mt-3 block">Extracting messaging database rows...</span>
                  </div>
                ) : auditHistory.length === 0 ? (
                  <div className="text-center py-20 text-zinc-600 text-xs italic">
                    No logs found. Conversation empty.
                  </div>
                ) : (
                  auditHistory.map(msg => (
                    <div 
                      key={msg.id}
                      className="p-3 rounded-2xl bg-zinc-900/40 border border-zinc-850 flex items-start justify-between group hover:border-zinc-700 transition"
                    >
                      <div className="flex gap-2.5 min-w-0">
                        {msg.senderAvatar ? (
                          <img src={msg.senderAvatar} alt={msg.senderName} className="h-7 w-7 rounded-full object-cover mt-0.5" />
                        ) : (
                          <div className="h-7 w-7 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-zinc-300 text-[10px] mt-0.5 uppercase">
                            {getInitials(msg.senderName)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="text-[11px] font-bold text-white">{msg.senderName}</span>
                            <span className="text-[9px] text-zinc-600 font-mono">
                              {new Date(msg.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                          
                          {/* Content format */}
                          {msg.type === 'text' ? (
                            <p className="text-xs text-zinc-300 mt-1 break-words leading-relaxed whitespace-pre-wrap">
                              {msg.content}
                            </p>
                          ) : (
                            <div className="mt-1">
                              <span className="text-[10px] text-zinc-500 bg-zinc-850 px-2 py-0.5 rounded font-mono border border-zinc-800">
                                Attachment: {msg.type}
                              </span>
                              {msg.type.startsWith('image/') && (
                                <img 
                                  src={msg.content} 
                                  alt="Attachment" 
                                  className="h-20 max-w-[120px] rounded-lg object-cover border border-zinc-850 mt-1.5" 
                                />
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Deletion Moderation Button */}
                      <button
                        onClick={() => handleDeleteMessage(msg.id)}
                        title="Delete Message"
                        className="p-1.5 text-zinc-500 hover:text-red-400 bg-zinc-950 border border-zinc-850 hover:border-red-500/20 rounded-lg opacity-0 group-hover:opacity-100 transition duration-200"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
