const { unifiedDb, initializeDatabase } = require('../lib/database.ts');

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

async function auditDanceStyles() {
  try {
    await initializeDatabase();
    
    console.log('🔍 DANCE STYLE AUDIT STARTING...\n');
    
    // Get all event entries with their item styles
    const entries = await unifiedDb.getAllEventEntries();
    
    console.log(`📊 Total event entries: ${entries.length}\n`);
    
    const styleCount = {};
    const invalidEntries = [];
    
    entries.forEach(entry => {
      const style = entry.itemStyle || 'MISSING_STYLE';
      styleCount[style] = (styleCount[style] || 0) + 1;
      
      if (!VALID_STYLES.includes(style) && style !== 'MISSING_STYLE') {
        invalidEntries.push({
          id: entry.id,
          itemName: entry.itemName || 'Unnamed Item',
          style: style,
          contestant: entry.contestantName || 'Unknown Contestant',
          eodsaId: entry.eodsaId
        });
      }
    });
    
    console.log('📈 STYLE USAGE BREAKDOWN:');
    console.log('═'.repeat(50));
    Object.entries(styleCount)
      .sort(([,a], [,b]) => b - a)
      .forEach(([style, count]) => {
        const isValid = VALID_STYLES.includes(style);
        const icon = isValid ? '✅' : '❌';
        console.log(`${icon} ${style.padEnd(20)} : ${count} entries`);
      });
    
    console.log('\n🚨 INVALID ENTRIES FOUND:');
    console.log('═'.repeat(50));
    if (invalidEntries.length === 0) {
      console.log('✅ No invalid dance styles found! Database is clean.');
    } else {
      console.log(`❌ Found ${invalidEntries.length} entries with invalid styles:\n`);
      invalidEntries.forEach((entry, index) => {
        console.log(`${index + 1}. ${entry.itemName}`);
        console.log(`   └─ Contestant: ${entry.contestant} (${entry.eodsaId})`);
        console.log(`   └─ Invalid Style: "${entry.style}"`);
        console.log(`   └─ Entry ID: ${entry.id}\n`);
      });
    }
    
    // Check performances table too
    console.log('🎭 CHECKING PERFORMANCES TABLE...');
    const performances = await unifiedDb.getAllPerformances();
    const perfInvalidEntries = [];
    
    performances.forEach(perf => {
      const style = perf.itemStyle || 'MISSING_STYLE';
      if (!VALID_STYLES.includes(style) && style !== 'MISSING_STYLE') {
        perfInvalidEntries.push({
          id: perf.id,
          title: perf.title || 'Unnamed Performance',
          style: style
        });
      }
    });
    
    if (perfInvalidEntries.length === 0) {
      console.log('✅ Performances table is clean!\n');
    } else {
      console.log(`❌ Found ${perfInvalidEntries.length} performances with invalid styles:\n`);
      perfInvalidEntries.forEach((perf, index) => {
        console.log(`${index + 1}. ${perf.title} - "${perf.style}" (ID: ${perf.id})`);
      });
    }
    
    // Summary
    console.log('📋 AUDIT SUMMARY:');
    console.log('═'.repeat(50));
    console.log(`Total Event Entries: ${entries.length}`);
    console.log(`Invalid Event Entries: ${invalidEntries.length}`);
    console.log(`Total Performances: ${performances.length}`);
    console.log(`Invalid Performances: ${perfInvalidEntries.length}`);
    console.log(`Total Issues: ${invalidEntries.length + perfInvalidEntries.length}`);
    
    if (invalidEntries.length > 0 || perfInvalidEntries.length > 0) {
      console.log('\n🔧 To fix these issues, run: node scripts/clean-dance-styles.js');
    } else {
      console.log('\n🎉 Database is clean! No action needed.');
    }
    
  } catch (error) {
    console.error('❌ Audit failed:', error);
  }
}

auditDanceStyles(); 