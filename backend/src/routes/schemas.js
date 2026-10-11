import { z } from 'zod';

export const uuid = z.string().uuid('Invalid identifier');

export const nameSchema = z.string().trim()
  .min(2, 'Enter your full name')
  .max(80, 'Name is too long')
  .regex(/^[\p{L}\p{M} .'-]+$/u, 'Name can only contain letters, spaces, dots, apostrophes and hyphens');

export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[A-Za-z]/, 'Password needs at least one letter')
  .regex(/\d/, 'Password needs at least one number');

export const optionalText = (max) => z.string().trim().max(max).optional().nullable()
  .transform((v) => (v === undefined ? undefined : v || null));

export const otpCodeSchema = z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code');

export const SEVERITY_LABELS = { 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Critical' };
export const POST_CATEGORIES = ['safety', 'hostel', 'academics', 'infrastructure', 'health', 'harassment', 'transport', 'food', 'other'];
export const REACTIONS = ['like', 'love', 'support', 'wow', 'sad', 'angry'];
export const REPORT_REASONS = ['spam', 'abusive', 'harassment', 'false_info', 'inappropriate', 'other'];
