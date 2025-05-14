// services/otpStore.js
const otpStore = new Map(); // { email: { otp, expiresAt } }

module.exports = {
  generateOTP: (email) => {
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
    
    otpStore.set(email, { 
      otp, 
      expiresAt 
    });
    
    return otp;
  },

  verifyOTP: (email, userOTP) => {
    const record = otpStore.get(email);
    if (!record) return false;
    
    // Cleanup expired OTPs
    if (Date.now() > record.expiresAt) {
      otpStore.delete(email);
      return false;
    }
    
    return record.otp === userOTP;
  },

  cleanup: () => {
    // Optional: Periodic cleanup of expired OTPs
    const now = Date.now();
    for (const [email, record] of otpStore) {
      if (now > record.expiresAt) {
        otpStore.delete(email);
      }
    }
  }
};