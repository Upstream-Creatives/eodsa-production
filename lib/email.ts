import nodemailer from 'nodemailer';

// Email configuration from environment variables
const EMAIL_CONFIG = {
  host: process.env.SMTP_HOST || 'mail.upstreamcreatives.co.za',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || 'devops@upstreamcreatives.co.za',
    pass: process.env.SMTP_PASSWORD || ''
  },
  tls: {
    rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED !== 'true' // Accept self-signed certificates by default
  }
};

// Validate required email configuration
if (!process.env.SMTP_PASSWORD && !process.env.SMTP_USER) {
  console.warn('⚠️  Email configuration incomplete. SMTP_PASSWORD and SMTP_USER should be set in .env.local');
}

// Create transporter
const transporter = nodemailer.createTransport(EMAIL_CONFIG);

// Email templates
export const emailTemplates = {
  // Individual dancer registration confirmation
  dancerRegistration: (name: string, eodsaId: string) => ({
    subject: 'Welcome to Avalon - Registration Successful!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to Avalon!</h1>
          <p style="color: #f0f0f0; margin: 10px 0 0 0; font-size: 16px;">Avalon</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
          <h2 style="color: #333; margin: 0 0 20px 0;">🎉 Registration Successful!</h2>
          
          <p style="color: #555; font-size: 16px; line-height: 1.6;">
            Hello <strong>${name}</strong>,
          </p>
          
          <p style="color: #555; font-size: 16px; line-height: 1.6;">
            Congratulations! Your registration with Avalon has been completed successfully.
          </p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; margin: 20px 0;">
            <h3 style="color: #667eea; margin: 0 0 15px 0;">Your EODSA Details:</h3>
            <p style="margin: 5px 0; color: #333;"><strong>EODSA ID:</strong> ${eodsaId}</p>
            <p style="margin: 5px 0; color: #333;"><strong>Name:</strong> ${name}</p>
          </div>
          
          <div style="background: #d1fae5; padding: 15px; border-radius: 8px; border-left: 4px solid #10b981; margin: 20px 0;">
            <p style="color: #065f46; margin: 0; font-size: 16px; font-weight: bold;">
              ✅ Your dancer registration is now active! You can immediately start participating in competitions.
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dancer-dashboard?eodsaId=${eodsaId}" 
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">
              Access Your Dashboard
            </a>
          </div>
          
          <p style="color: #777; font-size: 14px; text-align: center; margin-top: 30px; border-top: 1px solid #e9ecef; padding-top: 20px;">
            Need help? Contact us at <a href="mailto:Mains@elementscentral.com" style="color: #667eea;">Mains@elementscentral.com</a>
          </p>
        </div>
      </div>
    `
  }),

  // Studio registration confirmation
  studioRegistration: (studioName: string, contactPerson: string, registrationNumber: string, email: string) => ({
    subject: 'Avalon Studio Registration Successful!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">🏢 Studio Registration Successful!</h1>
          <p style="color: #f0f0f0; margin: 10px 0 0 0; font-size: 16px;">Avalon</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
          <h2 style="color: #333; margin: 0 0 20px 0;">Welcome to Avalon!</h2>
          
          <p style="color: #555; font-size: 16px; line-height: 1.6;">
            Hello <strong>${contactPerson}</strong>,
          </p>
          
          <p style="color: #555; font-size: 16px; line-height: 1.6;">
            Your dance studio <strong>${studioName}</strong> has been successfully registered with EODSA!
          </p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; margin: 20px 0;">
            <h3 style="color: #667eea; margin: 0 0 15px 0;">Studio Details:</h3>
            <p style="margin: 5px 0; color: #333;"><strong>Studio Name:</strong> ${studioName}</p>
            <p style="margin: 5px 0; color: #333;"><strong>Registration Number:</strong> ${registrationNumber}</p>
            <p style="margin: 5px 0; color: #333;"><strong>Contact Person:</strong> ${contactPerson}</p>
            <p style="margin: 5px 0; color: #333;"><strong>Email:</strong> ${email}</p>
          </div>
          
          <h3 style="color: #333; margin: 25px 0 15px 0;">Getting Started:</h3>
          <ul style="color: #555; line-height: 1.8;">
            <li>Log in to your studio dashboard to manage dancers</li>
            <li>Add your dancers with their details and waivers</li>
            <li>Register dancers for competitions across all regions</li>
            <li>Track your dancers' progress and results</li>
          </ul>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/studio-login" 
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">
              Login to Studio Dashboard
            </a>
          </div>
          
          <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; border-left: 4px solid #2196f3; margin: 20px 0;">
            <p style="color: #0d47a1; margin: 0; font-size: 14px;">
              <strong>📧 Login Details:</strong> Use your email address (${email}) and the password you created during registration.
            </p>
          </div>
          
          <p style="color: #777; font-size: 14px; text-align: center; margin-top: 30px; border-top: 1px solid #e9ecef; padding-top: 20px;">
            Need help? Contact us at <a href="mailto:Mains@elementscentral.com" style="color: #667eea;">Mains@elementscentral.com</a>
          </p>
        </div>
      </div>
    `
  }),

  // Dancer approval notification
  dancerApproval: (name: string, eodsaId: string) => ({
    subject: 'EODSA Registration Approved - You Can Now Compete!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Registration Approved!</h1>
          <p style="color: #f0f0f0; margin: 10px 0 0 0; font-size: 16px;">You can now enter competitions</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
          <h2 style="color: #333; margin: 0 0 20px 0;">Congratulations ${name}!</h2>
          
          <p style="color: #555; font-size: 16px; line-height: 1.6;">
            Great news! Your EODSA registration has been approved by our administrators. You can now participate in competitions across all regions.
          </p>
          
          <div style="background: #d1fae5; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981; margin: 20px 0;">
            <h3 style="color: #065f46; margin: 0 0 15px 0;">Your EODSA ID: ${eodsaId}</h3>
            <p style="margin: 0; color: #065f46;">Use this ID to access the event dashboard and register for competitions.</p>
          </div>
          
          <h3 style="color: #333; margin: 25px 0 15px 0;">Ready to Compete:</h3>
          <ul style="color: #555; line-height: 1.8;">
            <li>Browse available competitions in Gauteng, Free State, and Mpumalanga</li>
            <li>Register for Solo, Duet, Trio, or Group performances</li>
            <li>Choose your mastery level and dance style</li>
            <li>Submit your entries with choreographer details</li>
          </ul>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/event-dashboard?eodsaId=${eodsaId}" 
               style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">
              Enter Event Dashboard
            </a>
          </div>
          
          <p style="color: #777; font-size: 14px; text-align: center; margin-top: 30px; border-top: 1px solid #e9ecef; padding-top: 20px;">
            Questions? Contact us at <a href="mailto:Mains@elementscentral.com" style="color: #10b981;">Mains@elementscentral.com</a>
          </p>
        </div>
      </div>
    `
  }),

  // Dancer rejection notification
  dancerRejection: (name: string, eodsaId: string, rejectionReason: string) => ({
    subject: 'EODSA Registration Update - Additional Information Required',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">📋 Registration Update</h1>
          <p style="color: #fef3c7; margin: 10px 0 0 0; font-size: 16px;">Additional information required</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
          <h2 style="color: #333; margin: 0 0 20px 0;">Hello ${name},</h2>
          
          <p style="color: #555; font-size: 16px; line-height: 1.6;">
            Thank you for your interest in registering with Avalon. We have reviewed your application and require some additional information before we can proceed.
          </p>
          
          <div style="background: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0;">
            <h3 style="color: #92400e; margin: 0 0 15px 0;">Registration Details:</h3>
            <p style="margin: 5px 0; color: #92400e;"><strong>EODSA ID:</strong> ${eodsaId}</p>
            <p style="margin: 5px 0; color: #92400e;"><strong>Name:</strong> ${name}</p>
            <p style="margin: 5px 0; color: #92400e;"><strong>Status:</strong> Additional Information Required</p>
          </div>
          
          <div style="background: #fef2f2; padding: 20px; border-radius: 8px; border-left: 4px solid #ef4444; margin: 20px 0;">
            <h3 style="color: #dc2626; margin: 0 0 15px 0;">Required Information:</h3>
            <p style="margin: 0; color: #dc2626; font-size: 16px; line-height: 1.6;">${rejectionReason}</p>
          </div>
          
          <h3 style="color: #333; margin: 25px 0 15px 0;">Next Steps:</h3>
          <ul style="color: #555; line-height: 1.8;">
            <li>Please review the required information above</li>
            <li>Submit a new registration with the correct details</li>
            <li>Contact us if you need clarification on any requirements</li>
            <li>Once resolved, you'll be able to participate in competitions</li>
          </ul>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/register" 
               style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">
              Submit New Registration
            </a>
          </div>
          
          <p style="color: #777; font-size: 14px; text-align: center; margin-top: 30px; border-top: 1px solid #e9ecef; padding-top: 20px;">
            Questions? Contact us at <a href="mailto:Mains@elementscentral.com" style="color: #f59e0b;">Mains@elementscentral.com</a>
          </p>
        </div>
      </div>
    `
  }),

  // Competition entry confirmation
  competitionEntry: (name: string, eventName: string, itemName: string, performanceType: string, totalFee: number) => ({
    subject: 'Competition Entry Confirmed - EODSA',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">🎭 Entry Confirmed!</h1>
          <p style="color: #f0f0f0; margin: 10px 0 0 0; font-size: 16px;">Competition Registration Successful</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
          <h2 style="color: #333; margin: 0 0 20px 0;">Hello ${name}!</h2>
          
          <p style="color: #555; font-size: 16px; line-height: 1.6;">
            Your competition entry has been successfully submitted and confirmed.
          </p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #8b5cf6; margin: 20px 0;">
            <h3 style="color: #8b5cf6; margin: 0 0 15px 0;">Entry Details:</h3>
            <p style="margin: 5px 0; color: #333;"><strong>Event:</strong> ${eventName}</p>
            <p style="margin: 5px 0; color: #333;"><strong>Performance:</strong> ${itemName}</p>
            <p style="margin: 5px 0; color: #333;"><strong>Type:</strong> ${performanceType}</p>
            <p style="margin: 5px 0; color: #333;"><strong>Total Fee:</strong> R${totalFee}</p>
          </div>
          
          <div style="background: #fef3c7; padding: 15px; border-radius: 8px; border: 1px solid #f59e0b; margin: 20px 0;">
            <p style="color: #92400e; margin: 0; font-size: 14px;">
              <strong>📝 Next Steps:</strong> You will receive further details about payment, scheduling, and event logistics via email as the competition date approaches.
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}" 
               style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">
              View Dashboard
            </a>
          </div>
          
          <p style="color: #777; font-size: 14px; text-align: center; margin-top: 30px; border-top: 1px solid #e9ecef; padding-top: 20px;">
            Questions about your entry? Contact us at <a href="mailto:Mains@elementscentral.com" style="color: #8b5cf6;">Mains@elementscentral.com</a>
          </p>
        </div>
      </div>
    `
  }),

  // Password reset email
  passwordReset: (name: string, resetToken: string, userType: 'judge' | 'admin' | 'studio') => ({
    subject: 'Reset Your EODSA Password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">🔐 Password Reset</h1>
          <p style="color: #f0f0f0; margin: 10px 0 0 0; font-size: 16px;">EODSA Account Recovery</p>
        </div>

        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
          <h2 style="color: #333; margin: 0 0 20px 0;">Hello ${name},</h2>

          <p style="color: #555; font-size: 16px; line-height: 1.6;">
            We received a request to reset your password for your EODSA ${userType === 'studio' ? 'Studio' : userType === 'admin' ? 'Admin' : 'Judge'} account.
          </p>

          <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; border-left: 4px solid #2196f3; margin: 20px 0;">
            <p style="margin: 0; color: #0d47a1; font-size: 16px; line-height: 1.6;">
              <strong>⚠️ Important:</strong> This password reset link will expire in 1 hour for security reasons.
            </p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}&type=${userType}"
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block; font-size: 16px;">
              Reset Password
            </a>
          </div>

          <p style="color: #555; font-size: 14px; line-height: 1.6;">
            If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.
          </p>

          <p style="color: #555; font-size: 14px; line-height: 1.6;">
            If the button above doesn't work, copy and paste this link into your browser:
          </p>
          <p style="color: #667eea; font-size: 12px; word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 4px;">
            ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}&type=${userType}
          </p>

          <p style="color: #777; font-size: 14px; text-align: center; margin-top: 30px; border-top: 1px solid #e9ecef; padding-top: 20px;">
            Need help? Contact us at <a href="mailto:Mains@elementscentral.com" style="color: #667eea;">Mains@elementscentral.com</a>
          </p>
        </div>
      </div>
    `
  }),

  // Certificate of achievement email
  certificateAchievement: (name: string, percentage: number, medallion: string, certificateUrl: string) => ({
    subject: 'EODSA Nationals 2025 - Your Certificate of Achievement!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #e91e63 0%, #9c27b0 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">🏆 Certificate of Achievement</h1>
          <p style="color: #f0f0f0; margin: 10px 0 0 0; font-size: 16px;">EODSA Nationals 2025</p>
        </div>

        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
          <h2 style="color: #333; margin: 0 0 20px 0;">Congratulations ${name}!</h2>

          <p style="color: #555; font-size: 16px; line-height: 1.6;">
            Your performance at the EODSA National Championship has been completed and your certificate is ready!
          </p>

          <div style="background: ${medallion === 'Gold' ? '#ffd700' : medallion === 'Silver' ? '#c0c0c0' : medallion === 'Bronze' ? '#cd7f32' : '#e3f2fd'}; padding: 20px; border-radius: 8px; border-left: 4px solid ${medallion === 'Gold' ? '#ffb700' : medallion === 'Silver' ? '#a8a8a8' : medallion === 'Bronze' ? '#b36200' : '#2196f3'}; margin: 20px 0;">
            <h3 style="color: ${medallion ? '#000' : '#0d47a1'}; margin: 0 0 15px 0;">Your Achievement</h3>
            <p style="margin: 5px 0; color: ${medallion ? '#000' : '#0d47a1'};"><strong>Score:</strong> ${percentage}%</p>
            ${medallion ? `<p style="margin: 5px 0; color: #000;"><strong>Medallion:</strong> ${medallion} 🏅</p>` : ''}
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${certificateUrl}"
               style="background: linear-gradient(135deg, #e91e63 0%, #9c27b0 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block; font-size: 16px;">
              View Certificate
            </a>
          </div>

          <p style="color: #555; font-size: 14px; line-height: 1.6;">
            You can download and share your certificate. Print it or share it on social media to celebrate your achievement!
          </p>

          <h3 style="color: #333; margin: 25px 0 15px 0;">Share Your Success:</h3>
          <ul style="color: #555; line-height: 1.8;">
            <li>Download your certificate for your records</li>
            <li>Share on social media with #EODSANationals2025</li>
            <li>Frame it and display your achievement!</li>
          </ul>

          <p style="color: #777; font-size: 14px; text-align: center; margin-top: 30px; border-top: 1px solid #e9ecef; padding-top: 20px;">
            Questions? Contact us at <a href="mailto:Mains@elementscentral.com" style="color: #e91e63;">Mains@elementscentral.com</a>
          </p>
        </div>
      </div>
    `
  }),

  // Studio password recovery email (sends password directly)
  studioPasswordRecovery: (studioName: string, password: string) => ({
    subject: 'Your Studio Password - EODSA',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">🔐 Studio Password Recovery</h1>
          <p style="color: #f0f0f0; margin: 10px 0 0 0; font-size: 16px;">EODSA Studio Portal</p>
        </div>

        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
          <h2 style="color: #333; margin: 0 0 20px 0;">Hello ${studioName},</h2>

          <p style="color: #555; font-size: 16px; line-height: 1.6;">
            You requested your studio password. Here are your login credentials:
          </p>

          <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; border-left: 4px solid #4caf50; margin: 20px 0;">
            <h3 style="color: #2e7d32; margin: 0 0 15px 0;">Your Studio Login Details:</h3>
            <p style="margin: 5px 0; color: #2e7d32;"><strong>Studio Name:</strong> ${studioName}</p>
            <p style="margin: 5px 0; color: #2e7d32;"><strong>Password:</strong> <code style="background: #fff; padding: 4px 8px; border-radius: 4px; font-family: monospace; font-size: 16px; font-weight: bold;">${password}</code></p>
          </div>

          <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border: 1px solid #ffeaa7; margin: 20px 0;">
            <p style="color: #856404; margin: 0; font-size: 14px;">
              <strong>🔒 Security Note:</strong> Please keep your password secure and do not share it with unauthorized persons.
            </p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/studio-login"
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block; font-size: 16px;">
              Login to Studio Dashboard
            </a>
          </div>

          <h3 style="color: #333; margin: 25px 0 15px 0;">Studio Dashboard Features:</h3>
          <ul style="color: #555; line-height: 1.8;">
            <li>Add and manage your dancers</li>
            <li>Register dancers for competitions</li>
            <li>View dancer profiles and EODSA IDs</li>
            <li>Track competition entries and payments</li>
          </ul>

          <p style="color: #777; font-size: 14px; text-align: center; margin-top: 30px; border-top: 1px solid #e9ecef; padding-top: 20px;">
            Need help? Contact us at <a href="mailto:Mains@elementscentral.com" style="color: #667eea;">Mains@elementscentral.com</a>
          </p>
        </div>
      </div>
    `
  }),

  certificateAvailable: (dancerName: string, certificateUrl: string, performanceTitle: string, percentage: number, medallion: string) => ({
    subject: 'Your Certificate is Now Available! 🎉',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">🏆 Your Certificate is Ready!</h1>
        </div>

        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
          <h2 style="color: #333; margin: 0 0 20px 0;">Congratulations ${dancerName}!</h2>

          <p style="color: #555; font-size: 16px; line-height: 1.6;">
            Your performance scores have been published and your certificate is now available on your dashboard!
          </p>

          <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; margin: 20px 0;">
            <h3 style="color: #667eea; margin: 0 0 15px 0;">Performance Details:</h3>
            <p style="margin: 5px 0; color: #333;"><strong>Performance:</strong> ${performanceTitle}</p>
            <p style="margin: 5px 0; color: #333;"><strong>Score:</strong> ${percentage}%</p>
            <p style="margin: 5px 0; color: #333;"><strong>Medallion:</strong> ${medallion} 🏅</p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${certificateUrl}"
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block; font-size: 16px;">
              View Certificate on Dashboard
            </a>
          </div>

          <p style="color: #555; font-size: 14px; line-height: 1.6;">
            You can view, download, and share your certificate from your dashboard. Log in to access it anytime!
          </p>

          <p style="color: #777; font-size: 14px; text-align: center; margin-top: 30px; border-top: 1px solid #e9ecef; padding-top: 20px;">
            Questions? Contact us at <a href="mailto:Mains@elementscentral.com" style="color: #667eea;">Mains@elementscentral.com</a>
          </p>
        </div>
      </div>
    `
  }),

  certificateAvailableToStudio: (studioName: string, dancerName: string, certificateUrl: string, performanceTitle: string, percentage: number, medallion: string) => ({
    subject: `Certificate Available for ${dancerName} 🎉`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">🏆 Certificate Available</h1>
        </div>

        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
          <h2 style="color: #333; margin: 0 0 20px 0;">Hello ${studioName}!</h2>

          <p style="color: #555; font-size: 16px; line-height: 1.6;">
            A certificate is now available for one of your dancers. The performance scores have been published and the certificate is ready to view.
          </p>

          <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; margin: 20px 0;">
            <h3 style="color: #667eea; margin: 0 0 15px 0;">Performance Details:</h3>
            <p style="margin: 5px 0; color: #333;"><strong>Dancer:</strong> ${dancerName}</p>
            <p style="margin: 5px 0; color: #333;"><strong>Performance:</strong> ${performanceTitle}</p>
            <p style="margin: 5px 0; color: #333;"><strong>Score:</strong> ${percentage}%</p>
            <p style="margin: 5px 0; color: #333;"><strong>Medallion:</strong> ${medallion} 🏅</p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${certificateUrl}"
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block; font-size: 16px;">
              View Certificate
            </a>
          </div>

          <p style="color: #555; font-size: 14px; line-height: 1.6;">
            The dancer has also been notified and can access their certificate from their dashboard.
          </p>

          <p style="color: #777; font-size: 14px; text-align: center; margin-top: 30px; border-top: 1px solid #e9ecef; padding-top: 20px;">
            Questions? Contact us at <a href="mailto:Mains@elementscentral.com" style="color: #667eea;">Mains@elementscentral.com</a>
          </p>
        </div>
      </div>
    `
  })
};

// Email service functions
export const emailService = {
  // Send dancer registration email
  async sendDancerRegistrationEmail(name: string, email: string, eodsaId: string) {
    try {
      const template = emailTemplates.dancerRegistration(name, eodsaId);
      
      await transporter.sendMail({
        from: `"EODSA Registration" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'devops@upstreamcreatives.co.za'}>`,
        to: email,
        subject: template.subject,
        html: template.html
      });
      
      console.log('Dancer registration email sent successfully to:', email);
      return { success: true };
    } catch (error) {
      console.error('Error sending dancer registration email:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  // Send studio registration email
  async sendStudioRegistrationEmail(studioName: string, contactPerson: string, email: string, registrationNumber: string) {
    try {
      const template = emailTemplates.studioRegistration(studioName, contactPerson, registrationNumber, email);
      
      await transporter.sendMail({
        from: `"EODSA Registration" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'devops@upstreamcreatives.co.za'}>`,
        to: email,
        subject: template.subject,
        html: template.html
      });
      
      console.log('Studio registration email sent successfully to:', email);
      return { success: true };
    } catch (error) {
      console.error('Error sending studio registration email:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  // Send dancer approval email
  async sendDancerApprovalEmail(name: string, email: string, eodsaId: string) {
    try {
      const template = emailTemplates.dancerApproval(name, eodsaId);
      
      await transporter.sendMail({
        from: `"EODSA Approvals" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'devops@upstreamcreatives.co.za'}>`,
        to: email,
        subject: template.subject,
        html: template.html
      });
      
      console.log('Dancer approval email sent successfully to:', email);
      return { success: true };
    } catch (error) {
      console.error('Error sending dancer approval email:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  // Send dancer rejection email
  async sendDancerRejectionEmail(name: string, email: string, eodsaId: string, rejectionReason: string) {
    try {
      const template = emailTemplates.dancerRejection(name, eodsaId, rejectionReason);
      
      await transporter.sendMail({
        from: `"EODSA Registration" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'devops@upstreamcreatives.co.za'}>`,
        to: email,
        subject: template.subject,
        html: template.html
      });
      
      console.log('Dancer rejection email sent successfully to:', email);
      return { success: true };
    } catch (error) {
      console.error('Error sending dancer rejection email:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  // Send competition entry confirmation email
  async sendCompetitionEntryEmail(name: string, email: string, eventName: string, itemName: string, performanceType: string, totalFee: number) {
    try {
      const template = emailTemplates.competitionEntry(name, eventName, itemName, performanceType, totalFee);
      
      await transporter.sendMail({
        from: `"EODSA Competitions" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'devops@upstreamcreatives.co.za'}>`,
        to: email,
        subject: template.subject,
        html: template.html
      });
      
      console.log('Competition entry email sent successfully to:', email);
      return { success: true };
    } catch (error) {
      console.error('Error sending competition entry email:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  // Send password reset email
  async sendPasswordResetEmail(email: string, name: string, resetToken: string, userType: 'judge' | 'admin' | 'studio') {
    try {
      const emailTemplate = emailTemplates.passwordReset(name, resetToken, userType);
      
      const mailOptions = {
        from: `"EODSA Password Reset" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'devops@upstreamcreatives.co.za'}>`,
        to: email,
        subject: emailTemplate.subject,
        html: emailTemplate.html
      };

      const result = await transporter.sendMail(mailOptions);
      console.log(`✅ Password reset email sent to ${email} - Message ID: ${result.messageId}`);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error(`❌ Failed to send password reset email to ${email}:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  // Send certificate email
  async sendCertificateEmail(name: string, email: string, percentage: number, medallion: string, certificateUrl: string) {
    try {
      const template = emailTemplates.certificateAchievement(name, percentage, medallion, certificateUrl);

      await transporter.sendMail({
        from: `"EODSA Nationals 2025" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'devops@upstreamcreatives.co.za'}>`,
        to: email,
        subject: template.subject,
        html: template.html
      });

      console.log('Certificate email sent successfully to:', email);
      return { success: true };
    } catch (error) {
      console.error('Error sending certificate email:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  // Send certificate available notification to dancer
  async sendCertificateAvailableEmail(dancerName: string, email: string, certificateUrl: string, performanceTitle: string, percentage: number, medallion: string) {
    try {
      const template = emailTemplates.certificateAvailable(dancerName, certificateUrl, performanceTitle, percentage, medallion);

      await transporter.sendMail({
        from: `"EODSA" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'devops@upstreamcreatives.co.za'}>`,
        to: email,
        subject: template.subject,
        html: template.html
      });

      console.log('Certificate available email sent successfully to dancer:', email);
      return { success: true };
    } catch (error) {
      console.error('Error sending certificate available email:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  // Send certificate available notification to studio
  async sendCertificateAvailableEmailToStudio(studioName: string, email: string, dancerName: string, certificateUrl: string, performanceTitle: string, percentage: number, medallion: string) {
    try {
      const template = emailTemplates.certificateAvailableToStudio(studioName, dancerName, certificateUrl, performanceTitle, percentage, medallion);

      await transporter.sendMail({
        from: `"EODSA" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'devops@upstreamcreatives.co.za'}>`,
        to: email,
        subject: template.subject,
        html: template.html
      });

      console.log('Certificate available email sent successfully to studio:', email);
      return { success: true };
    } catch (error) {
      console.error('Error sending certificate available email to studio:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  // Send studio password recovery email
  async sendStudioPasswordEmail(email: string, studioName: string, password: string) {
    try {
      const template = emailTemplates.studioPasswordRecovery(studioName, password);
      
      const mailOptions = {
        from: `"EODSA Studio Support" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'devops@upstreamcreatives.co.za'}>`,
        to: email,
        subject: template.subject,
        html: template.html
      };

      const result = await transporter.sendMail(mailOptions);
      console.log(`✅ Studio password email sent to ${email} - Message ID: ${result.messageId}`);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Failed to send studio password email:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  // Generic announcement email (admin notifications)
  async sendAnnouncementEmail(to: string, subject: string, html: string) {
    try {
      const fromAddress = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'no_reply@elementscentral.com';
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://eodsa.vercel.app';

      const wrappedHtml = `
        <div style="background: #0f172a; padding: 32px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
          <div style="max-width: 640px; margin: 0 auto; background: #020617; border-radius: 18px; overflow: hidden; box-shadow: 0 24px 60px rgba(15, 23, 42, 0.85); border: 1px solid rgba(148, 163, 184, 0.35);">
            <div style="background: radial-gradient(circle at top left, #22c55e, #6366f1); padding: 24px 28px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-size: 13px; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(226, 232, 240, 0.9); font-weight: 600;">EODSA • Announcement</div>
                <div style="font-size: 22px; margin-top: 8px; color: #f9fafb; font-weight: 700;">
                  ${subject}
                </div>
              </div>
              <div style="width: 40px; height: 40px; border-radius: 999px; border: 2px solid rgba(248, 250, 252, 0.8); display: flex; align-items: center; justify-content: center; background: rgba(15, 23, 42, 0.15);">
                <span style="font-size: 20px;">📣</span>
              </div>
            </div>

            <div style="padding: 26px 28px 8px 28px; background: linear-gradient(to bottom, #020617, #020617 80%, #020617);">
              <div style="font-size: 14px; line-height: 1.7; color: #e5e7eb; margin-bottom: 18px;">
                <!-- User content starts -->
                ${html}
                <!-- User content ends -->
              </div>

              <div style="margin-top: 24px; padding: 12px 14px; border-radius: 12px; background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(148, 163, 184, 0.45);">
                <div style="font-size: 12px; color: #9ca3af;">
                  If you have any questions, please contact our support team at
                  <a href="mailto:Mains@elementscentral.com" style="color: #4ade80; text-decoration: none; font-weight: 500;">Mains@elementscentral.com</a>.
                </div>
              </div>

              <div style="margin-top: 20px; display: flex; justify-content: center;">
                <a href="${appUrl}/admin" style="display: inline-block; padding: 10px 20px; border-radius: 999px; background: linear-gradient(to right, #22c55e, #4ade80); color: #022c22; font-size: 13px; font-weight: 600; text-decoration: none; letter-spacing: 0.06em; text-transform: uppercase;">
                  Open Admin Dashboard
                </a>
              </div>
            </div>

            <div style="padding: 12px 24px 18px 24px; border-top: 1px solid rgba(30, 64, 175, 0.7); background: #020617;">
              <div style="font-size: 11px; color: #6b7280; text-align: center;">
                EODSA Competition Management • Sent from no_reply@elementscentral.com
              </div>
            </div>
          </div>
        </div>
      `;

      const mailOptions = {
        from: `"EODSA Announcements" <${fromAddress}>`,
        to,
        subject,
        html: wrappedHtml
      };

      const result = await transporter.sendMail(mailOptions);
      console.log(`✅ Announcement email sent to ${to} - Message ID: ${result.messageId}`);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error(`❌ Failed to send announcement email to ${to}:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  // Test email connection
  async testConnection() {
    try {
      await transporter.verify();
      console.log('✅ SMTP connection verified successfully');
      return { success: true, message: 'SMTP connection verified' };
    } catch (error) {
      console.error('❌ SMTP connection failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
};

export default emailService; 