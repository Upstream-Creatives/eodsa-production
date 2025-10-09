import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // Client access control for dashboard routes
  const protectedDashboards = [
    '/announcer-dashboard',
    '/backstage-dashboard', 
    '/media-dashboard',
    '/registration-dashboard',
    '/event-dashboard',
    '/judge/dashboard'
  ];

  // Check if accessing a protected dashboard
  const isDashboardRoute = protectedDashboards.some(path => 
    request.nextUrl.pathname.startsWith(path)
  );

  if (isDashboardRoute) {
    // Check for client session in cookies or headers
    const clientSession = request.cookies.get('clientSession')?.value;
    
    if (clientSession) {
      try {
        const session = JSON.parse(clientSession);
        const currentPath = request.nextUrl.pathname;
        
        // Extract dashboard ID from path
        let dashboardId = '';
        if (currentPath.startsWith('/judge/dashboard')) {
          dashboardId = 'judge-dashboard';
        } else {
          dashboardId = currentPath.split('/')[1] + '-dashboard';
        }
        
        // Check if client has access to this dashboard
        if (session.userType === 'client' && session.allowedDashboards) {
          if (!session.allowedDashboards.includes(dashboardId)) {
            console.log(`🚫 Client ${session.email} denied access to ${dashboardId}`);
            return NextResponse.redirect(new URL('/client-dashboard?error=access_denied', request.url));
          } else {
            console.log(`✅ Client ${session.email} granted access to ${dashboardId}`);
          }
        }
      } catch (error) {
        console.error('Error parsing client session:', error);
      }
    }
  }
  
  // Special handling for file upload routes
  if (request.nextUrl.pathname.includes('/api/upload/music')) {
    response.headers.set('X-Upload-Route', 'true');
    response.headers.set('X-Max-File-Size', '250MB');
    console.log('🎵 Music upload route accessed');
  }
  
  // Add CORS headers for better cross-origin support
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Add cache control headers for API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
  }
  
  // Handle preflight OPTIONS requests
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: response.headers });
  }
  
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
