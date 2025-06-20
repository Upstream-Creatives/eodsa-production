import { NextRequest, NextResponse } from "next/server";
import { studioDb, initializeDatabase } from "@/lib/database";
import bcrypt from 'bcryptjs';
import { verifyRecaptcha, checkRateLimit, getClientIP } from '@/lib/recaptcha';

export async function POST(request: NextRequest) {
  try {
    await initializeDatabase();
    
    const { name, email, password, contactPerson, address, phone, recaptchaToken } = await request.json();
    
    // Rate limiting removed for bulk registrations
    
    // Get client IP for reCAPTCHA verification
    const clientIP = getClientIP(request);
    
    // Verify reCAPTCHA token
    if (!recaptchaToken) {
      return NextResponse.json(
        { error: 'reCAPTCHA verification is required' },
        { status: 400 }
      );
    }
    
    const recaptchaResult = await verifyRecaptcha(recaptchaToken, clientIP);
    if (!recaptchaResult.success) {
      return NextResponse.json(
        { 
          error: `Security verification failed: ${recaptchaResult.error}`,
          recaptchaFailed: true 
        },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!name || !email || !password || !contactPerson) {
      return NextResponse.json(
        { error: "Name, email, password, and contact person are required" },
        { status: 400 }
      );
    }

    // Check if studio already exists
    const existingStudio = await studioDb.getStudioByEmail(email);
    if (existingStudio) {
      return NextResponse.json(
        { error: "A studio with this email already exists" },
        { status: 400 }
      );
    }

    // Store password in plaintext per client requirement for password recovery
    // Create studio - now auto-approved
    const studio = await studioDb.createStudio({
      name,
      email,
      password: password,
      contactPerson,
      address: address || '',
      phone: phone || ''
    });

    return NextResponse.json({
      success: true,
      message: "Studio registered successfully. Your account is now active!",
      studio: {
        id: studio.id,
        name: name,
        email: email,
        registrationNumber: studio.registrationNumber,
        approved: true, // Show as immediately approved
        contactPerson: contactPerson,
        address: address || '',
        phone: phone || ''
      }
    });

  } catch (error) {
    console.error("Studio registration error:", error);
    return NextResponse.json(
      { error: "Failed to register studio" },
      { status: 500 }
    );
  }
} 