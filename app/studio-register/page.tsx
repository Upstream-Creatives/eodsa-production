'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { RecaptchaV2 } from '@/components/RecaptchaV2';
import { useRouter } from 'next/navigation';

interface StudioRegistrationForm {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  contactPerson: string;
  address: string;
  phone: string;
}

export default function StudioRegisterPage() {
  const [formData, setFormData] = useState<StudioRegistrationForm>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    contactPerson: '',
    address: '',
    phone: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [error, setError] = useState('');
  const [recaptchaToken, setRecaptchaToken] = useState<string>('');
  const [nameValidationTimeout, setNameValidationTimeout] = useState<NodeJS.Timeout | null>(null);
  const router = useRouter();

  // Cleanup timeout on component unmount
  useEffect(() => {
    return () => {
      if (nameValidationTimeout) {
        clearTimeout(nameValidationTimeout);
      }
    };
  }, [nameValidationTimeout]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // Validate phone number to allow only digits, spaces, hyphens, parentheses, and plus with auto-formatting
    if (name === 'phone') {
      const cleanValue = value.replace(/[^0-9\s\-\(\)\+]/g, '');
      // Limit to 15 characters total (international format)
      const limitedValue = cleanValue.slice(0, 15);
      
      // Auto-format: XXX XXX XXXX (for 10-digit numbers)
      const numbersOnly = limitedValue.replace(/\D/g, '');
      let formattedValue = limitedValue;
      
      if (numbersOnly.length <= 10 && !limitedValue.includes('+')) {
        if (numbersOnly.length >= 3) {
          formattedValue = numbersOnly.slice(0, 3);
          if (numbersOnly.length >= 6) {
            formattedValue += ' ' + numbersOnly.slice(3, 6);
            if (numbersOnly.length > 6) {
              formattedValue += ' ' + numbersOnly.slice(6, 10);
            }
          } else if (numbersOnly.length > 3) {
            formattedValue += ' ' + numbersOnly.slice(3);
          }
        } else {
          formattedValue = numbersOnly;
        }
      }
      
      setFormData(prev => ({
        ...prev,
        [name]: formattedValue
      }));
      return;
    }
    
    // Validate contact person name to allow only letters, spaces, hyphens, and apostrophes
    // Also ensure at least one space is present (first name + last name)
    if (name === 'contactPerson') {
      const cleanValue = value.replace(/[^a-zA-Z\s\-\']/g, '');
      
      // Clear existing timeout
      if (nameValidationTimeout) {
        clearTimeout(nameValidationTimeout);
      }
      
      const hasSpace = cleanValue.includes(' ');
      
      // Show warning if name doesn't contain a space and has more than 2 characters
      if (!hasSpace && cleanValue.length > 2) {
        const newTimeout = setTimeout(() => {
          if (!cleanValue.includes(' ')) {
            setError('Please enter the contact person\'s full name (first name and last name separated by a space).');
          }
        }, 3000); // Increased timeout to 3 seconds
        setNameValidationTimeout(newTimeout);
      }
      
      setFormData(prev => ({
        ...prev,
        [name]: cleanValue
      }));
      return;
    }
    
    // Validate email format in real-time
    if (name === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (value && !emailRegex.test(value)) {
        setError('Please enter a valid email address');
      } else {
        setError('');
      }
    }
    
    // Validate password strength in real-time
    if (name === 'password') {
      if (value.length < 8) {
        setError('Password must be at least 8 characters long');
      } else if (!/[A-Z]/.test(value)) {
        setError('Password must contain at least one uppercase letter');
      } else if (!/[a-z]/.test(value)) {
        setError('Password must contain at least one lowercase letter');
      } else if (!/[0-9]/.test(value)) {
        setError('Password must contain at least one number');
      } else if (!/[!@#$%^&*(),.?":{}|<>]/.test(value)) {
        setError('Password must contain at least one special character (!@#$%^&*(),.?":{}|<>)');
      } else {
        setError('');
      }
    }
    
    // Keep whitespace for text inputs except password fields (to allow spaces during typing)
    const processedValue = (name === 'password' || name === 'confirmPassword') ? value : value;
    
    setFormData(prev => ({
      ...prev,
      [name]: processedValue
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setIsSubmitting(false);
      return;
    }

    // Validate that contact person name contains at least one space (first name + last name)
    if (!formData.contactPerson.trim().includes(' ')) {
      setError('Please enter the contact person\'s full name with both first name and last name separated by a space.');
      setIsSubmitting(false);
      return;
    }

    // Validate password strength
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      setIsSubmitting(false);
      return;
    }
    
    // Check for uppercase letter
    if (!/[A-Z]/.test(formData.password)) {
      setError('Password must contain at least one uppercase letter');
      setIsSubmitting(false);
      return;
    }
    
    // Check for lowercase letter
    if (!/[a-z]/.test(formData.password)) {
      setError('Password must contain at least one lowercase letter');
      setIsSubmitting(false);
      return;
    }
    
    // Check for number
    if (!/[0-9]/.test(formData.password)) {
      setError('Password must contain at least one number');
      setIsSubmitting(false);
      return;
    }
    
    // Check for special character
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(formData.password)) {
      setError('Password must contain at least one special character (!@#$%^&*(),.?":{}|<>)');
      setIsSubmitting(false);
      return;
    }

    try {
      // Validate reCAPTCHA
      if (!recaptchaToken) {
        setError('Please complete the security verification (reCAPTCHA).');
        setIsSubmitting(false);
        return;
      }

      const registrationData = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        contactPerson: formData.contactPerson,
        address: formData.address,
        phone: formData.phone,
        recaptchaToken: recaptchaToken
      };

      const response = await fetch('/api/studios/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registrationData),
      });

      const result = await response.json();

      if (result.success) {
        setRegistrationNumber(result.registrationNumber);
        setSubmitted(true);
      } else {
        // Handle specific error types
        if (result.rateLimited) {
          const resetTime = new Date(result.resetTime).toLocaleTimeString();
          setError(`⏰ Rate limit exceeded! You can only register 3 accounts per hour. Please try again after ${resetTime}.`);
        } else if (result.recaptchaFailed) {
          setError(`🔒 Security verification failed. Please refresh the page and try again.`);
        } else {
          setError(result.error || 'Registration failed');
        }
      }
    } catch (error) {
      console.error('Registration error:', error);
      setError('Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800">
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="w-full max-w-2xl">
            <div className="bg-gray-800/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-700/20 p-8 text-center">
              <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              
              <h1 className="text-3xl font-bold text-white mb-4">
                🎉 Studio Registration Successful!
              </h1>
              
              {/* Avalon Blessing */}
              <div className="bg-gradient-to-r from-purple-900/40 to-pink-900/40 border border-purple-500/30 rounded-lg p-4 mb-6">
                <p className="text-purple-300 text-center italic font-medium">
                  ✨ "May the Mists of Avalon bring luck upon you" ✨
                </p>
              </div>
              
              <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-6 mb-6">
                <h3 className="text-lg font-semibold text-green-300 mb-3">Welcome to EODSA!</h3>
                <div className="text-left space-y-2">
                  <p className="text-green-200"><span className="font-medium">Studio:</span> {formData.name}</p>
                  <p className="text-green-200"><span className="font-medium">Registration Number:</span> {registrationNumber}</p>
                  <p className="text-green-200"><span className="font-medium">Contact Email:</span> {formData.email}</p>
                </div>
              </div>

              <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4 mb-8">
                <p className="text-blue-200 text-sm">
                  🔐 <strong>Important:</strong> Please save your registration number and login credentials. 
                  You can now access your studio dashboard to manage dancers and register for competitions.
                </p>
              </div>

              <div className="space-y-4">
                <Link 
                  href="/studio-login"
                  className="block w-full px-6 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl hover:from-purple-600 hover:to-pink-600 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  🏢 Access Studio Dashboard
                </Link>
                
                <Link 
                  href="/" 
                  className="block w-full px-6 py-4 border-2 border-gray-600 text-gray-300 rounded-2xl hover:bg-gray-700 hover:border-gray-500 transition-all duration-300 font-semibold"
                >
                  🏠 Back to Home
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 pb-safe-bottom">
      {/* Add mobile-specific bottom padding to prevent iPhone search bar from covering buttons */}
      <style jsx global>{`
        @supports(padding: max(0px)) {
          .pb-safe-bottom {
            padding-bottom: max(env(safe-area-inset-bottom, 0px), 100px);
          }
        }
        
        /* Fallback for older browsers */
        @media screen and (max-width: 640px) {
          .pb-safe-bottom {
            padding-bottom: 120px;
          }
        }
        
        /* iPhone specific adjustments */
        @media screen and (max-width: 414px) and (min-height: 800px) {
          .pb-safe-bottom {
            padding-bottom: 140px;
          }
        }
      `}</style>
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
              Register Studio
            </h1>
            <p className="text-gray-200">
              Avalon
            </p>
            <p className="text-sm text-gray-300 mt-2">
              Join EODSA and start managing your dancers
            </p>
          </div>

          {/* Registration Form */}
          <div className="bg-gray-800/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-700/20 p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Studio Information */}
              <div className="bg-purple-900/20 rounded-2xl p-6 border border-purple-500/30">
                <h3 className="text-lg font-semibold text-white mb-6 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  Studio Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-200 mb-2">
                      Studio Name *
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-600 bg-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all text-white placeholder-gray-400"
                      placeholder="e.g., Elite Dance Academy"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="contactPerson" className="block text-sm font-medium text-gray-200 mb-2">
                      Contact Person *
                    </label>
                    <input
                      type="text"
                      id="contactPerson"
                      name="contactPerson"
                      value={formData.contactPerson}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-600 bg-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all text-white placeholder-gray-400"
                      placeholder="e.g., Jane Smith"
                      required
                    />
                  </div>
                </div>
                
                <div className="mt-6">
                  <label htmlFor="address" className="block text-sm font-medium text-gray-200 mb-2">
                    Studio Address *
                  </label>
                  <input
                    type="text"
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-600 bg-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all text-white placeholder-gray-400"
                    placeholder="e.g., 123 Dance Street, Johannesburg, 2000"
                    required
                  />
                </div>

                <div className="mt-6">
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-200 mb-2">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-600 bg-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all text-white placeholder-gray-400"
                    placeholder="011 123 4567"
                    maxLength={15}
                    required
                  />
                </div>
              </div>

              {/* Account Information */}
              <div className="bg-blue-900/20 rounded-2xl p-6 border border-blue-500/30">
                <h3 className="text-lg font-semibold text-white mb-6 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Account Setup
                </h3>
                <div className="space-y-6">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-200 mb-2">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-600 bg-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-white placeholder-gray-400"
                      placeholder="studio@example.com"
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="password" className="block text-sm font-medium text-gray-200 mb-2">
                        Password *
                      </label>
                      <input
                        type="password"
                        id="password"
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-600 bg-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-white placeholder-gray-400"
                        placeholder="Enter password"
                        required
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-200 mb-2">
                        Confirm Password *
                      </label>
                      <input
                        type="password"
                        id="confirmPassword"
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-600 bg-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-white placeholder-gray-400"
                        placeholder="Confirm password"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4">
                  <p className="text-red-300 text-sm">{error}</p>
                </div>
              )}

              {/* reCAPTCHA */}
              <div className="bg-gray-700/50 rounded-2xl p-6 border border-gray-600">
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center justify-center">
                    <svg className="w-5 h-5 mr-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    Security Verification
                  </h3>
                  <p className="text-gray-400 text-sm mb-4">Please verify you're human to complete registration</p>
                  <RecaptchaV2
                    onVerify={(token) => setRecaptchaToken(token)}
                    onExpire={() => setRecaptchaToken('')}
                    onError={() => setRecaptchaToken('')}
                    theme="dark"
                    size="normal"
                  />
                  {!recaptchaToken && (
                    <p className="text-red-400 text-xs mt-2">
                      Please complete the security verification above.
                    </p>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !recaptchaToken}
                className="w-full px-6 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl hover:from-purple-600 hover:to-pink-600 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isSubmitting ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Registering Studio...
                  </div>
                ) : (
                  'Register Studio'
                )}
              </button>
            </form>

            {/* Additional Options */}
            <div className="mt-8 pt-6 border-t border-gray-600">
              <div className="text-center space-y-3">
                <Link 
                  href="/studio-login"
                  className="block text-purple-400 hover:text-purple-300 transition-colors font-medium"
                >
                  Already have a studio account? Sign In
                </Link>
                <Link 
                  href="/"
                  className="block text-gray-400 hover:text-gray-300 transition-colors"
                >
                  Back to Home
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 