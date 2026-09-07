// scripts/sync-env.js
const fs = require('fs');
const path = require('path');

// Read root .env
const rootEnvPath = path.join(__dirname, '..', '.env');
const rootEnv = fs.readFileSync(rootEnvPath, 'utf8');

// Parse root .env
const envVars = {};
rootEnv.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

// Packages that need .env files
const packages = ['backend', 'web', 'mobile', 'desktop'];

packages.forEach(pkg => {
  const pkgPath = path.join(__dirname, '..', 'packages', pkg, '.env');
  const isBackend = pkg === 'backend';
  const isWeb = pkg === 'web';
  const isMobile = pkg === 'mobile';
  const isDesktop = pkg === 'desktop';
  
  let content = '';
  
  if (isBackend) {
    content = `DATABASE_URL=${envVars.DATABASE_URL}
CLERK_SECRET_KEY=${envVars.CLERK_SECRET_KEY}
STRIPE_SECRET_KEY=${envVars.STRIPE_SECRET_KEY}
JWT_SECRET=${envVars.JWT_SECRET}
PORT=3001
NODE_ENV=${envVars.NODE_ENV}
`;
  } else if (isWeb) {
    content = `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${envVars.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
CLERK_SECRET_KEY=${envVars.CLERK_SECRET_KEY}
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
NEXT_PUBLIC_API_URL=${envVars.EXPO_PUBLIC_API_URL}
`;
  } else if (isMobile) {
    content = `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=${envVars.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY}
EXPO_PUBLIC_API_URL=${envVars.EXPO_PUBLIC_API_URL}
EXPO_PUBLIC_APP_NAME=${envVars.EXPO_PUBLIC_APP_NAME}
`;
  } else if (isDesktop) {
    content = `CLERK_SECRET_KEY=${envVars.CLERK_SECRET_KEY}
API_URL=${envVars.BACKEND_URL}
WS_URL=ws://localhost:3001
NODE_ENV=${envVars.NODE_ENV}
`;
  }
  
  fs.writeFileSync(pkgPath, content);
  console.log(`✅ Generated ${pkg}/.env`);
});

console.log('✅ All .env files synced successfully!');
