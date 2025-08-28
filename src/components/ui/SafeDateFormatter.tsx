// src/components/ui/SafeDateFormatter.tsx - FIXED: No hydration errors for dates
'use client';

import { useState, useEffect } from 'react';

interface SafeDateFormatterProps {
  date: string | Date;
  format?: 'short' | 'long' | 'time';
  className?: string;
}

export default function SafeDateFormatter({ date, format = 'short', className }: SafeDateFormatterProps) {
  const [formattedDate, setFormattedDate] = useState<string>('');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // FIXED: Only format date on client to prevent hydration mismatch
    setIsClient(true);
    
    try {
      const dateObj = new Date(date);
      
      if (isNaN(dateObj.getTime())) {
        setFormattedDate('Invalid date');
        return;
      }

      let formatted: string;
      
      switch (format) {
        case 'long':
          formatted = dateObj.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
          break;
        case 'time':
          formatted = dateObj.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          break;
        case 'short':
        default:
          // FIXED: Use consistent ISO format instead of locale-dependent formatting
          formatted = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD format
          break;
      }
      
      setFormattedDate(formatted);
    } catch (error) {
      console.error('Error formatting date:', error);
      setFormattedDate('Invalid date');
    }
  }, [date, format]);

  // FIXED: Show loading state during server-side rendering to prevent hydration mismatch
  if (!isClient) {
    return <span className={className}>Loading...</span>;
  }

  return (
    <time 
      dateTime={typeof date === 'string' ? date : date.toISOString()}
      className={className}
      suppressHydrationWarning
    >
      {formattedDate}
    </time>
  );
}