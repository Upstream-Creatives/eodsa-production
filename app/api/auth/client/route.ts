import { NextResponse } from 'next/server';
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
    
            // Find client by email
            const clients = await sqlClient`
              SELECT id, name, email, password, phone,
                     allowed_dashboards, can_view_all_events, allowed_event_ids,
                     is_active, is_approved
              FROM clients 
              WHERE email = ${email} AND is_active = true AND is_approved = true
            ` as any[];
            
            const client = clients && clients.length > 0 ? clients[0] : null;
    console.log('🔍 Client login attempt:', { email, foundClient: !!client });
    
    if (!client) {
      console.log('❌ Client not found or not approved:', email);
      return NextResponse.json(
        { success: false, error: 'Invalid email or password, or account not approved' },
        { status: 401 }
      );
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, client.password);
    console.log('🔐 Client password check:', { email, isValid: isValidPassword });
    
    if (!isValidPassword) {
      console.log('❌ Invalid password for client:', email);
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Update last login
    await sqlClient`
      UPDATE clients 
      SET last_login_at = ${new Date().toISOString()}
      WHERE id = ${client.id}
    `;

    // Return client session data (without password)
    const clientSession = {
      id: client.id,
      name: client.name,
      email: client.email,
      phone: client.phone,
      allowedDashboards: client.allowed_dashboards || [],
      canViewAllEvents: client.can_view_all_events,
      allowedEventIds: client.allowed_event_ids || [],
      userType: 'client'
    };

    console.log('✅ Client login successful:', { 
      email, 
      allowedDashboards: clientSession.allowedDashboards 
    });

    return NextResponse.json({
      success: true,
      client: clientSession
    });
  } catch (error) {
    console.error('Client authentication error:', error);
    return NextResponse.json(
      { success: false, error: 'Authentication failed' },
      { status: 500 }
    );
  }
}
