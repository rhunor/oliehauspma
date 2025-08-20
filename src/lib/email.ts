// src/lib/email.ts - Fixed Nodemailer Method Name and Type Safety
import nodemailer from 'nodemailer';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

// Types and Interfaces
interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

// More specific typing for email template data
interface EmailTemplateData {
  recipientName?: string;
  recipientEmail?: string;
  projectTitle?: string;
  projectUrl?: string;
  taskTitle?: string;
  taskUrl?: string;
  taskDescription?: string;
  dueDate?: string;
  priority?: string;
  updateMessage?: string;
  progress?: number;
  completedBy?: string;
  completionDate?: string;
  role?: string;
  dashboardUrl?: string;
  loginUrl?: string;
  message?: string;
  actionUrl?: string;
  subject?: string;
  period?: string;
  projects?: number;
  tasksDueToday?: number;
  newMessages?: number;
  filesUploaded?: number;
  tasksCompleted?: number;
  [key: string]: unknown; // Allow additional properties
}

interface NotificationData {
  recipientId: string;
  type: 'project_update' | 'task_assigned' | 'task_completed' | 'milestone_reached' | 'deadline_reminder' | 'message_received' | 'file_uploaded' | 'welcome' | 'general';
  projectId?: string;
  taskId?: string;
  data?: EmailTemplateData;
}

// Helper function to safely get string value with fallback
function getStringValue(value: unknown, fallback: string = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toString();
  return fallback;
}

// Helper function to safely get number value with fallback
function getNumberValue(value: unknown, fallback: number = 0): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? fallback : parsed;
  }
  return fallback;
}

// Create transporter with fixed method name
const createTransporter = (): nodemailer.Transporter => {
  const requiredEnvs = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD'];
  const missingEnvs = requiredEnvs.filter(env => !process.env[env]);
  
  if (missingEnvs.length > 0) {
    throw new Error(`Missing required environment variables: ${missingEnvs.join(', ')}`);
  }

  // Fixed: Use createTransport instead of createTransporter
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD, // App password from Gmail
    },
    pool: true, // Use connection pooling
    maxConnections: 5,
    maxMessages: 100,
  });
};

// Get transporter instance with proper null checking
let transporter: nodemailer.Transporter | null = null;

const getTransporter = (): nodemailer.Transporter => {
  if (!transporter) {
    transporter = createTransporter();
  }
  return transporter;
};

// Base email styles
const baseStyle = `
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 15px 0; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
    .highlight { background: #fef3c7; padding: 8px 12px; border-radius: 4px; border-left: 4px solid #f59e0b; }
  </style>
`;

// Core email sending function with proper error handling
export const sendEmail = async (options: EmailOptions): Promise<boolean> => {
  try {
    const emailTransporter = getTransporter();
    
    if (!emailTransporter) {
      console.error('📧 Email transporter not available');
      return false;
    }
    
    const mailOptions = {
      from: `"Olivehaus Project Management" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments || []
    };

    const result = await emailTransporter.sendMail(mailOptions);
    console.log('📧 Email sent successfully:', result.messageId);
    return true;
  } catch (error) {
    console.error('📧 Failed to send email:', error);
    return false;
  }
};

// Test email configuration
export const testEmailConfiguration = async (): Promise<boolean> => {
  try {
    const emailTransporter = getTransporter();
    if (!emailTransporter) {
      console.error('📧 Email transporter not available');
      return false;
    }
    
    const verified = await emailTransporter.verify();
    console.log('📧 Email configuration verified:', verified);
    return verified;
  } catch (error) {
    console.error('📧 Email configuration test failed:', error);
    return false;
  }
};

// Email templates function with proper typing and safe property access
const getEmailTemplate = (type: string, data: EmailTemplateData): EmailTemplate => {
  // Safe property accessors with fallbacks
  const recipientName = getStringValue(data.recipientName, 'there');
  const recipientEmail = getStringValue(data.recipientEmail, 'N/A');
  const projectTitle = getStringValue(data.projectTitle, 'Unknown Project');
  const projectUrl = getStringValue(data.projectUrl, '#');
  const taskTitle = getStringValue(data.taskTitle, 'New Task');
  const taskUrl = getStringValue(data.taskUrl, '#');
  const taskDescription = getStringValue(data.taskDescription, 'No description provided');
  const dueDate = getStringValue(data.dueDate, 'To be determined');
  const priority = getStringValue(data.priority, 'Medium');
  const updateMessage = getStringValue(data.updateMessage, 'Project has been updated');
  const progress = getNumberValue(data.progress, 0);
  const completedBy = getStringValue(data.completedBy, 'Team member');
  const completionDate = getStringValue(data.completionDate, new Date().toLocaleDateString());
  const role = getStringValue(data.role, 'User');
  const dashboardUrl = getStringValue(data.dashboardUrl, '#');
  const loginUrl = getStringValue(data.loginUrl, '#');
  const message = getStringValue(data.message, 'You have a new notification.');
  const actionUrl = getStringValue(data.actionUrl, '');
  const subject = getStringValue(data.subject, 'Notification from Olivehaus');
  const projects = getNumberValue(data.projects, 0);
  const tasksDueToday = getNumberValue(data.tasksDueToday, 0);
  const newMessages = getNumberValue(data.newMessages, 0);
  const filesUploaded = getNumberValue(data.filesUploaded, 0);
  const tasksCompleted = getNumberValue(data.tasksCompleted, 0);

  switch (type) {
    case 'project_update':
      return {
        subject: `Project Update: ${projectTitle}`,
        html: `
          ${baseStyle}
          <div class="container">
            <div class="header">
              <h1>Project Update</h1>
            </div>
            <div class="content">
              <h2>Hello ${recipientName},</h2>
              <p>There's a new update on your project <strong>${projectTitle}</strong>:</p>
              <div class="highlight">
                <p><strong>Update:</strong> ${updateMessage}</p>
                <p><strong>Progress:</strong> ${progress}%</p>
              </div>
              <a href="${projectUrl}" class="button">View Project</a>
              <p>If you have any questions, please don't hesitate to reach out to your project manager.</p>
            </div>
            <div class="footer">
              <p>© 2024 Olivehaus Project Management. All rights reserved.</p>
            </div>
          </div>
        `,
        text: `Project Update: ${projectTitle}\n\nHello ${recipientName},\n\nThere's a new update on your project "${projectTitle}":\n\nUpdate: ${updateMessage}\nProgress: ${progress}%\n\nView project: ${projectUrl}`
      };

    case 'task_assigned':
      return {
        subject: `New Task Assigned: ${taskTitle}`,
        html: `
          ${baseStyle}
          <div class="container">
            <div class="header">
              <h1>New Task Assigned</h1>
            </div>
            <div class="content">
              <h2>Hello ${recipientName},</h2>
              <p>You have been assigned a new task:</p>
              <div class="highlight">
                <p><strong>Task:</strong> ${taskTitle}</p>
                <p><strong>Project:</strong> ${projectTitle}</p>
                <p><strong>Due Date:</strong> ${dueDate}</p>
                <p><strong>Priority:</strong> ${priority}</p>
              </div>
              <p><strong>Description:</strong></p>
              <p>${taskDescription}</p>
              <a href="${taskUrl}" class="button">View Task</a>
              <p>Please review the task details and get started. If you have any questions, contact your project manager.</p>
            </div>
            <div class="footer">
              <p>© 2024 Olivehaus Project Management. All rights reserved.</p>
            </div>
          </div>
        `,
        text: `New Task Assigned: ${taskTitle}\n\nHello ${recipientName},\n\nYou have been assigned a new task:\n\nTask: ${taskTitle}\nProject: ${projectTitle}\nDue Date: ${dueDate}\nPriority: ${priority}\n\nDescription: ${taskDescription}\n\nView task: ${taskUrl}`
      };

    case 'task_completed':
      return {
        subject: `Task Completed: ${taskTitle}`,
        html: `
          ${baseStyle}
          <div class="container">
            <div class="header">
              <h1>Task Completed</h1>
            </div>
            <div class="content">
              <h2>Hello ${recipientName},</h2>
              <p>Great news! A task in your project has been completed:</p>
              <div class="highlight">
                <p><strong>Task:</strong> ${taskTitle}</p>
                <p><strong>Project:</strong> ${projectTitle}</p>
                <p><strong>Completed by:</strong> ${completedBy}</p>
                <p><strong>Completion Date:</strong> ${completionDate}</p>
              </div>
              <a href="${projectUrl}" class="button">View Project Progress</a>
              <p>Your project is moving forward smoothly. Check the project dashboard for the latest updates.</p>
            </div>
            <div class="footer">
              <p>© 2024 Olivehaus Project Management. All rights reserved.</p>
            </div>
          </div>
        `,
        text: `Task Completed: ${taskTitle}\n\nHello ${recipientName},\n\nA task has been completed:\n\nTask: ${taskTitle}\nProject: ${projectTitle}\nCompleted by: ${completedBy}\nCompletion Date: ${completionDate}\n\nView project: ${projectUrl}`
      };

    case 'welcome':
      const formattedRole = role.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
      return {
        subject: 'Welcome to Olivehaus Project Management',
        html: `
          ${baseStyle}
          <div class="container">
            <div class="header">
              <h1>Welcome to Olivehaus!</h1>
            </div>
            <div class="content">
              <h2>Hello ${recipientName},</h2>
              <p>Welcome to Olivehaus Project Management! Your account has been created successfully.</p>
              <div class="highlight">
                <p><strong>Your Role:</strong> ${formattedRole}</p>
                <p><strong>Account Email:</strong> ${recipientEmail}</p>
              </div>
              <p>Here's what you can do to get started:</p>
              <ul>
                <li>Complete your profile setup</li>
                <li>Explore your dashboard</li>
                <li>Join your assigned projects</li>
                <li>Set up notification preferences</li>
              </ul>
              <a href="${dashboardUrl}" class="button">Access Your Dashboard</a>
              <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
            </div>
            <div class="footer">
              <p>© 2024 Olivehaus Project Management. All rights reserved.</p>
            </div>
          </div>
        `,
        text: `Welcome to Olivehaus Project Management!\n\nHello ${recipientName},\n\nYour account has been created successfully.\n\nRole: ${role}\nEmail: ${recipientEmail}\n\nAccess your dashboard: ${dashboardUrl}\n\nWelcome aboard!`
      };

    case 'daily_digest':
      return {
        subject: 'Daily Project Digest',
        html: `
          ${baseStyle}
          <div class="container">
            <div class="header">
              <h1>Daily Digest</h1>
            </div>
            <div class="content">
              <h2>Hello ${recipientName},</h2>
              <p>Here's your daily project summary:</p>
              <div class="highlight">
                <p><strong>Projects:</strong> ${projects} active</p>
                <p><strong>Tasks Due Today:</strong> ${tasksDueToday}</p>
                <p><strong>New Messages:</strong> ${newMessages}</p>
                <p><strong>Files Uploaded:</strong> ${filesUploaded}</p>
              </div>
              <a href="${dashboardUrl}" class="button">View Dashboard</a>
              <p>Stay productive and keep your projects on track!</p>
            </div>
            <div class="footer">
              <p>© 2024 Olivehaus Project Management. All rights reserved.</p>
            </div>
          </div>
        `,
        text: `Daily Project Digest\n\nHello ${recipientName},\n\nDaily summary:\nProjects: ${projects}\nTasks Due Today: ${tasksDueToday}\nNew Messages: ${newMessages}\nFiles Uploaded: ${filesUploaded}\n\nView dashboard: ${dashboardUrl}`
      };

    case 'weekly_digest':
      return {
        subject: 'Weekly Project Digest',
        html: `
          ${baseStyle}
          <div class="container">
            <div class="header">
              <h1>Weekly Digest</h1>
            </div>
            <div class="content">
              <h2>Hello ${recipientName},</h2>
              <p>Here's your weekly project summary:</p>
              <div class="highlight">
                <p><strong>Projects:</strong> ${projects} total</p>
                <p><strong>Tasks Completed:</strong> ${tasksCompleted}</p>
                <p><strong>New Messages:</strong> ${newMessages}</p>
                <p><strong>Files Uploaded:</strong> ${filesUploaded}</p>
              </div>
              <a href="${dashboardUrl}" class="button">View Full Report</a>
              <p>Great work this week! Keep up the momentum.</p>
            </div>
            <div class="footer">
              <p>© 2024 Olivehaus Project Management. All rights reserved.</p>
            </div>
          </div>
        `,
        text: `Weekly Project Digest\n\nHello ${recipientName},\n\nWeekly summary:\nProjects: ${projects}\nTasks Completed: ${tasksCompleted}\nNew Messages: ${newMessages}\nFiles Uploaded: ${filesUploaded}\n\nView report: ${dashboardUrl}`
      };

    default:
      return {
        subject,
        html: `
          ${baseStyle}
          <div class="container">
            <div class="header">
              <h1>Notification</h1>
            </div>
            <div class="content">
              <h2>Hello ${recipientName},</h2>
              <p>${message}</p>
              ${actionUrl ? `<a href="${actionUrl}" class="button">Take Action</a>` : ''}
            </div>
            <div class="footer">
              <p>© 2024 Olivehaus Project Management. All rights reserved.</p>
            </div>
          </div>
        `,
        text: `Hello ${recipientName},\n\n${message}\n\n${actionUrl ? `Action: ${actionUrl}` : ''}`
      };
  }
};

// Send notification email with proper error handling
export const sendNotificationEmail = async (data: NotificationData): Promise<boolean> => {
  try {
    const { db } = await connectToDatabase();
    
    // Get recipient user data
    const recipient = await db.collection('users').findOne(
      { _id: new ObjectId(data.recipientId) },
      { projection: { name: 1, email: 1, emailNotifications: 1 } }
    );

    if (!recipient || !recipient.email) {
      console.log('📧 Recipient not found or no email address');
      return false;
    }

    // Check if user has email notifications enabled
    if (recipient.emailNotifications === false) {
      console.log('📧 Email notifications disabled for user');
      return false;
    }

    // Get project data if provided
    let projectData = null;
    if (data.projectId) {
      projectData = await db.collection('projects').findOne(
        { _id: new ObjectId(data.projectId) },
        { projection: { title: 1 } }
      );
    }

    // Prepare template data with proper typing
    const templateData: EmailTemplateData = {
      recipientName: recipient.name,
      recipientEmail: recipient.email,
      projectTitle: projectData?.title || 'Unknown Project',
      projectUrl: `${process.env.NEXTAUTH_URL}/client/projects/${data.projectId}`,
      taskUrl: data.taskId ? `${process.env.NEXTAUTH_URL}/client/tasks/${data.taskId}` : '',
      dashboardUrl: `${process.env.NEXTAUTH_URL}/client`,
      conversationUrl: `${process.env.NEXTAUTH_URL}/client/messages`,
      ...data.data
    };

    // Get email template
    const template = getEmailTemplate(data.type, templateData);

    // Send email
    return await sendEmail({
      to: recipient.email,
      subject: template.subject,
      html: template.html,
      text: template.text
    });

  } catch (error) {
    console.error('📧 Failed to send notification email:', error);
    return false;
  }
};

// Send welcome email to new users
export const sendWelcomeEmail = async (userId: string): Promise<boolean> => {
  try {
    const { db } = await connectToDatabase();
    
    const user = await db.collection('users').findOne(
      { _id: new ObjectId(userId) },
      { projection: { name: 1, email: 1, role: 1 } }
    );

    if (!user || !user.email) return false;

    const dashboardUrl = `${process.env.NEXTAUTH_URL}/${user.role === 'super_admin' ? 'admin' : user.role === 'project_manager' ? 'manager' : 'client'}`;

    const templateData: EmailTemplateData = {
      recipientName: user.name,
      recipientEmail: user.email,
      role: user.role,
      dashboardUrl,
      loginUrl: `${process.env.NEXTAUTH_URL}/login`
    };

    const template = getEmailTemplate('welcome', templateData);

    return await sendEmail({
      to: user.email,
      subject: 'Welcome to Olivehaus Project Management',
      html: template.html,
      text: template.text
    });

  } catch (error) {
    console.error('📧 Failed to send welcome email:', error);
    return false;
  }
};

// Send bulk emails (for announcements) with proper error handling
export const sendBulkEmail = async (
  userIds: string[],
  subject: string,
  message: string,
  actionUrl?: string
): Promise<{ sent: number; failed: number }> => {
  const { db } = await connectToDatabase();
  let sent = 0;
  let failed = 0;

  // Get users in batches to avoid memory issues
  const batchSize = 50;
  
  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize);
    const users = await db.collection('users').find(
      { 
        _id: { $in: batch.map(id => new ObjectId(id)) },
        emailNotifications: { $ne: false }
      },
      { projection: { name: 1, email: 1 } }
    ).toArray();

    const emailPromises = users.map(user => {
      const templateData: EmailTemplateData = {
        recipientName: user.name,
        message,
        actionUrl,
        subject
      };

      const template = getEmailTemplate('general', templateData);

      return sendEmail({
        to: user.email,
        subject,
        html: template.html,
        text: template.text
      });
    });

    const results = await Promise.allSettled(emailPromises);
    
    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value) {
        sent++;
      } else {
        failed++;
      }
    });

    // Add delay between batches to respect rate limits
    if (i + batchSize < userIds.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return { sent, failed };
};

// Send daily/weekly digest emails
export const sendDigestEmail = async (
  userId: string,
  period: 'daily' | 'weekly'
): Promise<boolean> => {
  try {
    const { db } = await connectToDatabase();
    
    const user = await db.collection('users').findOne(
      { _id: new ObjectId(userId) },
      { projection: { name: 1, email: 1, role: 1 } }
    );

    if (!user || !user.email) return false;

    // Get user's projects and recent activities
    const userProjects = await db.collection('projects').find({
      $or: [
        { client: new ObjectId(userId) },
        { manager: new ObjectId(userId) }
      ]
    }).toArray();

    const projectIds = userProjects.map(p => p._id);
    
    // Get recent activities based on period
    const dateThreshold = new Date();
    if (period === 'daily') {
      dateThreshold.setDate(dateThreshold.getDate() - 1);
    } else {
      dateThreshold.setDate(dateThreshold.getDate() - 7);
    }

    // Get digest statistics
    const [tasksDueToday, newMessages, filesUploaded, tasksCompleted] = await Promise.all([
      db.collection('tasks').countDocuments({
        projectId: { $in: projectIds },
        deadline: { 
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lt: new Date(new Date().setHours(23, 59, 59, 999))
        },
        status: { $ne: 'completed' }
      }),
      db.collection('messages').countDocuments({
        $or: [
          { senderId: new ObjectId(userId) },
          { recipientId: new ObjectId(userId) }
        ],
        createdAt: { $gte: dateThreshold }
      }),
      db.collection('files').countDocuments({
        projectId: { $in: projectIds },
        createdAt: { $gte: dateThreshold }
      }),
      db.collection('tasks').countDocuments({
        projectId: { $in: projectIds },
        status: 'completed',
        completedAt: { $gte: dateThreshold }
      })
    ]);

    const digestData: EmailTemplateData = {
      recipientName: user.name,
      period,
      projects: userProjects.length,
      tasksDueToday,
      newMessages,
      filesUploaded,
      tasksCompleted,
      dashboardUrl: `${process.env.NEXTAUTH_URL}/${user.role === 'super_admin' ? 'admin' : user.role === 'project_manager' ? 'manager' : 'client'}`
    };

    const template = getEmailTemplate(`${period}_digest`, digestData);

    return await sendEmail({
      to: user.email,
      subject: template.subject,
      html: template.html,
      text: template.text
    });

  } catch (error) {
    console.error(`📧 Failed to send ${period} digest email:`, error);
    return false;
  }
};