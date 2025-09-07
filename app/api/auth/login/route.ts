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

    // Find judge by email using database
    console.log('🌍 DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
    
    const judge = await db.getJudgeByEmail(email);
    console.log('🔍 Login attempt:', { email, foundUser: !!judge });
    
    if (!judge) {
      console.log('❌ User not found:', email);
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    console.log('👤 Found user:', { id: judge.id, email: judge.email, hasPassword: !!judge.password });

    // Verify password
    const isValidPassword = await bcrypt.compare(password, judge.password);
    console.log('🔐 Password check:', { email, isValid: isValidPassword });
    
    if (!isValidPassword) {
      console.log('❌ Invalid password for:', email);
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Return judge session data (without password)
    const judgeSession = {
      id: judge.id,
      name: judge.name,
      email: judge.email,
      isAdmin: judge.isAdmin
    };

    return NextResponse.json({
      success: true,
      judge: judgeSession
    });
  } catch (error) {
    console.error('Authentication error:', error);
    return NextResponse.json(
      { success: false, error: 'Authentication failed' },
      { status: 500 }
    );
  }
} 