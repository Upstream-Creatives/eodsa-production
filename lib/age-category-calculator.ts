import { getAgeCategoryFromAge, calculateAgeOnDate } from './types';
import { unifiedDb } from './database';

/**
 * Calculate age category for a performance based on participant ages
 * This is a helper function that can be used anywhere in the application
 */
export async function calculateAgeCategoryForEntry(
  participantIds: string[],
  eventDate: string,
  sqlClient: any
): Promise<string> {
  try {
    if (!participantIds || participantIds.length === 0) {
      return 'N/A';
    }

    // Get ages of all participants
    const participantAges = await Promise.all(
      participantIds.map(async (participantId: string) => {
        try {
          // Try unified system first
          const dancer = await unifiedDb.getDancerById(participantId);
          if (dancer && dancer.age) {
            return dancer.age;
          }

          // Try old system
          const result = await sqlClient`
            SELECT age, date_of_birth FROM dancers
            WHERE id = ${participantId} OR eodsa_id = ${participantId}
          ` as any[];

          if (result.length > 0) {
            if (result[0].age) {
              return result[0].age;
            }
            if (result[0].date_of_birth) {
              return calculateAgeOnDate(result[0].date_of_birth, new Date(eventDate));
            }
          }
          return null;
        } catch (error) {
          console.warn(`Could not get age for participant ${participantId}:`, error);
          return null;
        }
      })
    );

    // Filter out null values and calculate average age
    const validAges = participantAges.filter(age => age !== null) as number[];

    if (validAges.length === 0) {
      return 'N/A';
    }

    const averageAge = Math.round(
      validAges.reduce((sum, age) => sum + age, 0) / validAges.length
    );

    const category = getAgeCategoryFromAge(averageAge);

    console.log(`✅ Age category calculated: ${category} (avg age: ${averageAge} from ${validAges.length} dancers: ${validAges.join(', ')})`);

    return category;
  } catch (error) {
    console.error('Error calculating age category:', error);
    return 'N/A';
  }
}

/**
 * Batch calculate age categories for multiple entries
 * More efficient for bulk operations like CSV exports
 */
export async function calculateAgeCategoriesForEntries(
  entries: Array<{ participantIds: string[]; eventDate: string }>,
  sqlClient: any
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  for (const entry of entries) {
    const entryKey = entry.participantIds.sort().join(',');
    const category = await calculateAgeCategoryForEntry(
      entry.participantIds,
      entry.eventDate,
      sqlClient
    );
    results.set(entryKey, category);
  }

  return results;
}
