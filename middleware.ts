import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Log geographic information for debugging
  const country = request.geo?.country || 'unknown';
  const region = request.geo?.region || 'unknown';
  const city = request.geo?.city || 'unknown';
  const ip = request.ip || 'unknown';
  
  console.log(`🌍 Request from: ${country}/${region}/${city} (IP: ${ip})`);
  
  // Add geographic headers for debugging
  const response = NextResponse.next();
  
  // Special handling for file upload routes - increase timeout
  if (request.nextUrl.pathname.includes('/api/upload/music')) {
    response.headers.set('X-Upload-Route', 'true');
    response.headers.set('X-Max-File-Size', '250MB');
    console.log('🎵 Music upload route accessed');
  }
  
  // Add CORS headers for better cross-origin support
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Add geographic information to response headers for debugging
  response.headers.set('X-Geo-Country', country);
  response.headers.set('X-Geo-Region', region);
  response.headers.set('X-Client-IP', ip);
  
  // Add cache control headers to prevent caching issues in different regions
  if (request.nextUrl.pathname.startsWith('/api/')) {
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
  }
  
  // Special handling for South African users
  if (country === 'ZA' || country === 'South Africa') {
    console.log('🇿🇦 South African user detected - applying optimizations');
    
    // Add longer timeout headers for South African users
    response.headers.set('X-South-Africa-Optimized', 'true');
    response.headers.set('Keep-Alive', 'timeout=30, max=100');
    
    // Log for debugging geographic issues
    console.log(`🔍 SA User Debug Info:`, {
      path: request.nextUrl.pathname,
      userAgent: request.headers.get('user-agent'),
      referer: request.headers.get('referer'),
      timestamp: new Date().toISOString()
    });
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
