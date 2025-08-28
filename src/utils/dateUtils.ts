// src/utils/dateUtils.ts - FIXED: Server-safe date formatting to prevent hydration errors

/**
 * FIXED: Format date consistently on server and client to prevent hydration errors
 * Uses ISO format or manual formatting instead of locale-dependent toLocaleDateString()
 */
export function formatDateSafe(date: string | Date): string {
  try {
    const dateObj = new Date(date);
    
    if (isNaN(dateObj.getTime())) {
      return 'Invalid date';
    }

    // FIXED: Use consistent ISO format that works same on server and client
    const isoString = dateObj.toISOString();
    const datePart = isoString.split('T')[0]; // Gets YYYY-MM-DD
    
    // Convert YYYY-MM-DD to DD/MM/YYYY for better readability
    const [year, month, day] = datePart.split('-');
    return `${day}/${month}/${year}`;
    
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid date';
  }
}

/**
 * FIXED: Format date for time elements with proper ISO datetime attribute
 */
export function formatDateTimeElement(date: string | Date): { display: string; dateTime: string } {
  try {
    const dateObj = new Date(date);
    
    if (isNaN(dateObj.getTime())) {
      return { display: 'Invalid date', dateTime: '' };
    }

    const isoString = dateObj.toISOString();
    const datePart = isoString.split('T')[0]; // Gets YYYY-MM-DD
    
    // Convert to DD/MM/YYYY for display
    const [year, month, day] = datePart.split('-');
    const display = `${day}/${month}/${year}`;
    
    return {
      display,
      dateTime: datePart // Keep ISO format for datetime attribute
    };
    
  } catch (error) {
    console.error('Error formatting date:', error);
    return { display: 'Invalid date', dateTime: '' };
  }
}

/**
 * FIXED: Get relative time safely (e.g., "2 days ago")
 * Only use on client-side to avoid hydration issues
 */
export function getRelativeTimeClient(date: string | Date): string {
  try {
    const dateObj = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    
    return `${Math.floor(diffDays / 365)} years ago`;
  } catch (error) {
    console.error('Error calculating relative time:', error);
    return 'Unknown';
  }
}