import { NextRequest, NextResponse } from 'next/server';
import { db, unifiedDb, initializeDatabase, getSql } from '@/lib/database';
import { ITEM_STYLES } from '@/lib/types';
import { batchEntryFingerprint, parseParticipantIds } from '@/lib/entry-dedup';

// Admin-only: Delete a competition entry
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await initializeDatabase();
    
    const { id } = await params;
    const entryId = id;
    
    // Get admin ID from request body
    const body = await request.json();
    const { adminId } = body;
    
    if (!adminId) {
      return NextResponse.json(
        { error: 'Admin ID is required' },
        { status: 400 }
      );
    }
    
    const result = await unifiedDb.deleteEntryAsAdmin(adminId, entryId);
    
    return NextResponse.json({
      success: true,
      message: result.message
    });
    
  } catch (error: any) {
    console.error('Error deleting entry:', error);
    
    if (error.message.includes('Admin privileges required')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }
    
    if (error.message.includes('not found')) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to delete entry' },
      { status: 500 }
    );
  }
}

// Admin: Update entry fields (music or virtual video link)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const entryId = id;
    const body = await request.json();
    const { musicFileUrl, musicFileName, videoExternalUrl, itemName, itemStyle, adminId } = body || {};

    if (itemName !== undefined || itemStyle !== undefined) {
      if (!adminId) {
        return NextResponse.json({ success: false, error: 'Admin ID is required' }, { status: 400 });
      }

      const sqlClient = getSql();
      const admin = await sqlClient`
        SELECT id FROM judges WHERE id = ${adminId} AND is_admin = true
      ` as any[];
      if (admin.length === 0) {
        return NextResponse.json({ success: false, error: 'Admin privileges required' }, { status: 403 });
      }

      const existing = await sqlClient`
        SELECT id, event_id, item_name, item_style, participant_ids, choreographer, performance_type, entry_line_key
        FROM event_entries WHERE id = ${entryId}
      ` as any[];
      if (existing.length === 0) {
        return NextResponse.json({ success: false, error: 'Entry not found' }, { status: 404 });
      }

      const current = existing[0];
      const nextName = itemName !== undefined ? String(itemName).trim() : String(current.item_name || '').trim();
      const nextStyle = itemStyle !== undefined ? String(itemStyle).trim() : String(current.item_style || '').trim();
      const currentStyle = String(current.item_style || '').trim();

      if (!nextName) {
        return NextResponse.json({ success: false, error: 'Item title is required' }, { status: 400 });
      }
      if (nextName.length > 200) {
        return NextResponse.json({ success: false, error: 'Item title must be 200 characters or fewer' }, { status: 400 });
      }
      const styleAllowed = ITEM_STYLES.includes(nextStyle as (typeof ITEM_STYLES)[number]) || nextStyle === currentStyle;
      if (!nextStyle || !styleAllowed) {
        return NextResponse.json({ success: false, error: 'Select a valid dance style' }, { status: 400 });
      }

      const currentKey = current.entry_line_key ? String(current.entry_line_key) : '';
      let nextKey = currentKey || null;
      if (!currentKey || currentKey.startsWith('content:')) {
        nextKey = batchEntryFingerprint(nextName, parseParticipantIds(current.participant_ids), {
          itemStyle: nextStyle,
          choreographer: current.choreographer,
          performanceType: current.performance_type,
        });
        if (nextKey !== currentKey) {
          const clash = await sqlClient`
            SELECT id FROM event_entries
            WHERE event_id = ${current.event_id}
              AND entry_line_key = ${nextKey}
              AND id <> ${entryId}
            LIMIT 1
          ` as any[];
          if (clash.length > 0) {
            return NextResponse.json({
              success: false,
              error: 'Another entry in this event already uses that title and style for the same dancers.'
            }, { status: 409 });
          }
        }
      }

      await sqlClient`
        UPDATE event_entries
        SET item_name = ${nextName}, item_style = ${nextStyle}, entry_line_key = ${nextKey}
        WHERE id = ${entryId}
      `;
      await sqlClient`
        UPDATE performances
        SET title = ${nextName}, item_style = ${nextStyle}
        WHERE event_entry_id = ${entryId}
      `;

      return NextResponse.json({
        success: true,
        message: 'Entry details updated',
        itemName: nextName,
        itemStyle: nextStyle
      });
    }

    // Allow updating either music fields or video link for virtual entries
    if (musicFileUrl && musicFileName) {
      await db.updateEventEntry(entryId, {
        musicFileUrl,
        musicFileName
      });
      return NextResponse.json({ success: true, message: 'Music updated' });
    }

    if (typeof videoExternalUrl === 'string') {
      await db.updateEventEntry(entryId, {
        videoExternalUrl
      } as any);
      return NextResponse.json({ success: true, message: 'Video link updated' });
    }

    return NextResponse.json(
      { success: false, error: 'Provide musicFileUrl+musicFileName or videoExternalUrl' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating entry:', error);
    return NextResponse.json({ success: false, error: 'Failed to update entry' }, { status: 500 });
  }
} 