import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Upload, Send, FileText, Loader2, User, Bot, Paperclip, CheckCircle2, AlertCircle, Menu, X, Sparkles, MessageSquare, Plus, Copy, Check, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import './index.css';

const API_BASE_URL = 'http://127.0.0.1:8000';

function App() {
  const [sessions, setSessions] = useState(() => {
    const saved = localStorage.getItem('rag_sessions');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* fallback */ }
    }
    return [{ id: Date.now(), title: 'New Conversation', messages: [] }];
  });

  const [activeSessionId, setActiveSessionId] = useState(() => {
    const savedId = localStorage.getItem('rag_active_session_id');
    return savedId ? Number(savedId) : (sessions[0]?.id || Date.now());
  });

  const [documents, setDocuments] = useState([]);
  const [selectedFilterDoc, setSelectedFilterDoc] = useState('');

  const [file, setFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState({ type: '', message: '' });
  const [isUploading, setIsUploading] = useState(false);
  const [question, setQuestion] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [copiedCodeId, setCopiedCodeId] = useState(null);

  const messagesEndRef = useRef(null);
  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
  const messages = activeSession.messages;

  useEffect(() => {
    fetchDocuments();
  }, []);

  useEffect(() => {
    localStorage.setItem('rag_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem('rag_active_session_id', activeSessionId);
  }, [activeSessionId]);

  const fetchDocuments = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/documents`);
      setDocuments(res.data.documents || []);
    } catch (err) {
      console.error('Failed to fetch document library', err);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isQuerying]);

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setIsUploading(true);
    setUploadStatus({ type: '', message: '' });

    try {
      const response = await axios.post(`${API_BASE_URL}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadStatus({ type: 'success', message: `Processed ${response.data.chunks_processed} chunks successfully.` });
      setFile(null);
      fetchDocuments();
    } catch (err) {
      setUploadStatus({ type: 'error', message: err.response?.data?.detail || err.message });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDocument = async (filename, e) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete ${filename} from the vector store?`)) return;

    try {
      await axios.delete(`${API_BASE_URL}/documents/${encodeURIComponent(filename)}`);
      if (selectedFilterDoc === filename) {
        setSelectedFilterDoc('');
      }
      fetchDocuments();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete document');
    }
  };

  const handleQuery = async (e) => {
    try {
      if (e && e.preventDefault) e.preventDefault();
      if (!question || !question.trim()) return;

      const queryText = question.trim();
      const userMessage = { id: Date.now(), role: 'user', content: queryText };
      
      const updatedMessages = [...messages, userMessage];
      updateCurrentSessionMessages(updatedMessages, queryText);
      
      setQuestion('');
      setIsQuerying(true);

      const response = await axios.post(`${API_BASE_URL}/query`, {
        question: queryText,
        k: 6,
        filter_filename: selectedFilterDoc || null
      });
      
      const aiMessage = { 
        id: Date.now() + 1, 
        role: 'ai', 
        content: response.data.answer,
        context: response.data.context_used
      };
      
      updateCurrentSessionMessages([...updatedMessages, aiMessage]);
    } catch (err) {
      const errorMessage = {
        id: Date.now() + 1,
        role: 'ai',
        content: `Error: ${err.response?.data?.detail || err.message}`,
        isError: true
      };
      updateCurrentSessionMessages([...messages, errorMessage]);
    } finally {
      setIsQuerying(false);
    }
  };

  const updateCurrentSessionMessages = (newMessages, newTitle = null) => {
    setSessions(prev => prev.map(session => {
      if (session.id === activeSessionId) {
        return {
          ...session,
          title: newTitle && session.title === 'New Conversation' ? (newTitle.length > 25 ? newTitle.substring(0, 25) + '...' : newTitle) : session.title,
          messages: newMessages
        };
      }
      return session;
    }));
  };

  const createNewSession = () => {
    setUploadStatus({ type: '', message: '' });
    const newSession = { id: Date.now(), title: 'New Conversation', messages: [] };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  return (
    <div className="app-layout dark-theme">
      <aside className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <div className="brand">
            <Sparkles className="brand-icon" size={22} />
            <h2>RAG Studio</h2>
          </div>
          <button className="icon-btn close-sidebar" onClick={() => setIsSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <div className="sidebar-action-row">
          <button className="new-chat-btn" onClick={createNewSession}>
            <Plus size={16} />
            <span>New Chat</span>
          </button>
        </div>
        
        <div className="upload-container">
          <h3>Document Library</h3>
          <form onSubmit={handleFileUpload} className="upload-form">
            <div className="file-input-wrapper">
              <input 
                type="file" 
                accept=".pdf" 
                onChange={(e) => setFile(e.target.files[0])}
                id="file-upload"
              />
              <label htmlFor="file-upload" className="file-label">
                <Paperclip size={18} />
                <span className="file-name">{file ? file.name : 'Upload new PDF...'}</span>
              </label>
            </div>
            
            <button type="submit" className="upload-btn" disabled={!file || isUploading}>
              {isUploading ? <Loader2 className="spinner" size={18} /> : <Upload size={18} />}
              <span>{isUploading ? 'Ingesting vectors...' : 'Add to Library'}</span>
            </button>
          </form>

          {uploadStatus.message && (
            <div className={`status-banner ${uploadStatus.type}`}>
              {uploadStatus.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{uploadStatus.message}</span>
            </div>
          )}

          <div className="library-list-container" style={{ marginTop: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>Active Library ({documents.length})</span>
              {selectedFilterDoc && (
                <button 
                  onClick={() => setSelectedFilterDoc('')} 
                  style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '11px', cursor: 'pointer' }}
                >
                  Clear Filter
                </button>
              )}
            </div>
            <div className="library-files" style={{ maxHeight: '140px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {documents.length === 0 ? (
                <p style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>No documents uploaded yet.</p>
              ) : (
                documents.map(doc => (
                  <div 
                    key={doc} 
                    onClick={() => setSelectedFilterDoc(doc === selectedFilterDoc ? '' : doc)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px',
                      background: selectedFilterDoc === doc ? '#1e293b' : '#0f172a',
                      border: selectedFilterDoc === doc ? '1px solid #38bdf8' : '1px solid #334155',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                      <FileText size={14} color="#38bdf8" />
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#e2e8f0' }}>{doc}</span>
                    </div>
                    <button 
                      onClick={(e) => handleDeleteDocument(doc, e)}
                      title="Delete document"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', display: 'flex', padding: '2px' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="history-section">
          <h4 className="history-title">Recent Conversations</h4>
          <div className="history-list">
            {sessions.map(session => (
              <button 
                key={session.id} 
                className={`history-item ${session.id === activeSessionId ? 'active' : ''}`}
                onClick={() => setActiveSessionId(session.id)}
              >
                <MessageSquare size={14} />
                <span className="history-text">{session.title}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="system-status">
            <span className="status-dot"></span>
            <span>API Connected (Gemini)</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="top-header">
          <div className="header-left">
            {!isSidebarOpen && (
              <button className="icon-btn toggle-sidebar" onClick={() => setIsSidebarOpen(true)}>
                <Menu size={20} />
              </button>
            )}
            <div className="active-doc-badge">
              <FileText size={16} />
              <span>{selectedFilterDoc ? `Querying: ${selectedFilterDoc}` : 'Querying: All Documents in Library'}</span>
            </div>
          </div>
        </header>

        <div className="chat-viewport">
          {messages.length === 0 ? (
            <div className="welcome-state">
              <div className="welcome-icon-wrapper">
                <Bot size={36} />
              </div>
              <h2>How can I help you analyze your documents?</h2>
              <p>Upload PDFs to your library and ask questions across all files or a specific selection.</p>
            </div>
          ) : (
            <div className="message-list">
              {messages.map((msg) => (
                <div key={msg.id} className={`message-row ${msg.role}`}>
                  <div className="avatar">
                    {msg.role === 'user' ? <User size={18} /> : <Bot size={18} />}
                  </div>
                  <div className={`message-card ${msg.role} ${msg.isError ? 'error-card' : ''}`}>
                    <div className="markdown-body">
                      {msg.role === 'ai' && !msg.isError ? (
                        <div style={{ position: 'relative' }}>
                          <button 
                            className="copy-snippet-btn" 
                            onClick={() => copyToClipboard(String(msg.content), msg.id)}
                            title="Copy response"
                          >
                            {copiedCodeId === msg.id ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
                          </button>
                          <ReactMarkdown>{String(msg.content)}</ReactMarkdown>
                        </div>
                      ) : (
                        <p>{String(msg.content)}</p>
                      )}
                    </div>
                    {msg.context && (
                      <details className="source-context">
                        <summary>Retrieved Source Chunks</summary>
                        <pre>{String(msg.context)}</pre>
                      </details>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {isQuerying && (
            <div className="message-row ai">
              <div className="avatar">
                <Bot size={18} />
              </div>
              <div className="message-card ai typing-card">
                <div className="typing-dots">
                  <span></span><span></span><span></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="input-dock">
          <form onSubmit={handleQuery} className="input-box">
            <input
              type="text"
              placeholder={selectedFilterDoc ? `Ask about ${selectedFilterDoc}...` : "Ask anything across your document library..."}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={isQuerying}
            />
            <button type="submit" disabled={isQuerying || !question.trim()} className="send-action-btn">
              {isQuerying ? <Loader2 className="spinner" size={18} /> : <Send size={18} />}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

export default App;