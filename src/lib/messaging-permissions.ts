// src/lib/messaging-permissions.ts
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/db';

export interface MessagePermissionData {
  userId: string;
  userRole: string;
  recipientId: string;
  projectId?: string;
}

/**
 * Validates if a user can send a message to another user based on role-based rules
 * Super Admin: Can message anyone
 * Project Manager: Can message clients assigned to them + super admin
 * Client: Can message their project manager + respond to super admin
 */
export async function validateMessagePermission(
  senderId: string,
  senderRole: string,
  recipientId: string,
  _projectId?: string
): Promise<boolean> {
  if (senderId === recipientId) {
    return false; // Cannot message yourself
  }

  try {
    const { db } = await connectToDatabase();

    // Get recipient details
    const recipient = await db.collection('users').findOne(
      { _id: new ObjectId(recipientId) },
      { projection: { role: 1, isActive: 1 } }
    );

    if (!recipient || !recipient.isActive) {
      return false;
    }

    const recipientRole = recipient.role;

    // Super admin can message anyone
    if (senderRole === 'super_admin') {
      return true;
    }

    // Anyone can message super admin
    if (recipientRole === 'super_admin') {
      return true;
    }

    // Project manager messaging rules
    if (senderRole === 'project_manager') {
      // Can message clients assigned to them
      if (recipientRole === 'client') {
        const hasSharedProject = await db.collection('projects').findOne({
          manager: new ObjectId(senderId),
          client: new ObjectId(recipientId)
        });
        return !!hasSharedProject;
      }
      return false;
    }

    // Client messaging rules
    if (senderRole === 'client') {
      // Can message their project manager
      if (recipientRole === 'project_manager') {
        const hasSharedProject = await db.collection('projects').findOne({
          client: new ObjectId(senderId),
          manager: new ObjectId(recipientId)
        });
        return !!hasSharedProject;
      }
      return false;
    }

    return false;
  } catch (error) {
    console.error('Error validating message permission:', error);
    return false;
  }
}

export async function getAvailableContacts(userId: string, userRole: string) {
  try {
    const { db } = await connectToDatabase();
    const contacts = [];

    if (userRole === 'super_admin') {
      // Super admin can message all active users
      const allUsers = await db.collection('users')
        .find(
          { 
            _id: { $ne: new ObjectId(userId) },
            isActive: true 
          },
          { projection: { name: 1, email: 1, role: 1 } }
        )
        .toArray();
      
      contacts.push(...allUsers.map(user => ({
        _id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role
      })));
    } else if (userRole === 'project_manager') {
      // Get assigned clients + super admins
      const projects = await db.collection('projects')
        .find({ manager: new ObjectId(userId) })
        .toArray();
      
      const clientIds = projects.map(p => p.client);
      const clients = await db.collection('users')
        .find(
          { 
            _id: { $in: clientIds },
            isActive: true 
          },
          { projection: { name: 1, email: 1, role: 1 } }
        )
        .toArray();

      const superAdmins = await db.collection('users')
        .find(
          { 
            role: 'super_admin',
            isActive: true 
          },
          { projection: { name: 1, email: 1, role: 1 } }
        )
        .toArray();

      contacts.push(
        ...clients.map(user => ({
          _id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role
        })),
        ...superAdmins.map(user => ({
          _id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role
        }))
      );
    } else if (userRole === 'client') {
      // Get assigned project managers + super admins
      const projects = await db.collection('projects')
        .find({ client: new ObjectId(userId) })
        .toArray();
      
      const managerIds = projects.map(p => p.manager);
      const managers = await db.collection('users')
        .find(
          { 
            _id: { $in: managerIds },
            isActive: true 
          },
          { projection: { name: 1, email: 1, role: 1 } }
        )
        .toArray();

      const superAdmins = await db.collection('users')
        .find(
          { 
            role: 'super_admin',
            isActive: true 
          },
          { projection: { name: 1, email: 1, role: 1 } }
        )
        .toArray();

      contacts.push(
        ...managers.map(user => ({
          _id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role
        })),
        ...superAdmins.map(user => ({
          _id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role
        }))
      );
    }

    // Remove duplicates based on _id
    const uniqueContacts = contacts.filter((contact, index, self) => 
      index === self.findIndex(c => c._id === contact._id)
    );

    return uniqueContacts;
  } catch (error) {
    console.error('Error getting available contacts:', error);
    return [];
  }
}