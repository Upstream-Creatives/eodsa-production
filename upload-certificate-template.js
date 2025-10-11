// Upload certificate template to Cloudinary
require('dotenv').config({ path: '.env.local' });
const cloudinary = require('cloudinary').v2;
const path = require('path');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.log('Cloud Name:', process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME);
console.log('API Key:', process.env.CLOUDINARY_API_KEY ? '***' + process.env.CLOUDINARY_API_KEY.slice(-4) : 'NOT SET');
async function uploadTemplate() {
  try {
    console.log('📤 Uploading certificate template to Cloudinary...');
    
    const templatePath = path.join(__dirname, 'public', 'Template.jpg');
    
    const result = await cloudinary.uploader.upload(templatePath, {
      public_id: 'certificate-template',
      folder: '',
      resource_type: 'image',
      overwrite: true
    });

    console.log('✅ Template uploaded successfully!');
    console.log(`   Public ID: ${result.public_id}`);
    console.log(`   URL: ${result.secure_url}`);
    console.log(`   Width: ${result.width}px`);
    console.log(`   Height: ${result.height}px`);
    
  } catch (error) {
    console.error('❌ Error uploading template:', error);
  }
}

uploadTemplate();

