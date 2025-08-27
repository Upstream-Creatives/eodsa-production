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
    });
    
    const data = await response.json();
    
    if (!data.success) {
      return { 
        success: false, 
        error: `reCAPTCHA verification failed: ${data['error-codes']?.join(', ') || 'Unknown error'}` 
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
    
  } catch (error) {
    console.error('reCAPTCHA verification error:', error);
    return { success: false, error: 'reCAPTCHA service unavailable' };
  }
};

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