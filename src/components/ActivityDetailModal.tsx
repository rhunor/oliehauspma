// src/components/site-schedule/ActivityDetailModal.tsx
"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { 
  X, 
  ZoomIn, 
  ChevronLeft, 
  ChevronRight,
  Edit,
  Clock,
  User
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// TypeScript interfaces
interface DailyActivity {
  _id: string;
  title: string;
  description: string;
  contractor: string;
  supervisor?: string;
  startDate: string;
  endDate: string;
  status: 'to-do' | 'pending' | 'in_progress' | 'completed' | 'delayed' | 'on_hold';
  comments?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  images?: string[];
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface ActivityDetailModalProps {
  activity: DailyActivity | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: (activityId: string, newStatus: DailyActivity['status']) => Promise<void>;
  onEdit?: (activityId: string) => void;
  showStatusChange?: boolean;
  showEditButton?: boolean;
  userRole?: 'admin' | 'manager' | 'client';
}

// Helper to format datetime for display
const formatDateTimeForDisplay = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Invalid date';
  }
};

// Get status badge styling
const getStatusBadgeClass = (status: string): string => {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-800';
    case 'in_progress':
      return 'bg-blue-100 text-blue-800';
    case 'pending':
      return 'bg-gray-100 text-gray-800';
    case 'delayed':
      return 'bg-red-100 text-red-800';
    case 'on_hold':
      return 'bg-yellow-100 text-yellow-800';
    case 'to-do':
      return 'bg-purple-100 text-purple-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export default function ActivityDetailModal({
  activity,
  isOpen,
  onClose,
  onStatusChange,
  onEdit,
  showStatusChange = true,
  showEditButton = true,
  userRole = 'admin'
}: ActivityDetailModalProps) {
  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Open lightbox with images
  const openLightbox = (images: string[], startIndex: number = 0) => {
    setLightboxImages(images);
    setCurrentImageIndex(startIndex);
    setLightboxOpen(true);
  };

  // Navigate lightbox
  const handlePrevImage = () => {
    setCurrentImageIndex(prev => 
      prev === 0 ? lightboxImages.length - 1 : prev - 1
    );
  };

  const handleNextImage = () => {
    setCurrentImageIndex(prev => 
      prev === lightboxImages.length - 1 ? 0 : prev + 1
    );
  };

  // Keyboard navigation for lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!lightboxOpen) return;
      
      if (e.key === 'Escape') {
        setLightboxOpen(false);
      } else if (e.key === 'ArrowLeft') {
        handlePrevImage();
      } else if (e.key === 'ArrowRight') {
        handleNextImage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen]);

  if (!activity) return null;

  return (
    <>
      {/* Activity Detail Modal */}
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="pr-8">
              <DialogTitle className="text-xl font-semibold">
                {activity.title}
              </DialogTitle>
              {activity.description && (
                <p className="text-sm text-gray-600 mt-2">{activity.description}</p>
              )}
              <div className="mt-3">
                <Badge className={getStatusBadgeClass(activity.status)}>
                  {activity.status.replace('_', ' ').replace('-', ' ')}
                </Badge>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Details Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600 flex items-center gap-1">
                  <User className="h-4 w-4" />
                  Contractor
                </p>
                <p className="font-medium mt-1">{activity.contractor}</p>
              </div>
              
              {activity.supervisor && (
                <div>
                  <p className="text-sm text-gray-600 flex items-center gap-1">
                    <User className="h-4 w-4" />
                    Supervisor
                  </p>
                  <p className="font-medium mt-1">{activity.supervisor}</p>
                </div>
              )}
              
              <div>
                <p className="text-sm text-gray-600 flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Start Date
                </p>
                <p className="font-medium mt-1 text-sm" suppressHydrationWarning>
                  {formatDateTimeForDisplay(activity.startDate)}
                </p>
              </div>
              
              <div>
                <p className="text-sm text-gray-600 flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  End Date
                </p>
                <p className="font-medium mt-1 text-sm" suppressHydrationWarning>
                  {formatDateTimeForDisplay(activity.endDate)}
                </p>
              </div>
            </div>

            {/* Priority Badge */}
            <div>
              <p className="text-sm text-gray-600 mb-2">Priority</p>
              <Badge variant="outline" className="capitalize">
                {activity.priority}
              </Badge>
            </div>

            {/* Images Section */}
            {activity.images && activity.images.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">
                  Activity Images ({activity.images.length})
                </p>
                <div className="grid grid-cols-4 gap-3">
                  {activity.images.map((imageUrl, index) => (
                    <div 
                      key={index} 
                      className="relative aspect-square cursor-pointer hover:opacity-80 transition-opacity group rounded-lg overflow-hidden border border-gray-200"
                      onClick={() => openLightbox(activity.images || [], index)}
                    >
                      <Image
                        src={imageUrl}
                        alt={`Activity image ${index + 1}`}
                        fill
                        className="object-cover"
                      />
                      {/* Zoom icon overlay */}
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-opacity flex items-center justify-center">
                        <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Comments Section */}
            {activity.comments && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Internal Comments</p>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{activity.comments}</p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t">
              {showStatusChange && onStatusChange && (
                <div className="flex-1">
                  <p className="text-sm text-gray-600 mb-2">Update Status</p>
                  <Select
                    value={activity.status}
                    onValueChange={(value) => onStatusChange(activity._id, value as DailyActivity['status'])}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="to-do">To-Do</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="delayed">Delayed</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {showEditButton && onEdit && userRole !== 'client' && (
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={() => onEdit(activity._id)}
                    className="flex items-center gap-2"
                  >
                    <Edit className="h-4 w-4" />
                    Edit Activity
                  </Button>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Lightbox Modal */}
      {lightboxOpen && (
        <div 
          className="fixed inset-0 z-[100] bg-black bg-opacity-95 flex items-center justify-center"
          onClick={() => setLightboxOpen(false)}
        >
          <div className="relative w-full h-full flex items-center justify-center p-4">
            {/* Close Button */}
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors z-10 bg-black bg-opacity-50 rounded-full p-2"
              aria-label="Close lightbox"
            >
              <X className="h-8 w-8" />
            </button>

            {/* Previous Button */}
            {lightboxImages.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevImage();
                }}
                className="absolute left-4 text-white hover:text-gray-300 transition-colors z-10 bg-black bg-opacity-50 rounded-full p-2"
                aria-label="Previous image"
              >
                <ChevronLeft className="h-12 w-12" />
              </button>
            )}

            {/* Image Container */}
            <div 
              className="relative max-w-6xl max-h-[90vh] w-full h-full flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <Image
                src={lightboxImages[currentImageIndex]}
                alt={`Image ${currentImageIndex + 1} of ${lightboxImages.length}`}
                fill
                className="object-contain"
                priority
              />
            </div>

            {/* Next Button */}
            {lightboxImages.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNextImage();
                }}
                className="absolute right-4 text-white hover:text-gray-300 transition-colors z-10 bg-black bg-opacity-50 rounded-full p-2"
                aria-label="Next image"
              >
                <ChevronRight className="h-12 w-12" />
              </button>
            )}

            {/* Image Counter */}
            {lightboxImages.length > 1 && (
              <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-white bg-black bg-opacity-70 px-6 py-3 rounded-full text-sm font-medium">
                {currentImageIndex + 1} / {lightboxImages.length}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}