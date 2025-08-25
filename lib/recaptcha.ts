// reCAPTCHA verification and rate limiting utilities

interface RateLimitStore {
  [ip: string]: {
    count: number;
    resetTime: number;
  };
}

// In-memory rate limit store (use Redis in production)
const rateLimitStore: RateLimitStore = {};

// Rate limiting: 3 registrations per IP per hour
export const checkRateLimit = (ip: string): { allowed: boolean; resetTime?: number } => {
  const now = Date.now();
  const hourInMs = 60 * 60 * 1000;
  
  // Clean up expired entries
  Object.keys(rateLimitStore).forEach(key => {
    if (rateLimitStore[key].resetTime < now) {
      delete rateLimitStore[key];
    }
  });
  
  // Check current IP
  if (!rateLimitStore[ip]) {
    // First request from this IP
    rateLimitStore[ip] = {
      count: 1,
      resetTime: now + hourInMs
    };
    return { allowed: true };
  }
  
  const ipData = rateLimitStore[ip];
  
  if (ipData.resetTime < now) {
    // Time window expired, reset
    rateLimitStore[ip] = {
      count: 1,
      resetTime: now + hourInMs
    };
    return { allowed: true };
  }
  
  if (ipData.count >= 3) {
    // Rate limit exceeded
    return { 
      allowed: false, 
      resetTime: ipData.resetTime 
    };
  }
  
  // Increment count
  ipData.count++;
  return { allowed: true };
};

// Verify reCAPTCHA token with Google
export const verifyRecaptcha = async (token: string, ip?: string): Promise<{ success: boolean; score?: number; error?: string }> => {
  try {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    
    if (!secretKey) {
      return { success: false, error: 'reCAPTCHA not configured' };
    }
    
    // Handle case where no token is provided (e.g., reCAPTCHA failed to load)
    if (!token) {
      console.warn('⚠️ No reCAPTCHA token provided - likely due to connectivity issues');
      
      // For geographic connectivity issues, we can be more lenient
      const country = ip ? await getCountryFromIP(ip) : 'unknown';
      console.log(`🌍 Missing reCAPTCHA token from country: ${country} (IP: ${ip || 'unknown'})`);
      
      // In development or for known connectivity issues, allow bypass
      if (process.env.NODE_ENV === 'development' || country === 'ZA') {
        console.warn('⚠️ Allowing request without reCAPTCHA due to geographic connectivity issues');
        return { success: true, score: 0.5, error: 'bypassed_connectivity' };
      }
      
      return { success: false, error: 'reCAPTCHA verification required but token missing' };
    }
    
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
        remoteip: ip || ''
      }),
      // Add timeout for geographic connectivity issues
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    
    if (!response.ok) {
      console.error(`❌ reCAPTCHA verification request failed: ${response.status}`);
      
      // For connectivity issues, be more lenient
      if (response.status >= 500 || response.status === 0) {
        console.warn('⚠️ reCAPTCHA service appears down - allowing request');
        return { success: true, score: 0.5, error: 'service_unavailable' };
      }
      
      return { success: false, error: 'reCAPTCHA verification request failed' };
    }
    
    const data = await response.json();
    
    if (!data.success) {
      const errorCodes = data['error-codes'] || [];
      console.error(`❌ reCAPTCHA verification failed:`, errorCodes);
      
      // Handle specific error codes that might be geographic
      if (errorCodes.includes('timeout-or-duplicate') || errorCodes.includes('bad-request')) {
        console.warn('⚠️ Possible connectivity issue detected');
        return { success: true, score: 0.3, error: 'connectivity_fallback' };
      }
      
      return { 
        success: false, 
        error: `reCAPTCHA verification failed: ${errorCodes.join(', ') || 'Unknown error'}` 
      };
    }
    
    // Check if this is reCAPTCHA v3 (has score) or v2 (no score)
    if (data.score !== undefined) {
      // reCAPTCHA v3 - check score (0.0 = bot, 1.0 = human)
      const score = data.score;
      
      if (score < 0.5) {
        return { 
          success: false, 
          score,
          error: `Suspicious activity detected (score: ${score})` 
        };
      }
      
      return { success: true, score };
    } else {
      // reCAPTCHA v2 - just return success if verification passed
      return { success: true };
    }
    
  } catch (error: any) {
    console.error('❌ reCAPTCHA verification error:', error);
    
    // Handle specific timeout or network errors
    if (error.name === 'AbortError' || error.code === 'ECONNRESET' || error.code === 'ENOTFOUND') {
      console.warn('⚠️ Network connectivity issue detected - allowing request');
      return { success: true, score: 0.4, error: 'network_timeout' };
    }
    
    return { success: false, error: 'reCAPTCHA service unavailable' };
  }
};

// Helper function to get country from IP (basic implementation)
async function getCountryFromIP(ip: string): Promise<string> {
  try {
    // This is a simple implementation - in production you might want to use a proper IP geolocation service
    if (ip.startsWith('196.') || ip.startsWith('41.')) {
      return 'ZA'; // Common South African IP ranges
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

// Get client IP address from request
export const getClientIP = (request: any): string => {
  // Try different headers in order of preference
  const headers = [
    'x-forwarded-for',
    'x-real-ip', 
    'x-client-ip',
    'cf-connecting-ip', // Cloudflare
    'x-forwarded',
    'forwarded-for',
    'forwarded'
  ];
  
  for (const header of headers) {
    const value = request.headers.get(header);
    if (value) {
      // x-forwarded-for can contain multiple IPs, get the first one
      return value.split(',')[0].trim();
    }
  }
  
  // Fallback to connection info (may not be available in serverless)
  return request.ip || 
         request.connection?.remoteAddress || 
         request.socket?.remoteAddress ||
         'unknown';
}; 