import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { formatMessageTime } from '../utils/timeUtils';

const Messages = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('No authentication token found. Please log in again.');
          setLoading(false);
          return;
        }
        
        // Fetch conversations
        const conversationsResponse = await api.getConversations(token);
            if (conversationsResponse.error) {
              console.error('Error fetching conversations:', conversationsResponse.error);
              // If user not found, unauthorized, or invalid token, clear localStorage and redirect to login
              if (conversationsResponse.error.includes('User not found') || conversationsResponse.error.includes('Unauthorized') || conversationsResponse.error.includes('Invalid or expired token')) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/login';
                return;
              }
              setError('Failed to load conversations: ' + conversationsResponse.error);
            } else {
          setConversations(conversationsResponse);
        }

        // Fetch profile for avatar
        const profileResponse = await api.getProfile(token);
        if (profileResponse.error) {
          console.error('Error fetching profile:', profileResponse.error);
          // Don't set error for profile fetch failure, just log it
        } else {
          setProfile(profileResponse);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to load messages. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Auto-refresh messages every 5 seconds when a conversation is selected
  useEffect(() => {
    if (!selectedConversation) return;

    const interval = setInterval(() => {
      const fetchMessages = async () => {
        try {
          const token = localStorage.getItem('token');
          const response = await api.getMessages(selectedConversation.connection_id, token);
          if (response.error) {
            console.error('Error fetching messages:', response.error);
          } else {
            setMessages(response);
          }
        } catch (error) {
          console.error('Error fetching messages:', error);
        }
      };
      fetchMessages();
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedConversation]);

  useEffect(() => {
    if (selectedConversation) {
      const fetchMessages = async () => {
        try {
          const token = localStorage.getItem('token');
          const response = await api.getMessages(selectedConversation.connection_id, token);
          if (response.error) {
            console.error('Error fetching messages:', response.error);
          } else {
            setMessages(response);
          }
        } catch (error) {
          console.error('Error fetching messages:', error);
        }
      };

      fetchMessages();
    }
  }, [selectedConversation]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation) return;

    setSending(true);
    try {
      const token = localStorage.getItem('token');
      const response = await api.sendMessage(
        selectedConversation.connection_id,
        newMessage,
        token
      );
      
      if (response.error) {
        alert('Error sending message: ' + response.error);
      } else {
        setNewMessage('');
        // Refresh messages
        const updatedMessages = await api.getMessages(selectedConversation.connection_id, token);
        if (!updatedMessages.error) {
          setMessages(updatedMessages);
        }
        // Refresh dashboard stats
        if (window.refreshDashboardStats) {
          window.refreshDashboardStats();
        }
      }
    } catch (error) {
      alert('Error sending message');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="spinner"></div>
          <p className="mt-4 text-gray-600">Loading messages...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Error Loading Messages</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="btn btn-primary w-full"
            >
              Try Again
            </button>
            <a
              href="/dashboard"
              className="btn btn-ghost w-full"
            >
              Back to Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication Required</h2>
          <p className="text-gray-600 mb-6">Please log in to access messages.</p>
          <a
            href="/login"
            className="btn btn-primary w-full"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="container">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              {/* Profile Picture in Header */}
              {profile?.avatar_url ? (
                <img
                  src={`http://localhost:3001${profile.avatar_url}`}
                  alt="Profile"
                  className="w-12 h-12 rounded-full object-cover border-2 border-primary-200 shadow-md"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-100 to-secondary-100 flex items-center justify-center border-2 border-primary-200 shadow-md">
                  <span className="text-xl text-primary-600">👤</span>
                </div>
              )}
              <div>
                <h1 className="text-gradient">Messages</h1>
                <p className="text-gray-600">Chat with your {user?.role === 'tutor' ? 'students' : 'tutors'}</p>
              </div>
            </div>
            <a
              href="/dashboard"
              className="text-primary-600 hover:text-primary-500"
            >
              ← Back to Dashboard
            </a>
          </div>
        </div>
      </header>

      <div className="container py-6">
        <div className="card overflow-hidden">
          <div className="flex flex-col md:flex-row h-96">
            {/* Conversations List */}
            <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Conversations</h3>
              </div>
              <div className="overflow-y-auto h-full">
                {conversations.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    No conversations yet
                  </div>
                ) : (
                  conversations.map((conversation) => (
                    <div
                      key={conversation.connection_id}
                      onClick={() => setSelectedConversation(conversation)}
                      className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                        selectedConversation?.connection_id === conversation.connection_id
                          ? 'bg-indigo-50 border-indigo-200'
                          : ''
                      }`}
                    >
                      <div className="font-medium text-gray-900">
                        {user?.role === 'tutor' ? conversation.student_name : conversation.tutor_name}
                      </div>
                      {conversation.last_message && (
                        <div className="text-sm text-gray-500 truncate">
                          {conversation.last_message}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 flex flex-col min-h-0">
              {selectedConversation ? (
                <>
                  {/* Chat Header */}
                  <div className="p-4 border-b border-gray-200 bg-gray-50">
                    <h4 className="font-medium text-gray-900">
                      {user?.role === 'tutor' ? selectedConversation.student_name : selectedConversation.tutor_name}
                    </h4>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${
                          message.sender_id === user?.id ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        <div
                          className={`message-bubble ${
                            message.sender_id === user?.id
                              ? 'message-sent'
                              : 'message-received'
                          }`}
                        >
                          <div className="text-sm">{message.content}</div>
                          <div className={`text-xs mt-1 flex items-center justify-between ${
                            message.sender_id === user?.id ? 'text-indigo-100' : 'text-gray-500'
                          }`}>
                            <span>{formatMessageTime(message.timestamp)}</span>
                            {message.sender_id === user?.id && (
                              <span className="ml-2">
                                {message.read_at ? '✓✓' : '✓'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Message Input */}
                  <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200">
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type your message..."
                        className="flex-1 focus-ring"
                        disabled={sending}
                      />
                      <button
                        type="submit"
                        disabled={sending || !newMessage.trim()}
                        className="btn btn-primary"
                      >
                        {sending ? 'Sending...' : 'Send'}
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-500">
                  Select a conversation to start chatting
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Messages;
