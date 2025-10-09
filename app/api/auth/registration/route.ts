import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getSql } from '@/lib/database';
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

    const sqlClient = getSql();

    // First, try to find in clients table (staff accounts)
    const clients = await sqlClient`
      SELECT id, name, email, password, allowed_dashboards, is_active, is_approved
      FROM clients 
      WHERE email = ${email} AND is_active = true AND is_approved = true
    ` as any[];

    if (clients && clients.length > 0) {
      const client = clients[0];
      const allowedDashboards = Array.isArray(client.allowed_dashboards)
        ? client.allowed_dashboards
        : (typeof client.allowed_dashboards === 'string'
          ? JSON.parse(client.allowed_dashboards)
          : []);

      // Check if they have registration dashboard access
      if (!allowedDashboards.includes('registration-dashboard')) {
        return NextResponse.json(
          { success: false, error: 'Invalid credentials or insufficient permissions' },
          { status: 401 }
        );
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, client.password);
      if (!isValidPassword) {
        return NextResponse.json(
          { success: false, error: 'Invalid credentials' },
          { status: 401 }
        );
      }

      // Update last login
      await sqlClient`
        UPDATE clients 
        SET last_login_at = ${new Date().toISOString()}
        WHERE id = ${client.id}
      `;

      // Return user session data
      const userSession = {
        id: client.id,
        name: client.name,
        email: client.email,
        role: 'registration',
        isAdmin: false
      };

      return NextResponse.json({
        success: true,
        user: userSession
      });
    }

    // If not found in clients, check judges table (legacy)
    const user = await db.getJudgeByEmail(email);
    if (!user || (user.role !== 'registration' && !user.isAdmin)) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials or insufficient permissions' },
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
    console.error('Registration authentication error:', error);
    return NextResponse.json(
      { success: false, error: 'Authentication failed' },
      { status: 500 }
    );
  }
}

