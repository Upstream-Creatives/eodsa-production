import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import bcrypt from 'bcryptjs';

export async function GET() {
  try {
    const judges = await db.getAllJudges();
    
    return NextResponse.json({
      success: true,
      judges
    });
  } catch (error) {
    console.error('Error fetching judges:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch judges' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password, isAdmin } = body;

    // Validate required fields
    if (!name || !email || !password) {
      return NextResponse.json(
        { success: false, error: 'Name, email, and password are required' },
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingJudge = await db.getJudgeByEmail(email.toLowerCase().trim());
    
    if (existingJudge) {
      return NextResponse.json(
        { success: false, error: 'A judge with this email already exists' },
        { status: 400 }
      );
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the judge
    const newJudge = await db.createJudge({
      id: `judge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      isAdmin: Boolean(isAdmin),
      role: Boolean(isAdmin) ? 'admin' : 'judge',
      specialization: []
    });

    // Return success without password
    const { password: _, ...judgeResponse } = newJudge;
    
    return NextResponse.json({
      success: true,
      judge: judgeResponse,
      message: 'Judge account created successfully'
    });
  } catch (error) {
    console.error('Error creating judge:', error);
    
    if (error instanceof Error && error.message) {
      if (error.message.includes('already exists') || error.message.includes('duplicate key') || error.message.includes('UNIQUE constraint')) {
        return NextResponse.json(
          { success: false, error: 'A judge with this email already exists' },
          { status: 409 }
        );
      }
    }
    
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create judge' },
      { status: 500 }
    );
  }
} 