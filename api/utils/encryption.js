import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Get encryption key from environment variable
 * @returns {Buffer|null} The encryption key or null if not configured
 */
function getEncryptionKey() {
  if (!process.env.ENCRYPTION_KEY) {
    console.warn('ENCRYPTION_KEY not set - encryption disabled');
    return null;
  }
  
  try {
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
    
    if (key.length !== 32) {
      console.error('ENCRYPTION_KEY must be 64 hex characters (32 bytes) - encryption disabled');
      return null;
    }
    
    return key;
  } catch (error) {
    console.error('Invalid ENCRYPTION_KEY format - encryption disabled:', error);
    return null;
  }
}

/**
 * Encrypt sensitive data
 * @param {string} text - Plain text to encrypt
 * @returns {string|null} Encrypted text in format: iv:authTag:encrypted
 */
function encryptData(text) {
  if (!text) return null;
  
  const key = getEncryptionKey();
  if (!key) {
    // Encryption not configured - return null (data won't be encrypted)
    console.warn('Encryption skipped - ENCRYPTION_KEY not configured');
    return null;
  }
  
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption error:', error);
    // Return null instead of throwing - allow operation to continue
    return null;
  }
}

/**
 * Decrypt encrypted data
 * @param {string} encryptedText - Encrypted text in format: iv:authTag:encrypted
 * @returns {string|null} Decrypted plain text
 */
function decryptData(encryptedText) {
  if (!encryptedText) return null;
  
  const key = getEncryptionKey();
  if (!key) {
    console.warn('Decryption skipped - ENCRYPTION_KEY not configured');
    return null;
  }
  
  try {
    const parts = encryptedText.split(':');
    
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
}

/**
 * Hash sensitive data (one-way)
 * @param {string} data - Data to hash
 * @returns {string} SHA-256 hash
 */
function hashSensitiveData(data) {
  if (!data) return null;
  
  return crypto
    .createHash('sha256')
    .update(data)
    .digest('hex');
}

/**
 * Generate a secure random encryption key
 * @returns {string} 64-character hex string suitable for ENCRYPTION_KEY
 */
function generateEncryptionKey() {
  return crypto.randomBytes(32).toString('hex');
}

export {
  encryptData,
  decryptData,
  hashSensitiveData,
  generateEncryptionKey
};