import { NextRequest, NextResponse } from 'next/server';
import { unifiedDb, initializeDatabase } from '@/lib/database';
import { emailService } from '@/lib/email';
import { verifyRecaptcha, checkRateLimit, getClientIP } from '@/lib/recaptcha';

// Individual dancer registration
export async function POST(request: NextRequest) {
  try {
    // Initialize database tables if they don't exist
    // // // await initializeDatabase() // Commented out for performance - initialization happens once on server start; // Commented out for performance - initialization happens once on server start // Commented out for performance - initialization happens once on server start
    
    const body = await request.json();
    const { name, dateOfBirth, nationalId, province, email, phone, guardianName, guardianEmail, guardianPhone, studioId, recaptchaToken } = body;
    
    // Rate limiting removed for bulk studio registrations
    
    // Get client IP for reCAPTCHA verification
    const clientIP = getClientIP(request);
    
    // Verify reCAPTCHA token
    if (!recaptchaToken) {
      return NextResponse.json(
        { error: 'reCAPTCHA verification is required' },
        { status: 400 }
      );
    }

    const recaptchaResult = await verifyRecaptcha(recaptchaToken, clientIP);
    
          if (!recaptchaResult.success) {
        return NextResponse.json(
          { 
            error: `Security verification failed: ${recaptchaResult.error}`,
            recaptchaFailed: true 
          },
          { status: 400 }
        );
      }
    
          if (!name || !dateOfBirth || !nationalId || !province) {
        return NextResponse.json(
          { error: 'Name, date of birth, national ID, and province are required' },
          { status: 400 }
        );
      }

      // Calculate age
      const age = unifiedDb.calculateAge(dateOfBirth);
      
      // If 18 or older, require email and phone
      if (age >= 18) {
        if (!email || !phone) {
          return NextResponse.json(
            { error: 'Email and phone number are required for dancers 18 years and older' },
            { status: 400 }
          );
        }
      }
      
      // If under 18, require guardian information
      if (age < 18 && (!guardianName || !guardianEmail || !guardianPhone)) {
        return NextResponse.json(
          { error: 'Guardian information is required for dancers under 18' },
          { status: 400 }
        );
      }

    const result = await unifiedDb.registerDancer({
      name,
      dateOfBirth,
      nationalId,
      province,
      email,
      phone,
      guardianName,
      guardianEmail,
      guardianPhone
          });

    // If studioId is provided, automatically add the dancer to the studio
    if (studioId) {
      try {
        await unifiedDb.addDancerToStudioByEodsaId(studioId, result.eodsaId, studioId);
      } catch (error) {
        console.error('Failed to auto-assign dancer to studio:', error);
        // Don't fail the registration if studio assignment fails
        // Return success but mention the assignment issue
        return NextResponse.json({
          success: true,
          message: 'Dancer registered successfully, but failed to add to studio. Please add manually.',
          eodsaId: result.eodsaId,
          dancer: {
            id: result.id,
            eodsaId: result.eodsaId,
            name,
            age,
            approved: true
          },
          studioAssignmentError: true
        });
      }
    }

    // Send registration confirmation email
    const emailToSend = email || guardianEmail;
    if (emailToSend) {
      try {
        await emailService.sendDancerRegistrationEmail(name, emailToSend, result.eodsaId);
        console.log('Registration email sent successfully to:', emailToSend);
      } catch (emailError) {
        console.error('Failed to send registration email:', emailError);
        // Don't fail the registration if email fails
      }
    }

    return NextResponse.json({
      success: true,
      message: studioId ? 'Dancer registered successfully and added to your studio!' : 'Dancer registered successfully. Your account is now active!',
      eodsaId: result.eodsaId,
      dancer: {
        id: result.id,
        eodsaId: result.eodsaId,
        name,
        age,
        approved: true // Show as immediately approved
      }
    });
  } catch (error: any) {
    console.error('Dancer registration error:', error);
    
    // Handle specific database errors with user-friendly messages
    if (error.message) {
      if (error.message.includes('already exists') || error.message.includes('duplicate key') || error.message.includes('UNIQUE constraint')) {
        if (error.message.includes('national_id')) {
          return NextResponse.json(
            { error: 'A dancer with this National ID is already registered' },
            { status: 409 }
          );
        }
        if (error.message.includes('email')) {
          return NextResponse.json(
            { error: 'A dancer with this email address is already registered' },
            { status: 409 }
          );
        }
        return NextResponse.json(
          { error: 'This dancer is already registered' },
          { status: 409 }
        );
      }
      
      // Return the specific error message from the database layer
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Registration failed. Please try again.' },
      { status: 500 }
    );
  }
} 