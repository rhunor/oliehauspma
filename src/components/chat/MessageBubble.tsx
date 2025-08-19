// src/components/chat/MessageBubble.tsx - Fixed Message Component
'use client';

import React from 'react';
import { format } from 'date-fns';
import { Download, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

interface MessageAttachment {
  fileId: string;
  filename: string;
  originalName: string;
  url: string;
  mimeType: string;
  size: number;
}

interface MessageSender {
  _id: string;
  name: string;
  avatar?: string;
}

interface Message {
  _id: string;
  content: string;
  messageType: 'text' | 'image' | 'file' | 'audio' | 'video';
  attachments: MessageAttachment[];
  sender: MessageSender;
  isRead: boolean;
  createdAt: string;
}

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
}

export default function MessageBubble({ message, isOwnMessage }: MessageBubbleProps) {
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleFileDownload = async (fileId: string, filename: string) => {
    try {
      const response = await fetch(`/api/files/${fileId}/download`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          window.open(data.data.downloadUrl, '_blank');
        }
      }
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  const renderAttachments = () => {
    if (message.attachments.length === 0) return null;

    return (
      <div className="mt-2 space-y-2">
        {message.attachments.map((attachment) => (
          <div key={attachment.fileId} className="border rounded p-2 bg-gray-50">
            {attachment.mimeType.startsWith('image/') ? (
              <div className="relative">
                <Image
                  src={attachment.url}
                  alt={attachment.originalName}
                  width={300}
                  height={200}
                  className="rounded object-cover max-w-full h-auto"
                />
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-gray-600">{attachment.originalName}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleFileDownload(attachment.fileId, attachment.originalName)}
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-medium text-sm">{attachment.originalName}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(attachment.size)}</p>
                </div>
                <div className="flex space-x-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => window.open(attachment.url, '_blank')}
                  >
                    <Eye className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleFileDownload(attachment.fileId, attachment.originalName)}
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
        isOwnMessage 
          ? 'bg-blue-500 text-white' 
          : 'bg-gray-100 text-gray-900'
      }`}>
        {!isOwnMessage && (
          <p className="text-xs font-medium mb-1 opacity-75">
            {message.sender.name}
          </p>
        )}
        
        {message.content && (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        )}
        
        {renderAttachments()}
        
        <div className={`flex items-center justify-between mt-1 ${
          isOwnMessage ? 'text-blue-100' : 'text-gray-500'
        }`}>
          <span className="text-xs">
            {format(new Date(message.createdAt), 'HH:mm')}
          </span>
          {isOwnMessage && (
            <span className="text-xs">
              {message.isRead ? '✓✓' : '✓'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

