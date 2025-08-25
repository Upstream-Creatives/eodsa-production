import { useEffect, useState } from 'react';

declare global {
  interface Window {
    grecaptcha: any;
  }
}

export const useRecaptcha = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    // Check if reCAPTCHA is already loaded
    if (window.grecaptcha) {
      setIsLoaded(true);
      return;
    }

    // Load reCAPTCHA script with retry logic
    const loadRecaptcha = async (attempt = 1) => {
      setIsLoading(true);
      setHasError(false);

      try {
        // Add timeout and retry logic for geographic connectivity issues
        const script = document.createElement('script');
        script.src = `https://www.google.com/recaptcha/api.js?render=${process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY}`;
        script.async = true;
        script.defer = true;
        
        // Create a promise with timeout for better error handling
        const loadPromise = new Promise((resolve, reject) => {
          script.onload = () => {
            console.log('✅ reCAPTCHA loaded successfully');
            resolve(true);
          };
          
          script.onerror = () => {
            const error = new Error(`Failed to load reCAPTCHA (attempt ${attempt})`);
            console.error('❌ reCAPTCHA load error:', error);
            reject(error);
          };

          // Add timeout for slow connections (common in some regions)
          setTimeout(() => {
            if (!window.grecaptcha) {
              reject(new Error(`reCAPTCHA load timeout after ${attempt} attempts`));
            }
          }, 15000); // 15 second timeout
        });

        document.head.appendChild(script);
        await loadPromise;
        
        setIsLoaded(true);
        setIsLoading(false);
        setRetryCount(attempt);
        
      } catch (error) {
        console.error(`reCAPTCHA load failed (attempt ${attempt}):`, error);
        
        // Retry logic for geographic connectivity issues
        if (attempt < 3) {
          console.log(`🔄 Retrying reCAPTCHA load in ${attempt * 2} seconds...`);
          setTimeout(() => {
            loadRecaptcha(attempt + 1);
          }, attempt * 2000); // Progressive delay: 2s, 4s
        } else {
          console.error('❌ reCAPTCHA failed to load after 3 attempts');
          setHasError(true);
          setIsLoading(false);
          setRetryCount(attempt);
        }
      }
    };

    loadRecaptcha();

    return () => {
      // Cleanup: remove script if component unmounts
      const existingScript = document.querySelector(`script[src*="recaptcha"]`);
      if (existingScript) {
        document.head.removeChild(existingScript);
      }
    };
  }, []);

  const executeRecaptcha = async (action: string = 'submit'): Promise<string | null> => {
    if (hasError) {
      console.warn('⚠️ reCAPTCHA failed to load - proceeding without verification');
      return null;
    }

    if (!isLoaded || !window.grecaptcha) {
      console.error('❌ reCAPTCHA not loaded yet');
      return null;
    }

    try {
      console.log(`🔒 Executing reCAPTCHA for action: ${action}`);
      const token = await window.grecaptcha.execute(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY, {
        action: action
      });
      console.log('✅ reCAPTCHA token generated successfully');
      return token;
    } catch (error) {
      console.error('❌ reCAPTCHA execution failed:', error);
      return null;
    }
  };

  // Manual retry function for user-initiated retries
  const retryRecaptcha = () => {
    if (retryCount < 5) { // Allow manual retries up to 5 times
      console.log('🔄 Manual reCAPTCHA retry initiated');
      setHasError(false);
      setIsLoaded(false);
      window.location.reload(); // Simple reload for manual retry
    }
  };

  return {
    isLoaded,
    isLoading,
    hasError,
    retryCount,
    executeRecaptcha,
    retryRecaptcha
  };
}; 