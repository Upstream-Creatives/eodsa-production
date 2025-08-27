const { unifiedDb, initializeDatabase, getSql } = require('../lib/database.ts');

const VALID_STYLES = [
  'Ballet',
  'Ballet Repertoire', 
  'Lyrical',
  'Contemporary',
  'Jazz',
  'Hip-Hop',
  'Freestyle/Disco',
  'Musical Theatre',
  'Acrobatics',
  'Tap',
  'Open',
  'Speciality Styles'
];

// Style mapping for common invalid styles to valid ones
const STYLE_MAPPING = {
  // Common variations and corrections
  'ballet': 'Ballet',
  'Ballet Classical': 'Ballet',
  'Classical Ballet': 'Ballet',
  'Neo-Classical': 'Ballet',
  
  'contemporary': 'Contemporary',
  'Contemporary Modern': 'Contemporary',
  'Modern': 'Contemporary',
  'Lyrical Contemporary': 'Contemporary',
  
  'jazz': 'Jazz',
  'Jazz Modern': 'Jazz',
  'Commercial Jazz': 'Jazz',
  'Jazz Funk': 'Jazz',
  
  'hiphop': 'Hip-Hop',
  'Hip Hop': 'Hip-Hop',
  'hip-hop': 'Hip-Hop',
  'Commercial Hip Hop': 'Hip-Hop',
  
  'musical theater': 'Musical Theatre',
  'Musical Theater': 'Musical Theatre',
  'Theatre': 'Musical Theatre',
  'Broadway': 'Musical Theatre',
  
  'tap': 'Tap',
  'Tap Dance': 'Tap',
  'Rhythm Tap': 'Tap',
  'Broadway Tap': 'Tap',
  
  'acro': 'Acrobatics',
  'Acro': 'Acrobatics',
  'Acrobatic': 'Acrobatics',
  'Acrobatic Dance': 'Acrobatics',
  
  'lyrical': 'Lyrical',
  'Lyrical Dance': 'Lyrical',
  
  'freestyle': 'Freestyle/Disco',
  'Freestyle': 'Freestyle/Disco',
  'Disco': 'Freestyle/Disco',
  'Commercial': 'Freestyle/Disco',
  
  'specialty': 'Speciality Styles',
  'Specialty Styles': 'Speciality Styles',
  'Cultural': 'Speciality Styles',
  'Traditional': 'Speciality Styles',
  'Character': 'Speciality Styles',
  'Folk': 'Speciality Styles',
  
  'open': 'Open',
  'Open Style': 'Open',
  'Open Category': 'Open',
  'Mixed': 'Open',
  
  // Default fallbacks
  'MISSING_STYLE': 'Open',
  '': 'Open',
  null: 'Open',
  undefined: 'Open'
};

async function cleanDanceStyles() {
  try {
    await initializeDatabase();
    const sqlClient = getSql();
    
    console.log('🧹 DANCE STYLE CLEANUP STARTING...\n');
    
    let totalFixed = 0;
    
    // ===== CLEAN EVENT ENTRIES =====
    console.log('🎪 Cleaning Event Entries...');
    const entries = await unifiedDb.getAllEventEntries();
    
    const entryUpdates = [];
    entries.forEach(entry => {
      const currentStyle = entry.itemStyle || 'MISSING_STYLE';
      
      if (!VALID_STYLES.includes(currentStyle)) {
        // Try to map the invalid style to a valid one
        let newStyle = STYLE_MAPPING[currentStyle];
        
        // If no direct mapping, try fuzzy matching
        if (!newStyle) {
          const lowerCurrent = currentStyle.toLowerCase();
          for (const [invalid, valid] of Object.entries(STYLE_MAPPING)) {
            if (lowerCurrent.includes(invalid.toLowerCase()) || invalid.toLowerCase().includes(lowerCurrent)) {
              newStyle = valid;
              break;
            }
          }
        }
        
        // Default to 'Open' if we can't map it
        if (!newStyle) {
          newStyle = 'Open';
        }
        
        entryUpdates.push({
          id: entry.id,
          oldStyle: currentStyle,
          newStyle: newStyle,
          itemName: entry.itemName || 'Unnamed Item'
        });
      }
    });
    
    console.log(`Found ${entryUpdates.length} event entries to update:`);
    for (const update of entryUpdates) {
      console.log(`  📝 "${update.itemName}": "${update.oldStyle}" → "${update.newStyle}"`);
      
      try {
        await sqlClient`
          UPDATE event_entries 
          SET item_style = ${update.newStyle} 
          WHERE id = ${update.id}
        `;
        totalFixed++;
      } catch (error) {
        console.error(`    ❌ Failed to update entry ${update.id}:`, error.message);
      }
    }
    
    // ===== CLEAN PERFORMANCES =====
    console.log('\n🎭 Cleaning Performances...');
    const performances = await unifiedDb.getAllPerformances();
    
    const perfUpdates = [];
    performances.forEach(perf => {
      const currentStyle = perf.itemStyle || 'MISSING_STYLE';
      
      if (!VALID_STYLES.includes(currentStyle)) {
        let newStyle = STYLE_MAPPING[currentStyle];
        
        if (!newStyle) {
          const lowerCurrent = currentStyle.toLowerCase();
          for (const [invalid, valid] of Object.entries(STYLE_MAPPING)) {
            if (lowerCurrent.includes(invalid.toLowerCase()) || invalid.toLowerCase().includes(lowerCurrent)) {
              newStyle = valid;
              break;
            }
          }
        }
        
        if (!newStyle) {
          newStyle = 'Open';
        }
        
        perfUpdates.push({
          id: perf.id,
          oldStyle: currentStyle,
          newStyle: newStyle,
          title: perf.title || 'Unnamed Performance'
        });
      }
    });
    
    console.log(`Found ${perfUpdates.length} performances to update:`);
    for (const update of perfUpdates) {
      console.log(`  📝 "${update.title}": "${update.oldStyle}" → "${update.newStyle}"`);
      
      try {
        await sqlClient`
          UPDATE performances 
          SET item_style = ${update.newStyle} 
          WHERE id = ${update.id}
        `;
        totalFixed++;
      } catch (error) {
        console.error(`    ❌ Failed to update performance ${update.id}:`, error.message);
      }
    }
    
    // ===== CLEAN RANKINGS (if they exist) =====
    console.log('\n🏆 Checking Rankings...');
    try {
      // Check if rankings have any style-related issues
      const rankings = await sqlClient`SELECT * FROM rankings WHERE item_style IS NOT NULL`;
      
      const rankingUpdates = [];
      rankings.forEach(ranking => {
        const currentStyle = ranking.item_style;
        if (currentStyle && !VALID_STYLES.includes(currentStyle)) {
          let newStyle = STYLE_MAPPING[currentStyle] || 'Open';
          rankingUpdates.push({
            id: ranking.id,
            oldStyle: currentStyle,
            newStyle: newStyle
          });
        }
      });
      
      if (rankingUpdates.length > 0) {
        console.log(`Found ${rankingUpdates.length} rankings to update:`);
        for (const update of rankingUpdates) {
          console.log(`  📝 Ranking ${update.id}: "${update.oldStyle}" → "${update.newStyle}"`);
          
          try {
            await sqlClient`
              UPDATE rankings 
              SET item_style = ${update.newStyle} 
              WHERE id = ${update.id}
            `;
            totalFixed++;
          } catch (error) {
            console.error(`    ❌ Failed to update ranking ${update.id}:`, error.message);
          }
        }
      } else {
        console.log('✅ Rankings are clean!');
      }
    } catch (error) {
      console.log('📝 Rankings table not found or no style column - skipping');
    }
    
    // ===== VALIDATION CHECK =====
    console.log('\n🔍 VALIDATION CHECK...');
    
    // Re-audit to confirm cleanup
    const updatedEntries = await unifiedDb.getAllEventEntries();
    const stillInvalidEntries = updatedEntries.filter(entry => 
      !VALID_STYLES.includes(entry.itemStyle || '')
    );
    
    const updatedPerformances = await unifiedDb.getAllPerformances();
    const stillInvalidPerf = updatedPerformances.filter(perf => 
      !VALID_STYLES.includes(perf.itemStyle || '')
    );
    
    console.log('\n📊 CLEANUP SUMMARY:');
    console.log('═'.repeat(50));
    console.log(`✅ Total items fixed: ${totalFixed}`);
    console.log(`📝 Event entries still invalid: ${stillInvalidEntries.length}`);
    console.log(`🎭 Performances still invalid: ${stillInvalidPerf.length}`);
    
    if (stillInvalidEntries.length === 0 && stillInvalidPerf.length === 0) {
      console.log('\n🎉 SUCCESS! All dance styles are now valid!');
      console.log('✨ Database cleanup complete!');
    } else {
      console.log('\n⚠️  Some items still need manual review:');
      stillInvalidEntries.forEach(entry => {
        console.log(`❌ Entry: "${entry.itemName}" has style "${entry.itemStyle}"`);
      });
      stillInvalidPerf.forEach(perf => {
        console.log(`❌ Performance: "${perf.title}" has style "${perf.itemStyle}"`);
      });
    }
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
}

// Show help if called with --help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('🧹 Dance Style Cleanup Tool');
  console.log('══════════════════════════');
  console.log('');
  console.log('This script cleans up invalid dance styles in the database by:');
  console.log('1. Mapping common variations to valid EODSA styles');
  console.log('2. Setting unrecognized styles to "Open"');
  console.log('3. Updating both event_entries and performances tables');
  console.log('');
  console.log('Valid styles:');
  VALID_STYLES.forEach(style => console.log(`  • ${style}`));
  console.log('');
  console.log('Usage: node scripts/clean-dance-styles.js');
  console.log('');
  process.exit(0);
}

// Only run if called directly
if (require.main === module) {
  cleanDanceStyles();
}

module.exports = { cleanDanceStyles, VALID_STYLES, STYLE_MAPPING }; 