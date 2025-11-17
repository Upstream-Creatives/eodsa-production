import { NextResponse } from 'next/server';
import { db, unifiedDb, getSql } from '@/lib/database';
import { calculateAgeOnDate, getAgeCategoryFromAge } from '@/lib/types';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const eventId = id;
    
    // First check if the event exists
    const event = await db.getEventById(eventId);
    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    // Get all event entries for this event
    const allEntries = await db.getAllEventEntries();
    const eventEntries = allEntries.filter(entry => entry.eventId === eventId);
    
    // Enhance entries with contestant/dancer information
    const enhancedEntries = await Promise.all(
      eventEntries.map(async (entry) => {
        try {
          // Compute age category for this entry as of event date
          let computedAgeCategory: string | null = null;
          try {
            const sql = getSql();
            const refDate = event.eventDate ? new Date(event.eventDate) : new Date();
            if (Array.isArray(entry.participantIds) && entry.participantIds.length > 0) {
              const ages = await Promise.all(entry.participantIds.map(async (pid: string) => {
                try {
                  const rows = await sql`
                    SELECT date_of_birth, age FROM dancers
                    WHERE id = ${pid} OR eodsa_id = ${pid}
                    LIMIT 1
                  ` as any[];
                  if (rows.length > 0) {
                    if (rows[0].date_of_birth) {
                      return calculateAgeOnDate(rows[0].date_of_birth, refDate);
                    }
                    if (typeof rows[0].age === 'number' && !Number.isNaN(rows[0].age)) {
                      return rows[0].age as number;
                    }
                  }
                } catch {}
                return null;
              }));
              const valid = ages.filter(a => a !== null) as number[];
              if (valid.length > 0) {
                const avg = Math.round(valid.reduce((s, a) => s + a, 0) / valid.length);
                computedAgeCategory = getAgeCategoryFromAge(avg);
              }
            }
            // If no participant IDs or no valid ages, try contestantId (solo entries)
            if (!computedAgeCategory) {
              try {
                const rows = await sql`
                  SELECT date_of_birth, age FROM dancers
                  WHERE id = ${entry.contestantId} OR eodsa_id = ${entry.contestantId}
                  LIMIT 1
                ` as any[];
                if (rows.length > 0) {
                  let age: number | null = null;
                  if (rows[0].date_of_birth) {
                    age = calculateAgeOnDate(rows[0].date_of_birth, refDate);
                  } else if (typeof rows[0].age === 'number' && !Number.isNaN(rows[0].age)) {
                    age = rows[0].age as number;
                  }
                  if (age !== null) {
                    computedAgeCategory = getAgeCategoryFromAge(age);
                  }
                }
              } catch {}
            }
          } catch {}
          // First try to get as unified system dancer
          const dancer = await unifiedDb.getDancerById(entry.contestantId);
          
          if (dancer) {
            // This is a unified system dancer
            console.log(`Found unified dancer: ${dancer.name} (${dancer.eodsaId})`);
            
            // Get SQL client for direct queries
            const sqlClient = getSql();
            
            // Get studio information for the main contestant via direct SQL query
            const contestantStudioRows = await sqlClient`
              SELECT 
                s.id as studio_id,
                s.name as studio_name,
                s.email as studio_email
              FROM dancers d
              LEFT JOIN studio_applications sa ON d.id = sa.dancer_id AND sa.status = 'accepted'
              LEFT JOIN studios s ON sa.studio_id = s.id
              WHERE d.id = ${entry.contestantId} OR d.eodsa_id = ${entry.contestantId}
              LIMIT 1
            ` as any[];
            
            const contestantStudio = contestantStudioRows.length > 0 ? {
              studioId: contestantStudioRows[0].studio_id,
              studioName: contestantStudioRows[0].studio_name,
              studioEmail: contestantStudioRows[0].studio_email
            } : null;
            
            // Get all participant names and studio info for this entry via direct SQL queries
            const participantDetails = await Promise.all(
              entry.participantIds.map(async (participantId) => {
                try {
                  // Try direct SQL query first for most accurate studio info
                  const participantRows = await sqlClient`
                    SELECT 
                      d.id,
                      d.name,
                      d.eodsa_id,
                      s.id as studio_id,
                      s.name as studio_name,
                      s.email as studio_email
                    FROM dancers d
                    LEFT JOIN studio_applications sa ON d.id = sa.dancer_id AND sa.status = 'accepted'
                    LEFT JOIN studios s ON sa.studio_id = s.id
                    WHERE d.id = ${participantId} OR d.eodsa_id = ${participantId}
                    LIMIT 1
                  ` as any[];
                  
                  if (participantRows.length > 0) {
                    return {
                      name: participantRows[0].name || 'Unknown Dancer',
                      studioName: participantRows[0].studio_name || null,
                      studioId: participantRows[0].studio_id || null,
                      studioEmail: participantRows[0].studio_email || null
                    };
                  }
                  
                  // Fallback to unified system
                  const participant = await unifiedDb.getDancerById(participantId);
                  const allDancers = await unifiedDb.getAllDancers();
                  const participantWithStudio = allDancers.find(d => d.id === participantId);
                  return {
                    name: participant ? participant.name : 'Unknown Dancer',
                    studioName: participantWithStudio?.studioName || null,
                    studioId: participantWithStudio?.studioId || null,
                    studioEmail: participantWithStudio?.studioEmail || null
                  };
                } catch (error) {
                  console.error(`Error fetching participant ${participantId}:`, error);
                  return {
                    name: 'Unknown Dancer',
                    studioName: null,
                    studioId: null,
                    studioEmail: null
                  };
                }
              })
            );
            
            // Get studio from first participant with studio info, or use contestant's studio
            const studioInfo = participantDetails.find(p => p.studioName) || contestantStudio;
            
            return {
              ...entry,
              contestantName: dancer.name,
              contestantEmail: dancer.email || '',
              participantNames: participantDetails.map(p => p.name),
              // Use participant's studio if available, otherwise contestant's studio, otherwise "Independent"
              studioName: studioInfo?.studioName || 'Independent',
              studioId: studioInfo?.studioId || null,
              studioEmail: studioInfo?.studioEmail || null,
              participantStudios: participantDetails.map(p => p.studioName || 'Independent'),
              computedAgeCategory
            };
          } else {
            // Try legacy contestant system
            const contestant = await db.getContestantById(entry.contestantId);
            if (contestant) {
              console.log(`Found legacy contestant: ${contestant.name} (${contestant.eodsaId})`);
              
              // Get SQL client for queries
              const sqlClient = getSql();
              
              // IMPORTANT FIX: Try to get studio from participants instead of contestant
              // Look up each participant in dancers table with studio_applications join
              const participantDetails = await Promise.all(
                entry.participantIds.map(async (participantId) => {
                  try {
                    // Try to find dancer with studio info
                    const dancerRows = await sqlClient`
                      SELECT 
                        d.id,
                        d.name,
                        d.eodsa_id,
                        s.id as studio_id,
                        s.name as studio_name,
                        s.email as studio_email
                      FROM dancers d
                      LEFT JOIN studio_applications sa ON d.id = sa.dancer_id AND sa.status = 'accepted'
                      LEFT JOIN studios s ON sa.studio_id = s.id
                      WHERE d.id = ${participantId}
                    ` as any[];
                    
                    if (dancerRows.length > 0) {
                      return {
                        name: dancerRows[0].name,
                        studioName: dancerRows[0].studio_name || null,
                        studioId: dancerRows[0].studio_id || null,
                        studioEmail: dancerRows[0].studio_email || null
                      };
                    }
                  } catch (error) {
                    console.error(`Error fetching participant ${participantId}:`, error);
                  }
                  
                  // Fallback to contestant dancers
                  const dancer = contestant.dancers.find(d => d.id === participantId);
                  return {
                    name: dancer?.name || 'Unknown Dancer',
                    studioName: null,
                    studioId: null,
                    studioEmail: null
                  };
                })
              );
              
              // Get studio name from first participant with studio info
              const studioInfo = participantDetails.find(p => p.studioName);
              
              return {
                ...entry,
                contestantName: contestant.name,
                contestantEmail: contestant.email || '',
                participantNames: participantDetails.map(p => p.name),
                // Use studio from participants if available, otherwise "Independent"
                studioName: studioInfo?.studioName || 'Independent',
                studioId: studioInfo?.studioId || null,
                studioEmail: studioInfo?.studioEmail || null,
                participantStudios: participantDetails.map(p => p.studioName || 'Independent'),
                computedAgeCategory
              };
            } else {
              console.error(`Could not find contestant or dancer for ID: ${entry.contestantId}`);
              // Fallback: Try to get studio from participants via studio_applications
              try {
                const sqlClient = getSql();
                const { unifiedDb } = await import('@/lib/database');
                
                // First, try to get studio from participants via studio_applications
                let participantStudioInfo: { studioName: string | null; studioId: string | null; studioEmail: string | null } | null = null;
                const participantDetails: Array<{ name: string; studioName: string | null }> = [];
                
                if (Array.isArray(entry.participantIds) && entry.participantIds.length > 0) {
                  for (const participantId of entry.participantIds) {
                    try {
                      // Try to get dancer with studio info from database
                      const dancerRows = await sqlClient`
                        SELECT 
                          d.id,
                          d.name,
                          d.eodsa_id,
                          s.id as studio_id,
                          s.name as studio_name,
                          s.email as studio_email
                        FROM dancers d
                        LEFT JOIN studio_applications sa ON d.id = sa.dancer_id AND sa.status = 'accepted'
                        LEFT JOIN studios s ON sa.studio_id = s.id
                        WHERE d.id = ${participantId} OR d.eodsa_id = ${participantId}
                        LIMIT 1
                      ` as any[];
                      
                      if (dancerRows.length > 0) {
                        const row = dancerRows[0];
                        participantDetails.push({
                          name: row.name || 'Unknown Dancer',
                          studioName: row.studio_name || null
                        });
                        
                        // Use first participant's studio if we don't have one yet
                        if (!participantStudioInfo && row.studio_name) {
                          participantStudioInfo = {
                            studioName: row.studio_name,
                            studioId: row.studio_id,
                            studioEmail: row.studio_email
                          };
                        }
                      } else {
                        // Try unified system as fallback
                        try {
                          const p = await unifiedDb.getDancerById(participantId);
                          const allDancers = await unifiedDb.getAllDancers();
                          const pWithStudio = allDancers.find(d => d.id === participantId);
                          participantDetails.push({
                            name: p?.name || 'Unknown Dancer',
                            studioName: pWithStudio?.studioName || null
                          });
                          
                          if (!participantStudioInfo && pWithStudio?.studioName) {
                            participantStudioInfo = {
                              studioName: pWithStudio.studioName,
                              studioId: pWithStudio.studioId || null,
                              studioEmail: pWithStudio.studioEmail || null
                            };
                          }
                        } catch {
                          participantDetails.push({
                            name: 'Unknown Dancer',
                            studioName: null
                          });
                        }
                      }
                    } catch (error) {
                      console.error(`Error fetching participant ${participantId}:`, error);
                      participantDetails.push({
                        name: 'Unknown Dancer',
                        studioName: null
                      });
                    }
                  }
                }
                
                // If still no studio, try matching by registration number
                if (!participantStudioInfo) {
                  const allStudios = await unifiedDb.getAllStudios?.();
                  const matchedStudio = Array.isArray(allStudios)
                    ? allStudios.find((s: any) => s.registrationNumber === entry.eodsaId)
                    : null;
                  
                  if (matchedStudio) {
                    participantStudioInfo = {
                      studioName: matchedStudio.name,
                      studioId: matchedStudio.id,
                      studioEmail: matchedStudio.email
                    };
                  }
                }

                return {
                  ...entry,
                  contestantName: participantDetails.length > 0 
                    ? participantDetails.map(p => p.name).join(', ')
                    : entry.eodsaId || 'Unknown',
                  contestantEmail: '',
                  participantNames: participantDetails.length > 0 
                    ? participantDetails.map(p => p.name)
                    : ['Participant 1'],
                  studioName: participantStudioInfo?.studioName || 'Independent',
                  studioId: participantStudioInfo?.studioId || null,
                  studioEmail: participantStudioInfo?.studioEmail || null,
                  participantStudios: participantDetails.length > 0
                    ? participantDetails.map(p => p.studioName || 'Independent')
                    : ['Independent'],
                  computedAgeCategory
                };
              } catch (fallbackErr) {
                console.error('Studio fallback lookup failed:', fallbackErr);
                return {
                  ...entry,
                  contestantName: entry.eodsaId || 'Unknown (Not Found)',
                  contestantEmail: '',
                  participantNames: (entry.participantIds || []).map((_: any, i: number) => `Participant ${i + 1}`),
                  studioName: 'Independent',
                  studioId: null,
                  studioEmail: null,
                  participantStudios: (entry.participantIds || []).map(() => 'Independent'),
                  computedAgeCategory
                };
              }
            }
          }
        } catch (error) {
          console.error(`Error loading contestant/dancer ${entry.contestantId}:`, error);
          return {
            ...entry,
            contestantName: 'Error loading',
            contestantEmail: '',
            participantNames: ['Error loading dancers'],
            studioName: 'Error loading',
            studioId: null,
            studioEmail: null,
            participantStudios: ['Error loading']
          };
        }
      })
    );

    console.log(`Enhanced ${enhancedEntries.length} entries for event ${eventId}`);
    
    return NextResponse.json({
      success: true,
      entries: enhancedEntries
    });
  } catch (error) {
    console.error('Error fetching event entries:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch event entries' },
      { status: 500 }
    );
  }
} 