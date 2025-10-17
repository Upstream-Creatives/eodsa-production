// Test script for studio forgot password functionality
const testStudioForgotPassword = async () => {
  console.log('🧪 Testing Studio Forgot Password API...\n');
  
  // First, let's create a test studio
  console.log('📝 Creating test studio...');
  
  const testStudio = {
    name: 'Test Dance Studio',
    email: 'teststudio@example.com',
    password: 'testpassword123',
    contactPerson: 'John Doe',
    address: '123 Test Street, Test City',
    phone: '0123456789'
  };
  
  try {
    // Create studio
    const createResponse = await fetch('http://localhost:3000/api/auth/studio-register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testStudio),
    });

    const createData = await createResponse.json();
    console.log(`📊 Create Studio Response Status: ${createResponse.status}`);
    console.log(`📋 Create Studio Response Data:`, JSON.stringify(createData, null, 2));
    
    if (createData.success) {
      console.log('✅ Test studio created successfully!');
      
      // Now test the forgot password functionality
      console.log('\n🔐 Testing forgot password functionality...');
      
      const forgotResponse = await fetch('http://localhost:3000/api/auth/studio-forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: testStudio.email
        }),
      });

      const forgotData = await forgotResponse.json();
      
      console.log(`📊 Forgot Password Response Status: ${forgotResponse.status}`);
      console.log(`📋 Forgot Password Response Data:`, JSON.stringify(forgotData, null, 2));
      
      if (forgotData.success) {
        console.log('✅ Studio forgot password API is working correctly!');
        console.log('📧 Password should have been sent to:', testStudio.email);
      } else {
        console.log('❌ Forgot password API returned an error:', forgotData.error);
      }
      
    } else {
      console.log('❌ Failed to create test studio:', createData.error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n💡 Make sure the development server is running on http://localhost:3000');
  }
};

// Run the test
testStudioForgotPassword();
