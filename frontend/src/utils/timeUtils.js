// Format message timestamp for display
export const formatMessageTime = (timestamp) => {
  const now = new Date();
  const messageTime = new Date(timestamp);
  const diffInMinutes = Math.floor((now - messageTime) / (1000 * 60));
  
  // Same day
  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    // Same day - show time
    return messageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    // Within a week - show day and time
    return messageTime.toLocaleDateString([], { 
      weekday: 'short', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }
  
  // Older than a week - show date
  return messageTime.toLocaleDateString([], { 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Format last seen time
export const formatLastSeen = (lastSeen) => {
  if (!lastSeen) return 'Never';
  
  const now = new Date();
  const lastSeenDate = new Date(lastSeen);
  const diffInMinutes = Math.floor((now - lastSeenDate) / (1000 * 60));
  
  if (diffInMinutes < 1) return 'Online now';
  if (diffInMinutes < 5) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} hours ago`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays} days ago`;
  
  return lastSeenDate.toLocaleDateString();
};
