// D:\Projects\Kalwanga\packages\web\services\userManagementService.ts

import { userService } from './userService';
import { businessUnitService } from './businessUnitService';
import { userGroupService } from './userGroupService';
import { userInvitationService } from './userInvitationService';
import { userActivityService } from './userActivityService';
import { UserRole } from '../types/enums';
import { User } from '../types/user';

export interface CreateUserData {
  // Required
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  password: string;
  
  // Optional
  phoneNumber?: string;
  isActive?: boolean;
  permissions?: string[];
  businessUnitId?: string;
  groupId?: string;
  sendInvitation?: boolean;
  companyId?: string;
}

export interface CreateUserResult {
  user: User;
  permissionsUpdated: boolean;
  businessUnitAssigned: boolean;
  groupAssigned: boolean;
  invitationSent: boolean;
  activityLogged: boolean;
}

/**
 * User Management Service - Orchestrates all user operations
 * Routes data to the correct API endpoints
 */
export const userManagementService = {
  /**
   * Create user with all related data
   * 
   * ✅ Routes:
   *   1. POST /users (userService.createUser) - Generates clerkId if needed
   *   2. PATCH /users/:id/permissions (userService.updateUserPermissions)
   *   3. POST /business-units/:id/users (businessUnitService.addUserToBusinessUnit)
   *   4. POST /user-groups/:id/users (userGroupService.assignUsersToGroup)
   *   5. POST /users/invite (userInvitationService.inviteUser)
   *   6. POST /activities (userActivityService.createActivity)
   */
  async createUser(data: CreateUserData): Promise<CreateUserResult> {
    const result: CreateUserResult = {
      user: null as any,
      permissionsUpdated: false,
      businessUnitAssigned: false,
      groupAssigned: false,
      invitationSent: false,
      activityLogged: false,
    };

    try {
      // ============================================
      // STEP 1: Create user (POST /users)
      // CRITICAL: Pass all necessary data to userService.createUser
      // ============================================
      console.log('🔍 Starting user creation process...');
      console.log('🔍 Input data:', {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        phoneNumber: data.phoneNumber,
        isActive: data.isActive,
        permissions: data.permissions,
        businessUnitId: data.businessUnitId,
        groupId: data.groupId,
        sendInvitation: data.sendInvitation,
        companyId: data.companyId,
      });

      // Build the user creation payload
      const userPayload: any = {
        email: data.email.trim().toLowerCase(),
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        role: data.role,
        password: data.password,
        isActive: data.isActive ?? true,
      };

      // Only add optional fields if they have values
      if (data.phoneNumber && data.phoneNumber.trim()) {
        userPayload.phoneNumber = data.phoneNumber.trim();
      }
      
      if (data.companyId) {
        userPayload.companyId = data.companyId;
      }
      
      if (data.businessUnitId) {
        userPayload.businessUnitId = data.businessUnitId;
      }
      
      if (data.permissions && data.permissions.length > 0) {
        userPayload.permissions = data.permissions;
      }

      console.log('📤 Creating user with payload:', {
        ...userPayload,
        password: userPayload.password ? '***' : undefined,
      });

      const user = await userService.createUser(userPayload);

      result.user = user;
      console.log('✅ Step 1: User created with clerkId:', user.clerkId);

      // ============================================
      // STEP 2: Update permissions (PATCH /users/:id/permissions)
      // Only if permissions were NOT included in the create call
      // ============================================
      if (data.permissions && data.permissions.length > 0 && !userPayload.permissions) {
        try {
          await userService.updateUserPermissions(user.id, data.permissions);
          result.permissionsUpdated = true;
          console.log('✅ Step 2: Permissions updated:', data.permissions.length);
        } catch (error) {
          console.warn('⚠️ Failed to update permissions:', error);
        }
      } else if (data.permissions && data.permissions.length > 0) {
        // Permissions were already included in the create call
        result.permissionsUpdated = true;
        console.log('✅ Step 2: Permissions already included in create call');
      }

      // ============================================
      // STEP 3: Assign Business Unit (POST /business-units/:id/users)
      // ============================================
      if (data.businessUnitId) {
        try {
          await businessUnitService.addUserToBusinessUnit(
            data.businessUnitId,
            user.id,
            data.role
          );
          result.businessUnitAssigned = true;
          console.log('✅ Step 3: Business unit assigned');
        } catch (error) {
          console.warn('⚠️ Failed to assign business unit:', error);
        }
      }

      // ============================================
      // STEP 4: Assign Group (POST /user-groups/:id/users)
      // ============================================
      if (data.groupId) {
        try {
          await userGroupService.assignUsersToGroup(data.groupId, [user.id]);
          result.groupAssigned = true;
          console.log('✅ Step 4: Group assigned');
        } catch (error) {
          console.warn('⚠️ Failed to assign group:', error);
        }
      }

      // ============================================
      // STEP 5: Send Invitation (POST /users/invite)
      // ============================================
      if (data.sendInvitation) {
        try {
          await userInvitationService.inviteUser(data.email, data.role, {
            businessUnitId: data.businessUnitId,
            message: `Welcome! You've been assigned as ${data.role.replace(/_/g, ' ')}.`,
          });
          result.invitationSent = true;
          console.log('✅ Step 5: Invitation sent');
        } catch (error) {
          console.warn('⚠️ Failed to send invitation:', error);
        }
      }

      // ============================================
      // STEP 6: Log Activity (POST /activities)
      // ============================================
      try {
        await userActivityService.createActivity({
          userId: user.id,
          action: 'CREATE',
          description: `User ${data.email} created with role ${data.role}`,
          resource: 'USER',
          resourceId: user.id,
          metadata: {
            role: data.role,
            businessUnitId: data.businessUnitId,
            groupId: data.groupId,
            invitationSent: data.sendInvitation,
            permissionsCount: data.permissions?.length || 0,
            clerkId: user.clerkId,
          },
        });
        result.activityLogged = true;
        console.log('✅ Step 6: Activity logged');
      } catch (error) {
        console.warn('⚠️ Failed to log activity:', error);
      }

      console.log('✅ User creation completed successfully');
      return result;
    } catch (error: any) {
      console.error('❌ Failed to create user:', error);
      throw error;
    }
  },

  /**
   * Update user with related data
   */
  async updateUser(
    userId: string,
    data: Partial<CreateUserData>
  ): Promise<CreateUserResult> {
    const result: CreateUserResult = {
      user: null as any,
      permissionsUpdated: false,
      businessUnitAssigned: false,
      groupAssigned: false,
      invitationSent: false,
      activityLogged: false,
    };

    try {
      // ============================================
      // STEP 1: Update user (PUT /users/:id)
      // ============================================
      const userUpdateData: any = {};
      
      if (data.email !== undefined) userUpdateData.email = data.email.trim().toLowerCase();
      if (data.firstName !== undefined) userUpdateData.firstName = data.firstName.trim();
      if (data.lastName !== undefined) userUpdateData.lastName = data.lastName.trim();
      if (data.phoneNumber !== undefined) userUpdateData.phoneNumber = data.phoneNumber.trim();
      if (data.role !== undefined) userUpdateData.role = data.role;
      if (data.isActive !== undefined) userUpdateData.isActive = data.isActive;
      if (data.companyId !== undefined) userUpdateData.companyId = data.companyId;
      
      const user = await userService.updateUser(userId, userUpdateData);
      result.user = user;
      console.log('✅ Step 1: User updated');

      // ============================================
      // STEP 2: Update permissions if provided
      // ============================================
      if (data.permissions) {
        try {
          await userService.updateUserPermissions(userId, data.permissions);
          result.permissionsUpdated = true;
          console.log('✅ Step 2: Permissions updated');
        } catch (error) {
          console.warn('⚠️ Failed to update permissions:', error);
        }
      }

      // ============================================
      // STEP 3: Update Business Unit
      // ============================================
      if (data.businessUnitId) {
        try {
          await businessUnitService.addUserToBusinessUnit(
            data.businessUnitId,
            userId,
            data.role || user.role
          );
          result.businessUnitAssigned = true;
          console.log('✅ Step 3: Business unit updated');
        } catch (error) {
          console.warn('⚠️ Failed to update business unit:', error);
        }
      }

      // ============================================
      // STEP 4: Update Group
      // ============================================
      if (data.groupId) {
        try {
          await userGroupService.assignUsersToGroup(data.groupId, [userId]);
          result.groupAssigned = true;
          console.log('✅ Step 4: Group updated');
        } catch (error) {
          console.warn('⚠️ Failed to update group:', error);
        }
      }

      // ============================================
      // STEP 5: Log Activity
      // ============================================
      try {
        await userActivityService.createActivity({
          userId,
          action: 'UPDATE',
          description: `User ${user.email} updated`,
          resource: 'USER',
          resourceId: userId,
          metadata: {
            changes: Object.keys(userUpdateData).filter(key => key !== 'password'),
          },
        });
        result.activityLogged = true;
        console.log('✅ Step 5: Activity logged');
      } catch (error) {
        console.warn('⚠️ Failed to log activity:', error);
      }

      return result;
    } catch (error: any) {
      console.error(`❌ Failed to update user ${userId}:`, error);
      throw error;
    }
  },

  /**
   * Delete user with cleanup
   */
  async deleteUser(userId: string): Promise<{ message: string }> {
    try {
      const user = await userService.getUserById(userId);
      const result = await userService.deleteUser(userId);
      
      try {
        await userActivityService.createActivity({
          userId,
          action: 'DELETE',
          description: `User ${user.email} deleted`,
          resource: 'USER',
          resourceId: userId,
        });
      } catch (error) {
        console.warn('⚠️ Failed to log deletion:', error);
      }
      
      return result;
    } catch (error: any) {
      console.error(`❌ Failed to delete user ${userId}:`, error);
      throw error;
    }
  },

  /**
   * Get user with all related data
   */
  async getUserWithRelations(userId: string): Promise<{
    user: User;
    businessUnits: any[];
    groups: any[];
    activities: any[];
  }> {
    try {
      const [user, businessUnits, groups, activities] = await Promise.all([
        userService.getUserById(userId),
        businessUnitService.getBusinessUnitUsers(userId),
        userGroupService.getGroupMembers(userId),
        userActivityService.getUserActivity(userId, { limit: 10 }),
      ]);

      return {
        user,
        businessUnits: businessUnits || [],
        groups: groups?.data || [],
        activities: activities?.data || [],
      };
    } catch (error: any) {
      console.error(`❌ Failed to get user with relations ${userId}:`, error);
      throw error;
    }
  },
};

export default userManagementService;
