const fs = require('fs');
const path = require('path');

// Function to recursively find all dynamic routes
function findDynamicRoutes(dir, basePath = '') {
  const routes = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      if (item.startsWith('[') && item.endsWith(']')) {
        const paramName = item.slice(1, -1);
        const routePath = path.join(basePath, item).replace(/\\/g, '/');
        routes.push({ path: routePath, param: paramName, fullPath });
      }
      
      // Recurse into subdirectories
      routes.push(...findDynamicRoutes(fullPath, path.join(basePath, item)));
    }
  }
  
  return routes;
}

// Find all dynamic routes in the app directory
console.log('🔍 Finding all dynamic routes...\n');
const routes = findDynamicRoutes('app');

// Group routes by their level and check for conflicts
const routesByLevel = {};
for (const route of routes) {
  const level = route.path.split('/').length - 1;
  const pathWithoutParam = route.path.replace(/\[.*?\]/g, '[PARAM]');
  
  if (!routesByLevel[pathWithoutParam]) {
    routesByLevel[pathWithoutParam] = [];
  }
  routesByLevel[pathWithoutParam].push(route);
}

console.log('📊 Routes grouped by path pattern:\n');
for (const [pathPattern, routesAtPath] of Object.entries(routesByLevel)) {
  console.log(`Path: ${pathPattern}`);
  
  if (routesAtPath.length > 1) {
    console.log('⚠️  CONFLICT DETECTED!');
    const params = [...new Set(routesAtPath.map(r => r.param))];
    if (params.length > 1) {
      console.log(`   Different parameter names: ${params.join(', ')}`);
    }
  }
  
  for (const route of routesAtPath) {
    console.log(`   ${route.path} (param: ${route.param})`);
  }
  console.log('');
}

console.log('🎯 Summary:');
console.log(`Found ${routes.length} dynamic routes total`);

const conflicts = Object.entries(routesByLevel).filter(([_, routes]) => {
  if (routes.length <= 1) return false;
  const params = [...new Set(routes.map(r => r.param))];
  return params.length > 1;
});

if (conflicts.length > 0) {
  console.log(`❌ Found ${conflicts.length} conflicting route groups`);
  for (const [pathPattern, conflictingRoutes] of conflicts) {
    console.log(`   ${pathPattern}: ${conflictingRoutes.map(r => r.param).join(' vs ')}`);
  }
} else {
  console.log('✅ No parameter name conflicts found');
}
