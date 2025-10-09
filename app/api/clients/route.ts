import { NextResponse } from 'next/server';
import { getSql } from '@/lib/database';
import bcrypt from 'bcryptjs';

// GET - List all clients (admin only)
export async function GET(request: Request) {
  try {
    const sqlClient = getSql();
    
    const clientsRaw = await sqlClient`
      SELECT id, name, email, phone,
             allowed_dashboards, can_view_all_events, allowed_event_ids,
             is_active, is_approved, created_at, created_by, last_login_at, notes
      FROM clients 
      ORDER BY created_at DESC
    ` as any[];

    // Parse JSON fields and map snake_case to camelCase
    const clients = clientsRaw.map((client: any) => ({
      id: client.id,
      name: client.name,
      email: client.email,
      phone: client.phone,
      allowedDashboards: Array.isArray(client.allowed_dashboards) 
        ? client.allowed_dashboards 
        : (typeof client.allowed_dashboards === 'string' 
          ? JSON.parse(client.allowed_dashboards) 
          : []),
      canViewAllEvents: client.can_view_all_events,
      allowedEventIds: Array.isArray(client.allowed_event_ids)
        ? client.allowed_event_ids
        : (typeof client.allowed_event_ids === 'string'
          ? JSON.parse(client.allowed_event_ids)
          : []),
      isActive: client.is_active,
      isApproved: client.is_approved,
      createdAt: client.created_at,
      createdBy: client.created_by,
      lastLoginAt: client.last_login_at,
      notes: client.notes
    }));

    return NextResponse.json({
      success: true,
      clients
    });
  } catch (error) {
    console.error('Error fetching clients:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch clients' },
      { status: 500 }
    );
  }
}

// POST - Create new client (admin only)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      name, 
      email, 
      password, 
      phone,
      allowedDashboards = [],
      canViewAllEvents = false,
      allowedEventIds = [],
      createdBy,
      notes = ''
    } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { success: false, error: 'Name, email, and password are required' },
        { status: 400 }
      );
    }

    const sqlClient = getSql();
    
    // Check if email already exists
    const existingClients = await sqlClient`
      SELECT id FROM clients WHERE email = ${email}
    ` as any[];
    
    if (existingClients && existingClients.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Email already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Generate client ID
    const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create client
    await sqlClient`
      INSERT INTO clients (
        id, name, email, password, phone,
        allowed_dashboards, can_view_all_events, allowed_event_ids,
        is_active, is_approved, created_by, notes
      ) VALUES (
        ${clientId}, ${name}, ${email}, ${hashedPassword}, ${phone || null},
        ${JSON.stringify(allowedDashboards)}, ${canViewAllEvents}, ${JSON.stringify(allowedEventIds)},
        true, true, ${createdBy}, ${notes}
      )
    `;

    console.log('✅ Client created successfully:', { id: clientId, email, allowedDashboards });

    return NextResponse.json({
      success: true,
      message: 'Client created successfully',
      clientId
    });
  } catch (error) {
    console.error('Error creating client:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create client' },
      { status: 500 }
    );
  }
}

// PUT - Update client (admin only)
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { 
      id,
      name, 
      email, 
      phone,
      allowedDashboards,
      canViewAllEvents,
      allowedEventIds,
      isActive,
      isApproved,
      updatedBy,
      notes
    } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Client ID is required' },
        { status: 400 }
      );
    }

    const sqlClient = getSql();
    
    // Get current client data
    const currentClients = await sqlClient`
      SELECT * FROM clients WHERE id = ${id}
    ` as any[];
    
    if (!currentClients || currentClients.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Client not found' },
        { status: 404 }
      );
    }
    
    const currentClient = currentClients[0];
    
    // Only update fields that are provided, keep existing values for others
    await sqlClient`
      UPDATE clients SET
        name = ${name || currentClient.name},
        email = ${email || currentClient.email},
        phone = ${phone !== undefined ? phone : currentClient.phone},
        allowed_dashboards = ${JSON.stringify(allowedDashboards !== undefined ? allowedDashboards : currentClient.allowed_dashboards)},
        can_view_all_events = ${canViewAllEvents !== undefined ? canViewAllEvents : currentClient.can_view_all_events},
        allowed_event_ids = ${JSON.stringify(allowedEventIds !== undefined ? allowedEventIds : currentClient.allowed_event_ids)},
        is_active = ${isActive !== undefined ? isActive : currentClient.is_active},
        is_approved = ${isApproved !== undefined ? isApproved : currentClient.is_approved},
        updated_at = ${new Date().toISOString()},
        updated_by = ${updatedBy || currentClient.updated_by},
        notes = ${notes !== undefined ? notes : currentClient.notes}
      WHERE id = ${id}
    `;

    console.log('✅ Client updated successfully:', { id, email: email || currentClient.email });

    return NextResponse.json({
      success: true,
      message: 'Client updated successfully'
    });
  } catch (error) {
    console.error('Error updating client:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update client' },
      { status: 500 }
    );
  }
}

// DELETE - Delete client (admin only)
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('id');

    if (!clientId) {
      return NextResponse.json(
        { success: false, error: 'Client ID is required' },
        { status: 400 }
      );
    }

    const sqlClient = getSql();
    
    await sqlClient`DELETE FROM clients WHERE id = ${clientId}`;

    console.log('✅ Client deleted successfully:', { id: clientId });

    return NextResponse.json({
      success: true,
      message: 'Client deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting client:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete client' },
      { status: 500 }
    );
  }
}
