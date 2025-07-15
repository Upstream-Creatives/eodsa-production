'use client';

import { useState, useRef } from 'react';

interface WaiverModalProps {
  isOpen: boolean;
  onClose: () => void;
  dancerId: string;
  dancerName: string;
  onWaiverSubmitted: () => void;
}

export default function WaiverModal({ isOpen, onClose, dancerId, dancerName, onWaiverSubmitted }: WaiverModalProps) {
  const [formData, setFormData] = useState({
    parentName: '',
    parentEmail: '',
    parentPhone: '',
    relationshipToDancer: 'Parent'
  });
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [idDocumentFile, setIdDocumentFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1); // 1: Info, 2: Files, 3: Review

  const signatureInputRef = useRef<HTMLInputElement>(null);
  const idInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Validate parent name to allow only letters, spaces, hyphens, and apostrophes
    if (name === 'parentName') {
      const cleanValue = value.replace(/[^a-zA-Z\s\-\']/g, '');
      setFormData({
        ...formData,
        [name]: cleanValue
      });
      return;
    }
    
    // Validate parent email format in real-time
    if (name === 'parentEmail') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (value && !emailRegex.test(value)) {
        setError('Please enter a valid email address');
      } else {
        setError('');
      }
    }
    
    // Validate phone number to allow only digits, spaces, hyphens, parentheses, and plus with auto-formatting
    if (name === 'parentPhone') {
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
      
      setFormData({
        ...formData,
        [name]: formattedValue
      });
      return;
    }
    
    // Keep whitespace for text inputs to allow spaces during typing
    const processedValue = value;
    
    setFormData({
      ...formData,
      [name]: processedValue
    });
  };

  const handleSignatureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        setError('Signature must be an image file (JPG, PNG, GIF)');
        return;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setError('Signature file must be less than 5MB');
        return;
      }
      setSignatureFile(file);
      setError('');
    }
  };

  const handleIdDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        setError('ID document must be an image file (JPG, PNG, GIF) or PDF');
        return;
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        setError('ID document file must be less than 10MB');
        return;
      }
      setIdDocumentFile(file);
      setError('');
    }
  };

  const handleSubmit = async () => {
    if (!formData.parentName || !formData.parentEmail || !formData.parentPhone || !signatureFile || !idDocumentFile) {
      setError('All fields are required');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const submitFormData = new FormData();
      submitFormData.append('dancerId', dancerId);
      submitFormData.append('parentName', formData.parentName);
      submitFormData.append('parentEmail', formData.parentEmail);
      submitFormData.append('parentPhone', formData.parentPhone);
      submitFormData.append('relationshipToDancer', formData.relationshipToDancer);
      submitFormData.append('signature', signatureFile);
      submitFormData.append('idDocument', idDocumentFile);

      const response = await fetch('/api/studios/waivers', {
        method: 'POST',
        body: submitFormData
      });

      const data = await response.json();

      if (data.success) {
        onWaiverSubmitted();
        handleClose();
      } else {
        setError(data.error || 'Failed to submit waiver');
      }
    } catch (error) {
      console.error('Submit waiver error:', error);
      setError('Failed to submit waiver');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({
      parentName: '',
      parentEmail: '',
      parentPhone: '',
      relationshipToDancer: 'Parent'
    });
    setSignatureFile(null);
    setIdDocumentFile(null);
    setStep(1);
    setError('');
    onClose();
  };

  const nextStep = () => {
    if (step === 1 && (!formData.parentName || !formData.parentEmail || !formData.parentPhone)) {
      setError('Please fill in all parent/guardian information');
      return;
    }
    if (step === 2 && (!signatureFile || !idDocumentFile)) {
      setError('Please upload both signature and ID document');
      return;
    }
    setError('');
    setStep(step + 1);
  };

  const prevStep = () => {
    setError('');
    setStep(step - 1);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white">
            Parent/Guardian Waiver Required
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="mb-6">
          <div className="bg-yellow-900 border border-yellow-600 text-yellow-100 p-4 rounded-lg mb-4">
            <div className="flex items-center">
              <span className="text-yellow-400 mr-2">⚠️</span>
              <div>
                <p className="font-semibold">Minor Dancer Detected</p>
                <p className="text-sm">
                  {dancerName} is under 18 and requires a parent/guardian waiver before participating in competitions.
                </p>
              </div>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center justify-center mb-6">
            <div className={`flex items-center ${step >= 1 ? 'text-green-400' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step >= 1 ? 'border-green-400 bg-green-400 text-black' : 'border-gray-400'}`}>
                1
              </div>
              <span className="ml-2 text-sm">Parent Info</span>
            </div>
            <div className="mx-4 h-px w-8 bg-gray-600"></div>
            <div className={`flex items-center ${step >= 2 ? 'text-green-400' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step >= 2 ? 'border-green-400 bg-green-400 text-black' : 'border-gray-400'}`}>
                2
              </div>
              <span className="ml-2 text-sm">Documents</span>
            </div>
            <div className="mx-4 h-px w-8 bg-gray-600"></div>
            <div className={`flex items-center ${step >= 3 ? 'text-green-400' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step >= 3 ? 'border-green-400 bg-green-400 text-black' : 'border-gray-400'}`}>
                3
              </div>
              <span className="ml-2 text-sm">Review</span>
            </div>
          </div>
        </div>

        {/* Step 1: Parent/Guardian Information */}
        {step === 1 && (
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-white mb-4">Parent/Guardian Information</h4>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                name="parentName"
                value={formData.parentName}
                onChange={handleInputChange}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Enter parent/guardian full name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Email Address *
              </label>
              <input
                type="email"
                name="parentEmail"
                value={formData.parentEmail}
                onChange={handleInputChange}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Enter email address"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Phone Number *
              </label>
              <input
                type="tel"
                name="parentPhone"
                value={formData.parentPhone}
                onChange={handleInputChange}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Enter phone number"
                maxLength={15}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Relationship to Dancer *
              </label>
              <select
                name="relationshipToDancer"
                value={formData.relationshipToDancer}
                onChange={handleInputChange}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="Parent">Parent</option>
                <option value="Guardian">Legal Guardian</option>
                <option value="Grandparent">Grandparent</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
        )}

        {/* Step 2: Document Upload */}
        {step === 2 && (
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-white mb-4">Required Documents</h4>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Digital Signature *
              </label>
              <p className="text-xs text-gray-400 mb-2">
                Upload a clear image of your signature (JPG, PNG, GIF - Max 5MB)
              </p>
              <input
                ref={signatureInputRef}
                type="file"
                accept="image/*"
                onChange={handleSignatureChange}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700"
              />
              {signatureFile && (
                <p className="text-green-400 text-sm mt-1">✓ {signatureFile.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                ID Document *
              </label>
              <p className="text-xs text-gray-400 mb-2">
                Upload a clear photo of your ID/Passport/Driver's License (JPG, PNG, PDF - Max 10MB)
              </p>
              <input
                ref={idInputRef}
                type="file"
                accept="image/*,.pdf"
                onChange={handleIdDocumentChange}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700"
              />
              {idDocumentFile && (
                <p className="text-green-400 text-sm mt-1">✓ {idDocumentFile.name}</p>
              )}
            </div>

            <div className="bg-blue-900 border border-blue-600 text-blue-100 p-4 rounded-lg">
              <div className="flex items-start">
                <span className="text-blue-400 mr-2 mt-0.5">ℹ️</span>
                <div>
                  <p className="font-semibold text-sm">Document Requirements:</p>
                  <ul className="text-xs mt-1 space-y-1">
                    <li>• Signature must be clear and legible</li>
                    <li>• ID document must show full name and photo</li>
                    <li>• All documents will be reviewed for approval</li>
                    <li>• Approved waivers are required before competition entry</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Review and Submit */}
        {step === 3 && (
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-white mb-4">Review and Submit</h4>
            
            <div className="bg-gray-700 rounded-lg p-4 space-y-3">
              <div>
                <span className="text-gray-400 text-sm">Dancer:</span>
                <p className="text-white font-medium">{dancerName}</p>
              </div>
              <div>
                <span className="text-gray-400 text-sm">Parent/Guardian:</span>
                <p className="text-white font-medium">{formData.parentName}</p>
              </div>
              <div>
                <span className="text-gray-400 text-sm">Relationship:</span>
                <p className="text-white">{formData.relationshipToDancer}</p>
              </div>
              <div>
                <span className="text-gray-400 text-sm">Email:</span>
                <p className="text-white">{formData.parentEmail}</p>
              </div>
              <div>
                <span className="text-gray-400 text-sm">Phone:</span>
                <p className="text-white">{formData.parentPhone}</p>
              </div>
              <div>
                <span className="text-gray-400 text-sm">Signature:</span>
                <p className="text-green-400">✓ {signatureFile?.name}</p>
              </div>
              <div>
                <span className="text-gray-400 text-sm">ID Document:</span>
                <p className="text-green-400">✓ {idDocumentFile?.name}</p>
              </div>
            </div>

            <div className="bg-yellow-900 border border-yellow-600 text-yellow-100 p-4 rounded-lg">
              <p className="text-sm">
                <strong>Legal Agreement:</strong> By submitting this waiver, I acknowledge that I am the parent/guardian of {dancerName} and give permission for their participation in dance competitions. I understand that all submitted documents will be reviewed and must be approved before competition entry.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 bg-red-900 border border-red-600 text-red-100 p-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-6">
          <div>
            {step > 1 && (
              <button
                onClick={prevStep}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Previous
              </button>
            )}
          </div>
          
          <div className="space-x-2">
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            
            {step < 3 ? (
              <button
                onClick={nextStep}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Waiver'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 