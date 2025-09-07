// Setup test users for the new role system
const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');

async function setupTestUsers() {
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const sql = neon(DATABASE_URL);

  try {
    console.log('🔧 Setting up test users for new role system...\n');

    // Hash password for all test users
    const testPassword = 'testuser123';
    const hashedPassword = await bcrypt.hash(testPassword, 10);

    // Test users to create
    const testUsers = [
      {
        name: 'Test Backstage Manager',
        email: 'backstage@test.com',
        role: 'backstage_manager'
      },
      {
        name: 'Test Announcer',
        email: 'announcer@test.com',
        role: 'announcer'
      },
      {
        name: 'Test Registration Staff',
        email: 'registration@test.com',
        role: 'registration'
      },
      {
        name: 'Test Media Personnel',
        email: 'media@test.com',
        role: 'media'
      }
    ];

    console.log('👥 Creating test users...\n');

    for (const user of testUsers) {
      const id = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const timestamp = new Date().toISOString();

      // Check if user already exists
      const existing = await sql`
        SELECT id FROM judges WHERE email = ${user.email}
      `;

      if (existing.length > 0) {
        console.log(`⚠️  User ${user.email} already exists, skipping...`);
        continue;
      }

      // Create the user
      await sql`
        INSERT INTO judges (id, name, email, password, is_admin, role, specialization, created_at)
        VALUES (${id}, ${user.name}, ${user.email}, ${hashedPassword}, false, ${user.role}, '[]', ${timestamp})
      `;

      console.log(`✅ Created ${user.role.replace('_', ' ')}: ${user.email}`);
    }

    console.log('\n🎉 Test users setup complete!\n');
    console.log('📝 Test User Credentials:');
    console.log('Password for all test users: testuser123\n');
    console.log('📧 Login Details:');
    
    testUsers.forEach(user => {
      const portalName = user.role === 'backstage_manager' ? 'backstage' : 
                        user.role === 'announcer' ? 'announcer' :
                        user.role === 'registration' ? 'registration' : 'media';
      console.log(`   • ${user.name}: ${user.email} → /portal/${portalName}`);
    });

    console.log('\n🔗 Portal URLs:');
    console.log('   • Backstage Manager: /portal/backstage');
    console.log('   • Announcer: /portal/announcer');
    console.log('   • Registration: /portal/registration');
    console.log('   • Media: /portal/media');

    console.log('\n🎯 Dashboard URLs (after login):');
    console.log('   • Backstage: /backstage-dashboard');
    console.log('   • Announcer: /announcer-dashboard');
    console.log('   • Registration: /registration-dashboard');
    console.log('   • Media: /media-dashboard');

  } catch (error) {
    console.error('❌ Error setting up test users:', error);
    process.exit(1);
  }
}

// Run the setup
setupTestUsers().then(() => {
  console.log('\n✨ Setup completed successfully!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Setup failed:', error);
  process.exit(1);
});

