// src/components/chat/TypingIndicator.tsx - Fixed Typing Indicator
'use client';

import React, { useState, useEffect } from 'react';

interface TypingIndicatorProps {
  userIds: string[];
}

export default function TypingIndicator({ userIds }: TypingIndicatorProps) {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);

    return () => clearInterval(interval);
  }, []);

  if (userIds.length === 0) return null;

  return (
    <div className="flex justify-start">
      <div className="bg-gray-100 rounded-lg px-4 py-2 max-w-xs">
        <div className="flex items-center space-x-2">
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-xs text-gray-500">
            {userIds.length === 1 ? 'Someone is' : `${userIds.length} people are`} typing{dots}
          </span>
        </div>
      </div>
    </div>
  );
}

