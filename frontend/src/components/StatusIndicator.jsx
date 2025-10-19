import React from 'react';

const StatusIndicator = ({ isOnline, lastSeenFormatted, showText = false }) => {
  return (
    <div className="flex items-center space-x-2">
      <div className={`w-3 h-3 rounded-full ${
        isOnline ? 'bg-green-500' : 'bg-gray-400'
      } ${isOnline ? 'animate-pulse' : ''}`}></div>
      {showText && (
        <span className={`text-sm ${
          isOnline ? 'text-green-600' : 'text-gray-500'
        }`}>
          {isOnline ? 'Online now' : lastSeenFormatted || 'Offline'}
        </span>
      )}
    </div>
  );
};

export default StatusIndicator;
