// D:\Projects\Kalwanga\packages\web\scripts\set-admin-role.ts
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function setUserRole() {
  if (!process.env.CLERK_SECRET_KEY) {
    console.error('❌ CLERK_SECRET_KEY not found in environment variables');
    console.log('Please add CLERK_SECRET_KEY to packages/web/.env.local');
    return;
  }

  const email = process.argv[2] || 'lukesserugo09@gmail.com';
  const CLERK_API_KEY = process.env.CLERK_SECRET_KEY;

  try {
    console.log(`🔍 Looking for user with email: ${email}`);
    
    // Step 1: Find user by email
    const searchResponse = await fetch(
      `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}`,
      {
        headers: {
          'Authorization': `Bearer ${CLERK_API_KEY}`,
        },
      }
    );
    
    if (!searchResponse.ok) {
      throw new Error(`Failed to search users: ${searchResponse.status}`);
    }
    
    const users = await searchResponse.json();
    
    if (!users || users.length === 0) {
      console.log('❌ User not found. Please check the email address.');
      console.log(`📧 Email searched: ${email}`);
      return;
    }
    
    const user = users[0];
    console.log(`✅ Found user: ${user.email_addresses[0].email_address}`);
    console.log(`📝 Current role: ${user.public_metadata?.role || 'No role set'}`);
    console.log(`📝 Current metadata:`, user.public_metadata);
    
    // Step 2: Update user metadata
    console.log('🔄 Updating role to SUPER_ADMIN...');
    
    const updateResponse = await fetch(
      `https://api.clerk.com/v1/users/${user.id}/metadata`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${CLERK_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          public_metadata: {
            ...user.public_metadata,
            role: 'SUPER_ADMIN',
          },
        }),
      }
    );
    
    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`Failed to update user: ${updateResponse.status} - ${errorText}`);
    }
    
    const updatedUser = await updateResponse.json();
    console.log(`✅ User updated to SUPER_ADMIN`);
    console.log('📝 Updated metadata:', updatedUser.public_metadata);
    console.log('\n🎉 Role update complete! Please sign out and sign back in to see the changes.');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

setUserRole();
