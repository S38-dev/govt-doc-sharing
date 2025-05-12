const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service:'gmail', // e.g., 'smtp.gmail.com'
 
  
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

exports.sendShareNotification = async (senderName, recipientEmail, documentTitle, permissions) => {
  try {
    const mailOptions = {
      from: `"Document Sharing" <${process.env.EMAIL_USER}>`,
      to: recipientEmail,
      subject: `New Document Shared: ${documentTitle}`,
      html: `
        <h2>Document Shared with You</h2>
        <p><strong>${senderName}</strong> has shared a document with you:</p>
        <ul>
          <li><strong>Document Title:</strong> ${documentTitle}</li>
          <li><strong>Permissions:</strong> ${permissions}</li>
        </ul>
        <p>Access your shared documents: <a href="${process.env.APP_URL}/documents">View Documents</a></p>
      `
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Email send error:', error);
    throw new Error('Failed to send notification email');
  }
};