// Test script for studio forgot password functionality
const testStudioForgotPassword = async () => {
  console.log('🧪 Testing Studio Forgot Password API...\n');
  
  // Test with a sample email (you can replace this with an actual studio email from your database)
  const testEmail = 'test@example.com';
  
  try {
    console.log(`📧 Testing with email: ${testEmail}`);
    
    const response = await fetch('http://localhost:3000/api/auth/studio-forgot-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: testEmail
      }),
    });

    const data = await response.json();
    
    console.log(`📊 Response Status: ${response.status}`);
    console.log(`📋 Response Data:`, JSON.stringify(data, null, 2));
    
    if (data.success) {
      console.log('✅ Studio forgot password API is working correctly!');
    } else {
      console.log('❌ API returned an error:', data.error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n💡 Make sure the development server is running on http://localhost:3000');
  }
};

// Run the test
testStudioForgotPassword();
