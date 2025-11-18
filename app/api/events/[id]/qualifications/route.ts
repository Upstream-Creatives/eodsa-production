import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';

// GET: Fetch manual qualifications for an event
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const eventId = id;

    const qualifications = await db.getManualQualifications(eventId);

    return NextResponse.json({
      success: true,
      qualifications
    });
  } catch (error) {
    console.error('Error fetching manual qualifications:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch manual qualifications' },
      { status: 500 }
    );
  }
}

// POST: Add a manual qualification
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const eventId = id;
    const body = await request.json();

    // Validate required fields
    if (!body.dancerId || !body.addedBy) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: dancerId, addedBy' },
        { status: 400 }
      );
    }

    // Admin authentication check
    const authHeader = request.headers.get('authorization');
    if (!authHeader && !body.adminSession) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // If adminSession is provided in body (for client-side requests)
    if (body.adminSession) {
      try {
        const adminData = typeof body.adminSession === 'string' 
          ? JSON.parse(body.adminSession) 
          : body.adminSession;
        
        if (!adminData.isAdmin) {
          return NextResponse.json(
            { success: false, error: 'Admin privileges required' },
            { status: 403 }
          );
        }
      } catch (sessionError) {
        return NextResponse.json(
          { success: false, error: 'Invalid admin session' },
          { status: 401 }
        );
      }
    }

    const qualification = await db.addManualQualification(
      eventId,
      body.dancerId,
      body.addedBy
    );

    return NextResponse.json({
      success: true,
      qualification
    });
  } catch (error: any) {
    console.error('Error adding manual qualification:', error);
    
    if (error.message?.includes('already')) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to add manual qualification' },
      { status: 500 }
    );
  }
}

// DELETE: Remove a manual qualification
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const eventId = id;
    const body = await request.json();

    // Validate required fields
    if (!body.dancerId || !body.removedBy) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: dancerId, removedBy' },
        { status: 400 }
      );
    }

    // Admin authentication check
    const authHeader = request.headers.get('authorization');
    if (!authHeader && !body.adminSession) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // If adminSession is provided in body (for client-side requests)
    if (body.adminSession) {
      try {
        const adminData = typeof body.adminSession === 'string' 
          ? JSON.parse(body.adminSession) 
          : body.adminSession;
        
        if (!adminData.isAdmin) {
          return NextResponse.json(
            { success: false, error: 'Admin privileges required' },
            { status: 403 }
          );
        }
      } catch (sessionError) {
        return NextResponse.json(
          { success: false, error: 'Invalid admin session' },
          { status: 401 }
        );
      }
    }

    await db.removeManualQualification(
      eventId,
      body.dancerId,
      body.removedBy
    );

    return NextResponse.json({
      success: true,
      message: 'Manual qualification removed successfully'
    });
  } catch (error) {
    console.error('Error removing manual qualification:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to remove manual qualification' },
      { status: 500 }
    );
  }
}

