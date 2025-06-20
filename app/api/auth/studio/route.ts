import { NextResponse } from 'next/server';
import { studioDb, initializeDatabase } from '@/lib/database';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    // Initialize database tables if they don't exist
    await initializeDatabase();
    
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find studio by email using database
    const studio = await studioDb.getStudioByEmail(email);
    if (!studio) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Verify password (plaintext comparison per client requirement)
    const isValidPassword = password === studio.password;
    if (!isValidPassword) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Return studio session data (without password)
    const studioSession = {
      id: studio.id,
      name: studio.name,
      email: studio.email,
      registrationNumber: studio.registrationNumber
    };

    return NextResponse.json({
      success: true,
      studio: studioSession
    });
  } catch (error: any) {
    console.error('Studio authentication error:', error);
    
    // Handle specific authentication errors
    if (error.message) {
      if (error.message.includes('not found') || error.message.includes('Invalid')) {
        return NextResponse.json(
          { success: false, error: 'Invalid email or password' },
          { status: 401 }
        );
      }
      
      // For other specific errors, return the message
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Authentication failed' },
      { status: 500 }
    );
  }
} 