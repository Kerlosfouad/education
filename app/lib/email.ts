import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const fromEmail = process.env.FROM_EMAIL || 'noreply@dr-emad-edu.com';
    const fromName = process.env.FROM_NAME || 'Dr. Emad Bayuome Educational System';

    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      attachments: options.attachments,
    });

    console.log(`Email sent successfully to ${options.to}`);
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}

// Email templates
export const emailTemplates = {
  studentApproval: (data: {
    name: string;
    studentCode: string;
    qrCodeDataUrl: string;
    loginUrl: string;
  }) => ({
    subject: 'Welcome! Your Registration has been Approved',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Registration Approved</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .qr-code { text-align: center; margin: 20px 0; }
          .qr-code img { max-width: 200px; border: 2px solid #ddd; border-radius: 10px; }
          .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Dr. Emad Bayuome Educational System!</h1>
          </div>
          <div class="content">
            <h2>Dear ${data.name},</h2>
            <p>We are pleased to inform you that your registration has been <strong>approved</strong>!</p>
            
            <div class="info-box">
              <h3>Your Student Information:</h3>
              <p><strong>Student Code:</strong> ${data.studentCode}</p>
              <p><strong>Login URL:</strong> <a href="${data.loginUrl}">${data.loginUrl}</a></p>
            </div>
            
            <div class="qr-code">
              <h3>Your Personal QR Code</h3>
              <p>Save this QR code for quick access:</p>
              <img src="${data.qrCodeDataUrl}" alt="Your QR Code" />
            </div>
            
            <div style="text-align: center;">
              <a href="${data.loginUrl}" class="button">Login to Your Account</a>
            </div>
            
            <p><strong>What's Next?</strong></p>
            <ul>
              <li>Login to your account using your email and password</li>
              <li>Access your courses and materials</li>
              <li>Check attendance, assignments, and quizzes</li>
              <li>Join live lectures and download study materials</li>
            </ul>
            
            <p>If you have any questions, please don't hesitate to contact us.</p>
            
            <p>Best regards,<br>
            <strong>Dr. Emad Bayuome Educational System Team</strong></p>
          </div>
          <div class="footer">
            <p>This is an automated email. Please do not reply to this message.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  passwordReset: (data: {
    name: string;
    resetUrl: string;
    expiresIn: string;
  }) => ({
    subject: 'Password Reset Request',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #667eea; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .warning { background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Hello ${data.name},</h2>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            
            <div style="text-align: center;">
              <a href="${data.resetUrl}" class="button">Reset Password</a>
            </div>
            
            <div class="warning">
              <p><strong>Important:</strong> This link will expire in ${data.expiresIn}.</p>
              <p>If you didn't request this password reset, please ignore this email or contact support if you're concerned.</p>
            </div>
            
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #667eea;">${data.resetUrl}</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  notification: (data: {
    name: string;
    title: string;
    message: string;
    actionUrl?: string;
    actionText?: string;
  }) => ({
    subject: data.title,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${data.title}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #667eea; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${data.title}</h1>
          </div>
          <div class="content">
            <h2>Hello ${data.name},</h2>
            <p>${data.message}</p>
            ${data.actionUrl ? `
            <div style="text-align: center;">
              <a href="${data.actionUrl}" class="button">${data.actionText || 'View Details'}</a>
            </div>
            ` : ''}
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  bulkAnnouncement: (data: {
    title: string;
    content: string;
    senderName: string;
  }) => ({
    subject: `Announcement: ${data.title}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Announcement</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .announcement-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Important Announcement</h1>
          </div>
          <div class="content">
            <div class="announcement-box">
              <h2>${data.title}</h2>
              <p>${data.content}</p>
            </div>
            <p>Best regards,<br><strong>${data.senderName}</strong></p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),
};

// Send student approval email
export async function sendStudentApprovalEmail(
  to: string,
  data: {
    name: string;
    studentCode: string;
    qrCodeDataUrl: string;
    loginUrl: string;
  }
): Promise<boolean> {
  const template = emailTemplates.studentApproval(data);
  return sendEmail({
    to,
    subject: template.subject,
    html: template.html,
  });
}

// Send password reset email
export async function sendPasswordResetEmail(
  to: string,
  data: {
    name: string;
    resetUrl: string;
    expiresIn: string;
  }
): Promise<boolean> {
  const template = emailTemplates.passwordReset(data);
  return sendEmail({
    to,
    subject: template.subject,
    html: template.html,
  });
}

// Send notification email
export async function sendNotificationEmail(
  to: string,
  data: {
    name: string;
    title: string;
    message: string;
    actionUrl?: string;
    actionText?: string;
  }
): Promise<boolean> {
  const template = emailTemplates.notification(data);
  return sendEmail({
    to,
    subject: template.subject,
    html: template.html,
  });
}

// Send bulk announcement
export async function sendBulkAnnouncement(
  recipients: string[],
  data: {
    title: string;
    content: string;
    senderName: string;
  }
): Promise<{ success: number; failed: number }> {
  const template = emailTemplates.bulkAnnouncement(data);
  let success = 0;
  let failed = 0;

  // Send emails in batches to avoid rate limiting
  const batchSize = 10;
  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    const promises = batch.map(async (recipient) => {
      const sent = await sendEmail({
        to: recipient,
        subject: template.subject,
        html: template.html,
      });
      if (sent) success++;
      else failed++;
    });
    await Promise.all(promises);
    
    // Small delay between batches
    if (i + batchSize < recipients.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return { success, failed };
}
