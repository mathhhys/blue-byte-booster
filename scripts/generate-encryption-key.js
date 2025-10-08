#!/usr/bin/env node

/**
 * Generate a secure encryption key for token metadata encryption
 * This is OPTIONAL - the system works without it, but metadata won't be encrypted
 */

const crypto = require('crypto');

console.log('\n🔐 Encryption Key Generator\n');
console.log('━'.repeat(60));

const key = crypto.randomBytes(32).toString('hex');

console.log('\n✅ Generated 256-bit AES encryption key:\n');
console.log(`ENCRYPTION_KEY=${key}`);
console.log('\n📋 Instructions:');
console.log('1. Copy the line above');
console.log('2. Add it to your .env file');
console.log('3. Add it to your Vercel environment variables');
console.log('4. Redeploy your application');
console.log('\n⚠️  Note: Encryption is optional. Without it:');
console.log('   - Token generation still works');
console.log('   - IP addresses and user agents won\'t be encrypted');
console.log('   - Tokens themselves are still bcrypt hashed\n');
console.log('━'.repeat(60) + '\n');