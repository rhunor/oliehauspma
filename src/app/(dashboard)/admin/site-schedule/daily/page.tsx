// src/app/(dashboard)/admin/site-schedule/daily/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  CalendarCheck,
  Clock,
  Plus,
  Save,
  Camera,
  User,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader,
  ChevronLeft,
  ChevronRight,
  Edit,
  Trash,
  Image as ImageIcon
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface DailyTask {
  id: string;
  title: string;
  contractor: string;
  status: 'completed' | 'in_progress' | 'pending' | 'delayed';
  comments: string;
  images: string[];
  incidentReport?: string;
  supervisor: string;
  startTime?: string;
  endTime?: string;
}

// Mock contractors list
const contractors = [
  "Ernest", "John", "Ben", "Mason", "Ezekiel", 
  "AY", "Kingsley", "Saheed", "Temidayo"
];

// Mock supervisors list
const supervisors = [
  "Anita", "Naomi", "Ernest", "Temidayo"
];

export default function DailyProgressPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingTask, setEditingTask] = useState<DailyTask | null>(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [selectedProject, setSelectedProject] = useState("magodo-spa");

  // Form state for new/edit task
  const [taskForm, setTaskForm] = useState<Partial<DailyTask>>({
    title: "",
    contractor: "",
    status: "pending",
    comments: "",
    images: [],
    supervisor: session?.user?.name || "",
    incidentReport: ""
  });

  // Load tasks for selected date
  useEffect(() => {
    loadTasksForDate(selectedDate);
  }, [selectedDate]);

  const loadTasksForDate = async (date: string) => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      // Mock data for demonstration
      const mockTasks: DailyTask[] = [
        {
          id: "1",
          title: "Plumbing connections in master bathroom",
          contractor: "John",
          status: "completed",
          comments: "All connections completed and tested for leaks",
          images: ["image1.jpg", "image2.jpg"],
          supervisor: "Ernest",
          startTime: "08:00",
          endTime: "12:00"
        },
        {
          id: "2",
          title: "Electrical wiring for kitchen",
          contractor: "AY",
          status: "in_progress",
          comments: "Wiring 70% complete, will finish tomorrow",
          images: ["image3.jpg"],
          supervisor: "Ernest",
          startTime: "09:00"
        }
      ];
      
      if (date === new Date().toISOString().split('T')[0]) {
        setTasks(mockTasks);
      } else {
        setTasks([]);
      }
      setLoading(false);
    }, 500);
  };

  const handleAddTask = () => {
    setTaskForm({
      title: "",
      contractor: "",
      status: "pending",
      comments: "",
      images: [],
      supervisor: session?.user?.name || "",
      incidentReport: ""
    });
    setEditingTask(null);
    setShowAddTask(true);
  };

  const handleEditTask = (task: DailyTask) => {
    setTaskForm(task);
    setEditingTask(task);
    setShowAddTask(true);
  };

  const handleDeleteTask = (taskId: string) => {
    if (confirm("Are you sure you want to delete this task?")) {
      setTasks(tasks.filter(t => t.id !== taskId));
      toast({
        title: "Task Deleted",
        description: "The task has been removed from the schedule",
      });
    }
  };

  const handleSaveTask = () => {
    if (!taskForm.title || !taskForm.contractor || !taskForm.supervisor) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please fill in all required fields",
      });
      return;
    }

    if (editingTask) {
      // Update existing task
      setTasks(tasks.map(t => 
        t.id === editingTask.id 
          ? { ...t, ...taskForm } as DailyTask
          : t
      ));
      toast({
        title: "Task Updated",
        description: "The task has been updated successfully",
      });
    } else {
      // Add new task
      const newTask: DailyTask = {
        id: Date.now().toString(),
        ...taskForm
      } as DailyTask;
      setTasks([...tasks, newTask]);
      toast({
        title: "Task Added",
        description: "New task has been added to the schedule",
      });
    }
    
    setShowAddTask(false);
    setTaskForm({});
    setEditingTask(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      // In a real app, you'd upload these to a server
      const fileNames = Array.from(files).map(f => f.name);
      setTaskForm({
        ...taskForm,
        images: [...(taskForm.images || []), ...fileNames]
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'in_progress':
        return <Loader className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'pending':
        return <Clock className="h-5 w-5 text-gray-400" />;
      case 'delayed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-400" />;
    }
  };

  const handleDateChange = (direction: 'prev' | 'next') => {
    const currentDate = new Date(selectedDate);
    if (direction === 'prev') {
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      currentDate.setDate(currentDate.getDate() + 1);
    }
    setSelectedDate(currentDate.toISOString().split('T')[0]);
  };

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-gray-900">
            Daily Site Progress
          </h1>
          <p className="text-neutral-600 mt-1">
            Track and update daily activities on site
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-3">
          <Link href="/admin/site-schedule">
            <Button variant="outline">
              <CalendarCheck className="h-4 w-4 mr-2" />
              Full Schedule
            </Button>
          </Link>
          <Button onClick={handleAddTask}>
            <Plus className="h-4 w-4 mr-2" />
            Add Activity
          </Button>
        </div>
      </div>

      {/* Project and Date Selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex items-center gap-3">
              <Label>Project:</Label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="magodo-spa">Magodo Spa - Dr Seyi Adebayo</SelectItem>
                  <SelectItem value="lekki-villa">Lekki Villa - Mrs Johnson</SelectItem>
                  <SelectItem value="vi-office">VI Office - TechCorp Ltd</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-3 ml-auto">
              <Button
                size="icon"
                variant="outline"
                onClick={() => handleDateChange('prev')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="flex items-center gap-2">
                <CalendarCheck className="h-5 w-5 text-primary-600" />
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedDate(e.target.value)}
                  className="w-48"
                />
                {isToday && (
                  <Badge className="bg-green-100 text-green-800">Today</Badge>
                )}
              </div>
              
              <Button
                size="icon"
                variant="outline"
                onClick={() => handleDateChange('next')}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Daily Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600">Total Activities</p>
                <p className="text-2xl font-bold">{tasks.length}</p>
              </div>
              <CalendarCheck className="h-8 w-8 text-primary-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600">Completed</p>
                <p className="text-2xl font-bold text-green-600">
                  {tasks.filter(t => t.status === 'completed').length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600">In Progress</p>
                <p className="text-2xl font-bold text-blue-600">
                  {tasks.filter(t => t.status === 'in_progress').length}
                </p>
              </div>
              <Loader className="h-8 w-8 text-blue-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600">Pending</p>
                <p className="text-2xl font-bold text-gray-600">
                  {tasks.filter(t => t.status === 'pending').length}
                </p>
              </div>
              <Clock className="h-8 w-8 text-gray-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Task List / Add-Edit Form */}
      {showAddTask ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingTask ? 'Edit Activity' : 'Add New Activity'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Activity Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., Installation of kitchen cabinets"
                  value={taskForm.title}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                    setTaskForm({ ...taskForm, title: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="contractor">Contractor *</Label>
                <Select 
                  value={taskForm.contractor} 
                  onValueChange={(value: string) => setTaskForm({ ...taskForm, contractor: value })}
                >
                  <SelectTrigger id="contractor">
                    <SelectValue placeholder="Select contractor" />
                  </SelectTrigger>
                  <SelectContent>
                    {contractors.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="supervisor">Supervisor *</Label>
                <Select 
                  value={taskForm.supervisor} 
                  onValueChange={(value: string) => setTaskForm({ ...taskForm, supervisor: value })}
                >
                  <SelectTrigger id="supervisor">
                    <SelectValue placeholder="Select supervisor" />
                  </SelectTrigger>
                  <SelectContent>
                    {supervisors.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="status">Status *</Label>
                <Select 
                  value={taskForm.status} 
                  onValueChange={(value: string) => 
                    setTaskForm({ ...taskForm, status: value as DailyTask['status'] })}
                >
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="delayed">Delayed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={taskForm.startTime}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                    setTaskForm({ ...taskForm, startTime: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="endTime">End Time</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={taskForm.endTime}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                    setTaskForm({ ...taskForm, endTime: e.target.value })}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="comments">Comments</Label>
              <Textarea
                id="comments"
                placeholder="Add any relevant comments or observations..."
                value={taskForm.comments}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => 
                  setTaskForm({ ...taskForm, comments: e.target.value })}
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="incident">Incident Report (if any)</Label>
              <Textarea
                id="incident"
                placeholder="Describe any incidents or issues encountered..."
                value={taskForm.incidentReport}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => 
                  setTaskForm({ ...taskForm, incidentReport: e.target.value })}
                rows={2}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Images</Label>
              <div className="flex items-center gap-4">
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                  id="image-upload"
                />
                <Label 
                  htmlFor="image-upload" 
                  className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  <Camera className="h-4 w-4" />
                  Upload Images
                </Label>
                {taskForm.images && taskForm.images.length > 0 && (
                  <span className="text-sm text-neutral-600">
                    {taskForm.images.length} image(s) selected
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex justify-end gap-3">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowAddTask(false);
                  setEditingTask(null);
                  setTaskForm({});
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveTask}>
                <Save className="h-4 w-4 mr-2" />
                {editingTask ? 'Update Activity' : 'Save Activity'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              Activities for {formatDate(selectedDate)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <Loader className="h-8 w-8 animate-spin text-primary-500 mx-auto" />
                <p className="mt-2 text-neutral-600">Loading activities...</p>
              </div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-8">
                <CalendarCheck className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-neutral-600 mb-4">No activities recorded for this date</p>
                <Button onClick={handleAddTask}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Activity
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="border rounded-lg p-4 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          {getStatusIcon(task.status)}
                          <h4 className="font-medium text-lg">{task.title}</h4>
                          <Badge className={
                            task.status === 'completed' ? 'bg-green-100 text-green-800' :
                            task.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                            task.status === 'pending' ? 'bg-gray-100 text-gray-800' :
                            'bg-red-100 text-red-800'
                          }>
                            {task.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm mb-3">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-400" />
                            <span className="text-neutral-600">Contractor:</span>
                            <span className="font-medium">{task.contractor}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-400" />
                            <span className="text-neutral-600">Supervisor:</span>
                            <span className="font-medium">{task.supervisor}</span>
                          </div>
                          {task.startTime && (
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-gray-400" />
                              <span className="text-neutral-600">Time:</span>
                              <span className="font-medium">
                                {task.startTime} {task.endTime && `- ${task.endTime}`}
                              </span>
                            </div>
                          )}
                        </div>
                        
                        {task.comments && (
                          <div className="bg-gray-50 p-3 rounded mb-3">
                            <p className="text-sm text-neutral-700">
                              <span className="font-medium">Comments:</span> {task.comments}
                            </p>
                          </div>
                        )}
                        
                        {task.incidentReport && (
                          <div className="bg-red-50 p-3 rounded mb-3">
                            <p className="text-sm text-red-700">
                              <span className="font-medium">Incident:</span> {task.incidentReport}
                            </p>
                          </div>
                        )}
                        
                        {task.images && task.images.length > 0 && (
                          <div className="flex items-center gap-2 text-sm text-neutral-600">
                            <ImageIcon className="h-4 w-4" />
                            <span>{task.images.length} image(s) attached</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-2 ml-4">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditTask(task)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => handleDeleteTask(task.id)}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}