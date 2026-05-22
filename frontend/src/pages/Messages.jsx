import React, { useEffect, useRef, useState } from 'react';
import { Send, MessageCircle, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { formatMessageTime } from '../utils/timeUtils';
import AppShell, { Avatar, EmptyState, ErrorState, LoadingState } from '../components/AppShell';

const Messages = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await api.getConversations(token);
        if (response.error) {
          setError(response.error);
        } else {
          const list = Array.isArray(response) ? response : [];
          setConversations(list);
          setSelectedConversation((current) => current || list[0] || null);
        }
      } catch {
        setError('Messages could not be loaded.');
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();
  }, []);

  useEffect(() => {
    if (!selectedConversation) return undefined;

    const fetchMessages = async () => {
      const token = localStorage.getItem('token');
      const response = await api.getMessages(selectedConversation.connection_id, token);
      if (!response.error) setMessages(Array.isArray(response) ? response : []);
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [selectedConversation]);

  const handleSendMessage = async (event) => {
    event.preventDefault();
    if (!newMessage.trim() || !selectedConversation) return;

    setSending(true);
    try {
      const token = localStorage.getItem('token');
      const response = await api.sendMessage(selectedConversation.connection_id, newMessage.trim(), token);
      if (!response.error) {
        setNewMessage('');
        const updatedMessages = await api.getMessages(selectedConversation.connection_id, token);
        if (!updatedMessages.error) setMessages(Array.isArray(updatedMessages) ? updatedMessages : []);
      }
    } finally {
      setSending(false);
    }
  };

  const getConversationName = (conversation) =>
    conversation.other_user_name || conversation.tutor_name || conversation.student_name || conversation.name || 'Conversation';

  if (loading) return <LoadingState label="Opening conversations..." />;
  if (error) return <ErrorState message={error} />;

  return (
    <AppShell>
      <main className="page">
        <section className="section-head">
          <div>
            <span className="eyebrow">
              <MessageCircle size={15} />
              Messages
            </span>
            <h1 className="page-title">Keep the learning conversation moving.</h1>
            <p className="page-copy">Coordinate homework questions, session details, and next steps with your connections.</p>
          </div>
        </section>

        {conversations.length === 0 ? (
          <EmptyState icon={Search} title="No conversations yet">
            Once a connection is accepted, messages with that person will appear here.
          </EmptyState>
        ) : (
          <section className="card message-layout">
            <aside className="conversation-list" aria-label="Conversations">
              {conversations.map((conversation) => {
                const active = selectedConversation?.connection_id === conversation.connection_id;
                const name = getConversationName(conversation);
                return (
                  <button
                    key={conversation.connection_id}
                    type="button"
                    className={`conversation-button${active ? ' active' : ''}`}
                    onClick={() => setSelectedConversation(conversation)}
                  >
                    <Avatar name={name} src={conversation.avatar_url} />
                    <span style={{ minWidth: 0 }}>
                      <strong style={{ display: 'block' }}>{name}</strong>
                      <span className="muted" style={{ display: 'block', fontSize: '0.85rem' }}>
                        {conversation.last_message || 'Open the conversation'}
                      </span>
                    </span>
                  </button>
                );
              })}
            </aside>

            <div className="thread">
              <header className="thread-head">
                <div className="item-main">
                  <Avatar name={getConversationName(selectedConversation)} src={selectedConversation?.avatar_url} />
                  <div>
                    <h2 style={{ fontSize: '1.1rem' }}>{getConversationName(selectedConversation)}</h2>
                    <p className="muted">{user?.role === 'tutor' ? 'Student connection' : 'Tutor connection'}</p>
                  </div>
                </div>
              </header>

              <div className="message-scroll">
                {messages.length ? (
                  messages.map((message) => {
                    const mine = message.sender_id === user?.id;
                    return (
                      <div className={`bubble${mine ? ' mine' : ''}`} key={message.id}>
                        <div>{message.content}</div>
                        <small>{formatMessageTime(message.timestamp)}</small>
                      </div>
                    );
                  })
                ) : (
                  <EmptyState icon={MessageCircle} title="Start the thread">
                    Send a quick note to coordinate what comes next.
                  </EmptyState>
                )}
                <div ref={messagesEndRef} />
              </div>

              <form className="composer" onSubmit={handleSendMessage}>
                <input
                  value={newMessage}
                  onChange={(event) => setNewMessage(event.target.value)}
                  placeholder="Write a message..."
                  aria-label="New message"
                />
                <button className="btn btn-primary" type="submit" disabled={sending || !newMessage.trim()}>
                  <Send size={18} />
                  Send
                </button>
              </form>
            </div>
          </section>
        )}
      </main>
    </AppShell>
  );
};

export default Messages;
