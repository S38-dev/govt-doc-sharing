const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config();
const fs = require('fs');
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

/**
 * Send a notification email when a document is shared.
 * @param {string} senderName - Name of the user sharing the document.
 * @param {string} recipientEmail - Email address to send notification to.
 * @param {string} documentTitle - Title of the document.
 * @param {string|string[]} permissions - Permissions granted.
 * @param {string} documentPath - Absolute file path to attach.
 */


// Verify connection on startup
transporter.verify((error) => {
  if (error) {
    console.error('Mail server connection error:', error);
  } else {
    console.log('📧 Mail server ready to send emails');
  }
});


exports.sendShareNotification = async (senderName, recipientEmail, documentTitle, permissions, documentPath) => {
  try {
    // Validate file exists before attaching
    await fs.promises.access(documentPath, fs.constants.R_OK);

    const mailOptions = {
      from: `"Document Sharing" <${process.env.EMAIL_USER}>`,
      to: recipientEmail,
      subject: `New Document Shared: ${documentTitle}`,
      html: `
        <h2>Document Shared with You</h2>
        <p><strong>${senderName}</strong> has shared a document with you:</p>
        <ul>
          <li><strong>Document Title:</strong> ${documentTitle}</li>
          <li><strong>Permissions:</strong> ${Array.isArray(permissions) ? permissions.join(', ') : permissions}</li>
        </ul>
        <p>The document is attached to this email.</p>
      `,
      attachments: [{
        filename: `${documentTitle}${path.extname(documentPath)}`,
        path: documentPath
      }]
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('📨 Email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('📧 Email send error:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};
exports.sendOTPEmail = async (email, otp) => {
  try {
    const mailOptions = {
      from: `"SecureDoc" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Password Change OTP',
      html: `
        <h3>Password Change Request</h3>
        <p>Your OTP for password change is: <strong>${otp}</strong></p>
        <p>This OTP is valid for 5 minutes.</p>
      `
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
};