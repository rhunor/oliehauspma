// src/lib/auth.ts
import { NextAuthOptions, Session } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { connectToDatabase, withRetry } from './db';
import { UserRole } from '@/types';
import { ObjectId } from 'mongodb';

// Extend the built-in session types
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: UserRole;
      avatar?: string;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    avatar?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: UserRole;
    id: string;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Please enter your email and password');
        }

        try {
          // Use retry mechanism for database operations
          return await withRetry(async () => {
            const { db } = await connectToDatabase();
            
            const user = await db.collection('users').findOne({
              email: credentials.email.toLowerCase(),
            });

            if (!user) {
              throw new Error('No user found with this email');
            }

            if (!user.isActive) {
              throw new Error('Your account has been deactivated. Please contact support.');
            }

            const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

            if (!isPasswordValid) {
              throw new Error('Invalid password');
            }

            // Update last login with retry
            await db.collection('users').updateOne(
              { _id: user._id },
              { 
                $set: { 
                  lastLogin: new Date(),
                  updatedAt: new Date(),
                } 
              }
            );

            return {
              id: user._id.toString(),
              email: user.email,
              name: user.name,
              role: user.role,
              avatar: user.avatar,
            };
          }, 3, 2000); // 3 retries with 2 second delay
          
        } catch (error: unknown) {
          console.error('Authentication error:', error);
          
          // Provide user-friendly error messages
          if (error instanceof Error) {
            if (error.message.includes('Server selection timed out')) {
              throw new Error('Database connection temporarily unavailable. Please try again.');
            }
            if (error.message.includes('MongoServerSelectionError')) {
              throw new Error('Unable to connect to database. Please try again in a moment.');
            }
          }
          
          throw error;
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  jwt: {
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

export async function createUser(userData: {
  email: string;
  name: string;
  password: string;
  role: UserRole;
  phone?: string;
}) {
  try {
    return await withRetry(async () => {
      const { db } = await connectToDatabase();

      const existingUser = await db.collection('users').findOne({
        email: userData.email.toLowerCase(),
      });

      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      const hashedPassword = await hashPassword(userData.password);

      const newUser = {
        email: userData.email.toLowerCase(),
        name: userData.name.trim(),
        password: hashedPassword,
        role: userData.role,
        phone: userData.phone?.trim(),
        avatar: null,
        isActive: true,
        lastLogin: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await db.collection('users').insertOne(newUser);

      return {
        id: result.insertedId.toString(),
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        phone: newUser.phone,
      };
    });
  } catch (error: unknown) {
    console.error('Error creating user:', error);
    throw error;
  }
}

export async function getUserById(userId: string) {
  try {
    return await withRetry(async () => {
      const { db } = await connectToDatabase();

      const user = await db.collection('users').findOne(
        { _id: new ObjectId(userId) },
        { projection: { password: 0 } }
      );

      return user;
    });
  } catch (error: unknown) {
    console.error('Error getting user by ID:', error);
    throw error;
  }
}

export async function updateUserProfile(userId: string, updates: {
  name?: string;
  email?: string;
  phone?: string;
  avatar?: string;
}) {
  try {
    return await withRetry(async () => {
      const { db } = await connectToDatabase();

      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (updates.name) updateData.name = updates.name.trim();
      if (updates.email) updateData.email = updates.email.toLowerCase();
      if (updates.phone) updateData.phone = updates.phone.trim();
      if (updates.avatar !== undefined) updateData.avatar = updates.avatar;

      const result = await db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        { $set: updateData }
      );

      if (result.matchedCount === 0) {
        throw new Error('User not found');
      }

      return result;
    });
  } catch (error: unknown) {
    console.error('Error updating user profile:', error);
    throw error;
  }
}

export async function changeUserPassword(
  userId: string,
  currentPassword: string,
  newPassword: string
) {
  try {
    return await withRetry(async () => {
      const { db } = await connectToDatabase();

      const user = await db.collection('users').findOne({
        _id: new ObjectId(userId),
      });

      if (!user) {
        throw new Error('User not found');
      }

      const isCurrentPasswordValid = await verifyPassword(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        throw new Error('Current password is incorrect');
      }

      const hashedNewPassword = await hashPassword(newPassword);

      const result = await db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: {
            password: hashedNewPassword,
            updatedAt: new Date(),
          },
        }
      );

      return result;
    });
  } catch (error: unknown) {
    console.error('Error changing password:', error);
    throw error;
  }
}

export async function deactivateUser(userId: string) {
  try {
    return await withRetry(async () => {
      const { db } = await connectToDatabase();

      const result = await db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: {
            isActive: false,
            updatedAt: new Date(),
          },
        }
      );

      return result;
    });
  } catch (error: unknown) {
    console.error('Error deactivating user:', error);
    throw error;
  }
}

export async function reactivateUser(userId: string) {
  try {
    return await withRetry(async () => {
      const { db } = await connectToDatabase();

      const result = await db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: {
            isActive: true,
            updatedAt: new Date(),
          },
        }
      );

      return result;
    });
  } catch (error: unknown) {
    console.error('Error reactivating user:', error);
    throw error;
  }
}

export async function getUsers(options: {
  page?: number;
  limit?: number;
  role?: UserRole;
  search?: string;
  isActive?: boolean;
} = {}) {
  try {
    return await withRetry(async () => {
      const { db } = await connectToDatabase();
      
      const {
        page = 1,
        limit = 10,
        role,
        search,
        isActive,
      } = options;

      const filter: Record<string, unknown> = {};
      
      if (role) filter.role = role;
      if (isActive !== undefined) filter.isActive = isActive;
      
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
        ];
      }

      const total = await db.collection('users').countDocuments(filter);
      
      const users = await db.collection('users')
        .find(filter, { projection: { password: 0 } })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray();

      const totalPages = Math.ceil(total / limit);

      return {
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    });
  } catch (error: unknown) {
    console.error('Error getting users:', error);
    throw error;
  }
}

export function hasPermission(userRole: UserRole, requiredRole: UserRole): boolean {
  const roleHierarchy: Record<UserRole, number> = {
    client: 1,
    project_manager: 2,
    super_admin: 3,
  };

  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

export function canAccessProject(
  userRole: UserRole,
  userId: string,
  project: {
    client: string;
    manager: string;
  }
): boolean {
  if (userRole === 'super_admin') return true;
  if (userRole === 'project_manager' && project.manager === userId) return true;
  if (userRole === 'client' && project.client === userId) return true;
  return false;
}

export function canManageUsers(userRole: UserRole): boolean {
  return userRole === 'super_admin';
}

export function canCreateProjects(userRole: UserRole): boolean {
  return userRole === 'super_admin';
}

export function canManageTasks(
  userRole: UserRole,
  userId: string,
  projectManagerId: string
): boolean {
  if (userRole === 'super_admin') return true;
  if (userRole === 'project_manager' && userId === projectManagerId) return true;
  return false;
}

export function isAuthenticated(session: Session | null): session is Session {
  return !!session?.user;
}

export function isSuperAdmin(session: Session | null): boolean {
  return session?.user?.role === 'super_admin';
}

export function isProjectManager(session: Session | null): boolean {
  return session?.user?.role === 'project_manager';
}

export function isClient(session: Session | null): boolean {
  return session?.user?.role === 'client';
}

export async function generateSecureToken(length: number = 32): Promise<string> {
  if (typeof window !== 'undefined') {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  } else {
    const { randomBytes } = await import('crypto');
    return randomBytes(length).toString('hex');
  }
}

export function validatePasswordStrength(password: string): {
  isValid: boolean;
  errors: string[];
  score: number;
} {
  const errors: string[] = [];
  let score = 0;

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  } else {
    score += 1;
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  } else {
    score += 1;
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  } else {
    score += 1;
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  } else {
    score += 1;
  }

  if (!/[@$!%*?&]/.test(password)) {
    errors.push('Password must contain at least one special character (@$!%*?&)');
  } else {
    score += 1;
  }

  return {
    isValid: errors.length === 0,
    errors,
    score,
  };
}