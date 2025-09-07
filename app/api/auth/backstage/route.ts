import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find user by email and role
    const user = await db.getJudgeByEmail(email);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Allow access for backstage managers OR admins OR users with admin emails
    const hasAccess = user.role === 'backstage_manager' || 
                     user.isAdmin || 
                     user.email === 'admin@eodsa.com' ||
                     user.email === 'admin' ||
                     user.email === 'mains@elementscentral.com';
    
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions for backstage access' },
        { status: 401 }
      );
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Return user session data (without password)
    const userSession = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isAdmin: user.isAdmin
    };

    return NextResponse.json({
      success: true,
      user: userSession
    });
  } catch (error) {
    console.error('Backstage authentication error:', error);
    return NextResponse.json(
      { success: false, error: 'Authentication failed' },
      { status: 500 }
    );
  }
}
