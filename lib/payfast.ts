// PayFast Payment Gateway Integration
// Handles PayFast payment processing, signature generation, and verification

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

// PayFast configuration from environment
export const PAYFAST_CONFIG = {
  merchantId: process.env.PAYFAST_MERCHANT_ID!,
  merchantKey: process.env.PAYFAST_MERCHANT_KEY!,
  passphrase: process.env.PAYFAST_PASSPHRASE!,
  sandbox: process.env.PAYFAST_SANDBOX === 'true',
  url: process.env.PAYFAST_SANDBOX === 'true' 
    ? 'https://sandbox.payfast.co.za/eng/process'
    : 'https://www.payfast.co.za/eng/process',
  returnUrl: process.env.PAYFAST_RETURN_URL!,
  cancelUrl: process.env.PAYFAST_CANCEL_URL!,
  notifyUrl: process.env.PAYFAST_NOTIFY_URL!,
};

export interface PaymentData {
  merchant_id: string;
  merchant_key: string;
  return_url: string;
  cancel_url: string;
  notify_url: string;
  name_first: string;
  name_last: string;
  email_address: string;
  m_payment_id: string;
  amount: string;
  item_name: string;
  item_description?: string;
  custom_str1?: string; // Entry ID
  custom_str2?: string; // Event ID
  custom_str3?: string; // User ID
  custom_int1?: string; // Additional data
}

export interface PayFastWebhookData {
  m_payment_id: string;
  pf_payment_id: string;
  payment_status: 'COMPLETE' | 'FAILED' | 'CANCELLED';
  item_name: string;
  item_description?: string;
  amount_gross: string;
  amount_fee: string;
  amount_net: string;
  custom_str1?: string;
  custom_str2?: string;
  custom_str3?: string;
  custom_int1?: string;
  name_first: string;
  name_last: string;
  email_address: string;
  merchant_id: string;
  signature: string;
}

/**
 * Generates PayFast signature for payment data
 */
export function generatePayFastSignature(data: Record<string, string | undefined>): string {
  // Create parameter string in the order parameters appear (DO NOT SORT)
  let pfOutput = "";
  for (let key in data) {
    if (data.hasOwnProperty(key)) {
      if (data[key] !== undefined && data[key] !== "" && key !== 'signature') {
        pfOutput += `${key}=${encodeURIComponent((data[key] as string).trim()).replace(/%20/g, "+")}&`;
      }
    }
  }

  // Remove last ampersand
  let getString = pfOutput.slice(0, -1);
  
  // Add passphrase if it exists
  if (PAYFAST_CONFIG.passphrase) {
    getString += `&passphrase=${encodeURIComponent(PAYFAST_CONFIG.passphrase.trim()).replace(/%20/g, "+")}`;
  }

  // Generate MD5 hash
  return crypto.createHash('md5').update(getString).digest('hex');
}

/**
 * Verifies PayFast webhook signature
 */
export function verifyPayFastSignature(data: PayFastWebhookData): boolean {
  const expectedSignature = generatePayFastSignature(data as any);
  return expectedSignature === data.signature;
}

/**
 * Creates payment data for PayFast
 */
export function createPaymentData({
  entryId,
  eventId,
  userId,
  amount,
  userFirstName,
  userLastName,
  userEmail,
  itemName,
  itemDescription,
}: {
  entryId: string;
  eventId: string;
  userId: string;
  amount: number;
  userFirstName: string;
  userLastName: string;
  userEmail: string;
  itemName: string;
  itemDescription?: string;
}): PaymentData & { signature: string } {
  
  const paymentId = `ENTRY_${entryId}_${uuidv4().substring(0, 8)}`;
  
  const paymentData: PaymentData = {
    merchant_id: PAYFAST_CONFIG.merchantId,
    merchant_key: PAYFAST_CONFIG.merchantKey,
    return_url: `${PAYFAST_CONFIG.returnUrl}?m_payment_id=${paymentId}`,
    cancel_url: `${PAYFAST_CONFIG.cancelUrl}?m_payment_id=${paymentId}`,
    notify_url: PAYFAST_CONFIG.notifyUrl,
    name_first: userFirstName,
    name_last: userLastName,
    email_address: userEmail,
    m_payment_id: paymentId,
    amount: amount.toFixed(2),
    item_name: itemName,
    item_description: itemDescription || `Competition entry for ${itemName}`,
    custom_str1: entryId,
    custom_str2: eventId,
    custom_str3: userId,
  };

  const signature = generatePayFastSignature(paymentData as any);

  return {
    ...paymentData,
    signature,
  };
}

/**
 * Validates PayFast webhook host (security check)
 * Updated with current PayFast production IP ranges (2024)
 */
export async function validatePayFastHost(ip: string): Promise<boolean> {
  if (PAYFAST_CONFIG.sandbox) {
    // In sandbox, we're more lenient with IP validation
    return true;
  }

  // PayFast production IP addresses (updated 2024)
  const validHosts = [
    // Original PayFast IPs
    '197.97.145.144',
    '197.97.145.145', 
    '197.97.145.146',
    '197.97.145.147',
    '197.97.145.148',
    // Additional PayFast production IPs
    '41.74.179.194',
    '41.74.179.195',
    '41.74.179.196',
    '41.74.179.197',
    '41.74.179.198',
    '41.74.179.199',
  ];

  // Log IP validation attempts for security monitoring
  console.log(`🔒 PayFast IP validation: ${ip} - ${validHosts.includes(ip) ? 'VALID' : 'INVALID'}`);

  return validHosts.includes(ip);
}

/**
 * Formats amount for PayFast (2 decimal places)
 */
export function formatAmount(amount: number): string {
  return parseFloat(amount.toString()).toFixed(2);
}

/**
 * Generates payment reference
 */
export function generatePaymentReference(entryId: string, eventId: string): string {
  const timestamp = Date.now().toString(36);
  return `ENTRY_${entryId}_EVENT_${eventId}_${timestamp}`.toUpperCase();
}

/**
 * PayFast payment status enum
 */
export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETE = 'complete',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

/**
 * Calculates entry fees based on event configuration
 */
export function calculateEntryFees(baseAmount: number): {
  subtotal: number;
  processingFee: number;
  total: number;
} {
  const subtotal = baseAmount;
  const processingFee = Math.max(subtotal * 0.035, 2.00); // 3.5% or R2 minimum
  const total = subtotal + processingFee;

  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    processingFee: parseFloat(processingFee.toFixed(2)),
    total: parseFloat(total.toFixed(2)),
  };
}

/**
 * Creates PayFast form HTML for redirect
 */
export function createPayFastForm(paymentData: PaymentData & { signature: string }): string {
  const formFields = Object.entries(paymentData)
    .map(([key, value]) => `<input type="hidden" name="${key}" value="${value}" />`)
    .join('\n    ');

  const totalAmount = parseFloat(paymentData.amount);
  const baseAmount = totalAmount / 1.035; // Reverse calculate base amount
  const processingFee = totalAmount - baseAmount;

  return `
<!DOCTYPE html>
<html>
<head>
    <title>Redirecting to PayFast...</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            text-align: center; 
            padding: 50px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .loading {
            margin: 20px auto;
            width: 50px;
            height: 50px;
            border: 3px solid rgba(255,255,255,0.3);
            border-top: 3px solid white;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .breakdown {
            background: rgba(255,255,255,0.1);
            border-radius: 10px;
            padding: 20px;
            margin: 20px auto;
            max-width: 400px;
            backdrop-filter: blur(10px);
        }
        .fee-line {
            display: flex;
            justify-content: space-between;
            margin: 8px 0;
        }
        .total-line {
            border-top: 1px solid rgba(255,255,255,0.3);
            padding-top: 10px;
            margin-top: 10px;
            font-weight: bold;
            font-size: 18px;
        }
    </style>
</head>
<body>
    <h2>🏆 Processing Payment</h2>
    <p>Redirecting you to PayFast to complete your competition entry payment...</p>
    
    <div class="breakdown">
        <h3>Payment Breakdown</h3>
        <div class="fee-line">
            <span>Competition Entry:</span>
            <span>R${baseAmount.toFixed(2)}</span>
        </div>
        <div class="fee-line">
            <span>Processing Fee (3.5%):</span>
            <span>R${processingFee.toFixed(2)}</span>
        </div>
        <div class="fee-line total-line">
            <span>Total Amount:</span>
            <span>R${totalAmount.toFixed(2)}</span>
        </div>
    </div>
    
    <div class="loading"></div>
    <p><small>If you are not redirected automatically, <a href="#" onclick="document.getElementById('payfast_form').submit();" style="color: #FFE066;">click here</a>.</small></p>
    
    <form id="payfast_form" action="${PAYFAST_CONFIG.url}" method="post">
        ${formFields}
    </form>
    
    <script>
        // Auto-submit form after 3 seconds (longer to read breakdown)
        setTimeout(() => {
            document.getElementById('payfast_form').submit();
        }, 3000);
    </script>
</body>
</html>`;
}

export default {
  generatePayFastSignature,
  verifyPayFastSignature,
  createPaymentData,
  validatePayFastHost,
  formatAmount,
  generatePaymentReference,
  calculateEntryFees,
  createPayFastForm,
  PaymentStatus,
  PAYFAST_CONFIG,
};
