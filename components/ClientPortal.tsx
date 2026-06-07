import React, { useState, useContext, useMemo } from 'react';
import { AppContext } from '../App';
import {
  Users, FileText, Clock, MessageSquare, Shield, Eye,
  Copy, ExternalLink, CheckCircle, AlertCircle, Send,
  Calendar, Download, Lock, Unlock, Plus, Trash2,
} from 'lucide-react';
import { toast } from 'react-toastify';

/* ─── Types ──────────────────────────────────────────── */

interface PortalClient {
  id: string;
  name: string;
  email: string;
  phone?: string;
  caseIds: string[];
  accessLevel: 'view-only' | 'documents' | 'full';
  lastAccess?: string;
  invitedAt: string;
  status: 'active' | 'pending' | 'disabled';
}

interface PortalMessage {
  id: string;
  clientId: string;
  from: 'client' | 'attorney';
  text: string;
  timestamp: number;
  read: boolean;
}

interface SharedDocument {
  id: string;
  clientId: string;
  name: string;
  type: string;
  sharedAt: string;
  downloadable: boolean;
}

const STORAGE_KEY = 'casebuddy_portal_clients';
const MSG_STORAGE_KEY = 'casebuddy_portal_messages';

/* ─── Helpers ────────────────────────────────────────── */

const loadClients = (): PortalClient[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

const saveClients = (clients: PortalClient[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
};

const loadMessages = (): PortalMessage[] => {
  try {
    const raw = localStorage.getItem(MSG_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

const saveMessages = (msgs: PortalMessage[]) => {
  localStorage.setItem(MSG_STORAGE_KEY, JSON.stringify(msgs));
};

const generatePortalLink = (clientId: string): string => {
  return `${window.location.origin}/portal/${clientId}`;
};

/* ─── Main Component ──────────────────────────────────── */

const ClientPortal: React.FC = () => {
  const { activeCase, cases } = useContext(AppContext);
  const [clients, setClients] = useState<PortalClient[]>(loadClients);
  const [messages, setMessages] = useState<PortalMessage[]>(loadMessages);
  const [tab, setTab] = useState<'clients' | 'messages' | 'shared' | 'settings'>('clients');
  const [showAddClient, setShowAddClient] = useState(false);
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');

  // Add client form
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAccess, setNewAccess] = useState<PortalClient['accessLevel']>('view-only');

  const selectedClientObj = useMemo(
    () => clients.find(c => c.id === selectedClient),
    [clients, selectedClient]
  );

  const clientMessages = useMemo(
    () => selectedClient ? messages.filter(m => m.clientId === selectedClient).sort((a, b) => a.timestamp - b.timestamp) : [],
    [messages, selectedClient]
  );

  const unreadCount = useMemo(
    () => messages.filter(m => !m.read && m.from === 'client').length,
    [messages]
  );

  /* ── Handlers ── */
  const handleAddClient = () => {
    if (!newName.trim() || !newEmail.trim()) {
      toast.error('Name and email are required');
      return;
    }
    const client: PortalClient = {
      id: `client_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: newName,
      email: newEmail,
      phone: newPhone || undefined,
      caseIds: activeCase ? [activeCase.id] : [],
      accessLevel: newAccess,
      invitedAt: new Date().toISOString(),
      status: 'pending',
    };
    const updated = [...clients, client];
    setClients(updated);
    saveClients(updated);
    setShowAddClient(false);
    setNewName('');
    setNewEmail('');
    setNewPhone('');
    setNewAccess('view-only');
    toast.success(`Invited ${client.name} to the client portal`);
  };

  const handleToggleStatus = (id: string) => {
    const updated = clients.map(c =>
      c.id === id
        ? { ...c, status: c.status === 'active' ? 'disabled' as const : 'active' as const }
        : c
    );
    setClients(updated);
    saveClients(updated);
  };

  const handleDeleteClient = (id: string) => {
    const updated = clients.filter(c => c.id !== id);
    setClients(updated);
    saveClients(updated);
    if (selectedClient === id) setSelectedClient(null);
    toast.success('Client removed');
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedClient) return;
    const msg: PortalMessage = {
      id: `msg_${Date.now()}`,
      clientId: selectedClient,
      from: 'attorney',
      text: newMessage,
      timestamp: Date.now(),
      read: true,
    };
    const updated = [...messages, msg];
    setMessages(updated);
    saveMessages(updated);
    setNewMessage('');
    toast.success('Message sent');
  };

  const handleCopyLink = (clientId: string) => {
    navigator.clipboard.writeText(generatePortalLink(clientId));
    toast.success('Portal link copied to clipboard');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white font-serif">
            Client Portal
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            Give clients secure access to case status, documents, and messaging
          </p>
        </div>
        <button
          onClick={() => setShowAddClient(true)}
          className="flex items-center gap-1 px-4 py-2 bg-gold-500 hover:bg-gold-600 rounded-lg text-sm text-slate-900 font-semibold transition-colors"
        >
          <Plus size={14} />
          Add Client
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Clients', value: clients.length, color: 'text-white', icon: Users },
          { label: 'Active', value: clients.filter(c => c.status === 'active').length, color: 'text-emerald-400', icon: CheckCircle },
          { label: 'Pending', value: clients.filter(c => c.status === 'pending').length, color: 'text-amber-400', icon: Clock },
          { label: 'Unread Messages', value: unreadCount, color: unreadCount > 0 ? 'text-red-400' : 'text-slate-400', icon: MessageSquare },
        ].map(s => (
          <div key={s.label} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <s.icon size={14} className={s.color} />
              <span className="text-xs text-slate-500 uppercase">{s.label}</span>
            </div>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700 pb-2">
        {([
          { id: 'clients' as const, label: 'Clients', icon: Users },
          { id: 'messages' as const, label: `Messages${unreadCount > 0 ? ` (${unreadCount})` : ''}`, icon: MessageSquare },
          { id: 'shared' as const, label: 'Shared Docs', icon: FileText },
          { id: 'settings' as const, label: 'Portal Settings', icon: Shield },
        ]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              tab === t.id
                ? 'bg-slate-800 text-white border-b-2 border-gold-500'
                : 'text-slate-500 hover:text-white'
            }`}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Clients Tab ── */}
      {tab === 'clients' && (
        clients.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Users size={40} className="mx-auto mb-3 opacity-50" />
            <p>No clients yet.</p>
            <p className="text-sm mt-1">Add a client to give them portal access.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {clients.map(client => (
              <div
                key={client.id}
                className={`bg-slate-800 border rounded-xl p-4 transition-colors ${
                  client.status === 'disabled' ? 'border-slate-700 opacity-60' : 'border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                      client.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
                      client.status === 'pending' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-slate-700 text-slate-500'
                    }`}>
                      {client.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">{client.name}</h3>
                      <p className="text-xs text-slate-400">{client.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      client.accessLevel === 'full' ? 'bg-emerald-500/20 text-emerald-400' :
                      client.accessLevel === 'documents' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-slate-700 text-slate-400'
                    }`}>
                      {client.accessLevel === 'view-only' ? '👁 View Only' :
                       client.accessLevel === 'documents' ? '📄 Documents' : '🔓 Full Access'}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      client.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
                      client.status === 'pending' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {client.status}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => handleCopyLink(client.id)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
                  >
                    <Copy size={12} />
                    Copy Portal Link
                  </button>
                  <button
                    onClick={() => { setSelectedClient(client.id); setTab('messages'); }}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors"
                  >
                    <MessageSquare size={12} />
                    Message
                  </button>
                  <button
                    onClick={() => handleToggleStatus(client.id)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-slate-700 text-slate-400 rounded-lg hover:bg-slate-600 transition-colors"
                  >
                    {client.status === 'disabled' ? <Unlock size={12} /> : <Lock size={12} />}
                    {client.status === 'disabled' ? 'Enable' : 'Disable'}
                  </button>
                  <button
                    onClick={() => handleDeleteClient(client.id)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 transition-colors ml-auto"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Messages Tab ── */}
      {tab === 'messages' && (
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Client List */}
          <div className="lg:col-span-1 space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Conversations</h3>
            {clients.length === 0 ? (
              <p className="text-sm text-slate-500">No clients yet</p>
            ) : (
              clients.map(c => {
                const unread = messages.filter(m => m.clientId === c.id && m.from === 'client' && !m.read).length;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedClient(c.id)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      selectedClient === c.id
                        ? 'bg-gold-500/20 border border-gold-500/50'
                        : 'bg-slate-800 border border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-white font-medium">{c.name}</p>
                      {unread > 0 && (
                        <span className="w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                          {unread}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate">{c.email}</p>
                  </button>
                );
              })
            )}
          </div>

          {/* Chat */}
          <div className="lg:col-span-3 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden flex flex-col" style={{ minHeight: '400px' }}>
            {selectedClientObj ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-slate-700 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gold-500/20 text-gold-500 flex items-center justify-center text-sm font-bold">
                    {selectedClientObj.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">{selectedClientObj.name}</p>
                    <p className="text-xs text-slate-500">{selectedClientObj.email}</p>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {clientMessages.length === 0 ? (
                    <p className="text-center text-slate-500 text-sm py-8">No messages yet</p>
                  ) : (
                    clientMessages.map(msg => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.from === 'attorney' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[70%] rounded-xl px-4 py-2 ${
                          msg.from === 'attorney'
                            ? 'bg-gold-500/20 text-white'
                            : 'bg-slate-700 text-slate-200'
                        }`}>
                          <p className="text-sm">{msg.text}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            {new Date(msg.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Input */}
                <div className="p-4 border-t border-slate-700 flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Type a message..."
                    className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim()}
                    className="px-4 py-2 bg-gold-500 hover:bg-gold-600 disabled:bg-slate-700 rounded-lg text-slate-900 disabled:text-slate-500 transition-colors"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-500">
                <div className="text-center">
                  <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Select a client to view messages</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Shared Docs Tab ── */}
      {tab === 'shared' && (
        <div className="space-y-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center">
            <FileText size={40} className="mx-auto mb-3 text-slate-500 opacity-50" />
            <h3 className="text-white font-semibold mb-2">Document Sharing</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              Share case documents securely with clients. They can view documents through their portal link
              based on their access level.
            </p>
            <div className="mt-4 grid sm:grid-cols-3 gap-4 max-w-lg mx-auto">
              {[
                { level: 'View Only', desc: 'Case status updates only', icon: Eye },
                { level: 'Documents', desc: 'View & download shared docs', icon: FileText },
                { level: 'Full Access', desc: 'All docs + messaging', icon: Shield },
              ].map(a => (
                <div key={a.level} className="bg-slate-900 rounded-lg p-3 border border-slate-700">
                  <a.icon size={18} className="mx-auto mb-1 text-gold-500" />
                  <p className="text-xs text-white font-medium">{a.level}</p>
                  <p className="text-xs text-slate-500">{a.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Settings Tab ── */}
      {tab === 'settings' && (
        <div className="space-y-6">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Shield size={18} className="text-gold-500" />
              Security Settings
            </h3>
            <div className="space-y-4">
              {[
                { label: 'Require email verification', desc: 'Clients must verify email before accessing portal', default: true },
                { label: 'Two-factor authentication', desc: 'Require 2FA for client portal access', default: false },
                { label: 'IP allowlisting', desc: 'Restrict portal access to specific IP addresses', default: false },
                { label: 'Session timeout (30 min)', desc: 'Auto-logout after 30 minutes of inactivity', default: true },
                { label: 'Watermark documents', desc: 'Add "CONFIDENTIAL" watermark to viewed documents', default: true },
                { label: 'Audit logging', desc: 'Log all client portal access and actions', default: true },
              ].map((setting, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                  <div>
                    <p className="text-sm text-white">{setting.label}</p>
                    <p className="text-xs text-slate-500">{setting.desc}</p>
                  </div>
                  <div className={`w-12 h-6 rounded-full ${setting.default ? 'bg-gold-500' : 'bg-slate-600'} relative cursor-pointer`}>
                    <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 ${setting.default ? 'left-6' : 'left-0.5'}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <h3 className="text-white font-semibold mb-4">Portal Branding</h3>
            <p className="text-sm text-slate-400">
              Client portal inherits branding from White-Label settings.
              Go to <span className="text-gold-500">White-Label & BYOK</span> to customize colors, logo, and firm name.
            </p>
          </div>
        </div>
      )}

      {/* ── Add Client Modal ── */}
      {showAddClient && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-lg">
            <h2 className="text-lg font-bold text-white mb-4">Add Client to Portal</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Client Name *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="John Smith"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Email *</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Phone</label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={e => setNewPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Access Level</label>
                <select
                  value={newAccess}
                  onChange={e => setNewAccess(e.target.value as PortalClient['accessLevel'])}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="view-only">👁 View Only — Case status only</option>
                  <option value="documents">📄 Documents — View & download shared docs</option>
                  <option value="full">🔓 Full Access — Docs + messaging</option>
                </select>
              </div>
              {activeCase && (
                <div className="bg-slate-900 rounded-lg p-3 flex items-center gap-2">
                  <CheckCircle size={14} className="text-emerald-400" />
                  <p className="text-sm text-slate-300">
                    Will be linked to: <span className="text-white font-medium">{activeCase.title}</span>
                  </p>
                </div>
              )}
              <div className="flex gap-3 mt-2">
                <button
                  onClick={handleAddClient}
                  className="flex-1 bg-gold-500 hover:bg-gold-600 text-slate-900 font-bold py-2.5 rounded-lg transition-colors"
                >
                  Add Client
                </button>
                <button
                  onClick={() => setShowAddClient(false)}
                  className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientPortal;
