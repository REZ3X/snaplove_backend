const nodemailer = require('nodemailer');
const crypto = require('crypto');

class MailService {
  constructor() {
    this.transporter = null;
    this.initialize();
  }

  initialize() {
    if (!process.env.BREVO_SMTP_HOST) {
      console.log('⚠️ Brevo SMTP credentials not found - email service disabled');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: process.env.BREVO_SMTP_HOST,
      port: parseInt(process.env.BREVO_SMTP_PORT),
      secure: false,       auth: {
        user: process.env.BREVO_SMTP_USER,
        pass: process.env.BREVO_SMTP_PASS
      }
    });

    this.transporter.verify((error, _success) => {
      if (error) {
        console.error('❌ Brevo SMTP connection failed:', error);
      } else {
        console.log('✅ Brevo SMTP server is ready to send emails');
      }
    });
  }

  getFrontendUrl() {
    if (process.env.NODE_ENV === 'production') {

      const productionUrls = process.env.PRODUCTION_FRONTEND_URLS;
      if (productionUrls) {
        return productionUrls.split(',')[0].trim();
      }

      return process.env.PRODUCTION_FRONTEND_URL;
    }

    return process.env.FRONTEND_URL || 'http://localhost:3000';
  }

  getBackendApiUrl() {
    if (process.env.NODE_ENV === 'production') {
      return process.env.PRODUCTION_BACKEND_URL;
    }
    return `http://localhost:${process.env.PORT || 3000}`;
  }

  async sendVerificationEmail(userEmail, userName, verificationToken, username) {
    if (!this.transporter) {
      throw new Error('Email service not available');
    }

    const frontendUrl = this.getFrontendUrl();
    const verificationUrl = `${frontendUrl}/verify-email?token=${verificationToken}&username=${username}`;

    const backendUrl = this.getBackendApiUrl();
    const apiVerificationUrl = `${backendUrl}/api/auth/verify-email?token=${verificationToken}&username=${username}`;

    const mailOptions = {
      from: {
        name: process.env.BREVO_FROM_NAME || 'Snaplove',
        address: process.env.BREVO_FROM_EMAIL
      },
      to: userEmail,
      subject: 'Welcome to Snaplove - Please Verify Your Email',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email - Snaplove</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #ffffff; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
            .button:hover { background: #5a67d8; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
            .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .code-section { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
            h1 { margin: 0; font-size: 28px; }
            h2 { color: #667eea; }
            .logo { font-size: 32px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">📸 Snaplove</div>
              <h1>Welcome to Snaplove!</h1>
              <p>Frame-based photo sharing platform</p>
            </div>
            
            <div class="content">
              <h2>Hello ${userName}! 👋</h2>
              
              <p>Thank you for joining <strong>Snaplove</strong>! We're excited to have you as part of our community where creativity meets photography.</p>
              
              <p>To get started and unlock all features, please verify your email address by clicking the button below:</p>
              
              <div style="text-align: center;">
                <a href="${verificationUrl}" class="button">✅ Verify My Email</a>
              </div>
              
              <div class="warning">
                <strong>⚠️ Important:</strong> You need to verify your email within <strong>24 hours</strong> to activate your account. Unverified accounts will be automatically removed.
              </div>
              
              <h3>What's Next?</h3>
              <ul>
                <li>🖼️ Create custom photo frames</li>
                <li>📸 Capture photos using frames</li>
                <li>👥 Follow other creators</li>
                <li>🏆 Join leaderboards and trending</li>
                <li>🎂 Set your birthday for special celebrations</li>
              </ul>
              
              <div class="code-section">
                <h4>Alternative Verification Methods:</h4>
                <p><strong>Manual Link:</strong> If the button doesn't work, copy and paste this link into your browser:</p>
                <p style="word-break: break-all; font-family: monospace; font-size: 12px;">
                  ${verificationUrl}
                </p>
                
                <p><strong>Direct API Call:</strong> For developers or if you're experiencing issues:</p>
                <p style="word-break: break-all; font-family: monospace; font-size: 12px;">
                  GET ${apiVerificationUrl}
                </p>
                
                <p><strong>Verification Details:</strong></p>
                <ul style="font-family: monospace; font-size: 12px;">
                  <li>Token: ${verificationToken}</li>
                  <li>Username: ${username}</li>
                  <li>Expires: 24 hours from registration</li>
                </ul>
              </div>
              
              <div class="footer">
                <p>Need help? Contact our support team or visit our help center.</p>
                <p>This email was sent to ${userEmail} because you registered for a Snaplove account.</p>
                <p style="color: #999; font-size: 12px;">
                  If you didn't create this account, please ignore this email.
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Welcome to Snaplove, ${userName}!
        
        Thank you for joining our frame-based photo sharing platform.
        
        Please verify your email address by visiting this link:
        ${verificationUrl}
        
        Alternative API endpoint: ${apiVerificationUrl}
        
        Verification details:
        - Token: ${verificationToken}
        - Username: ${username}
        - Expires: 24 hours from registration
        
        You have 24 hours to verify your email address.
        
        What's next after verification:
        - Create custom photo frames
        - Capture photos using frames  
        - Follow other creators
        - Join leaderboards and trending
        
        If you didn't create this account, please ignore this email.
        
        Best regards,
        The Snaplove Team
      `
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Verification email sent:', info.messageId);
      console.log(`📧 Frontend URL: ${verificationUrl}`);
      console.log(`🔗 API URL: ${apiVerificationUrl}`);
      return {
        success: true,
        messageId: info.messageId,
        frontendUrl: verificationUrl,
        apiUrl: apiVerificationUrl
      };
    } catch (error) {
      console.error('❌ Failed to send verification email:', error);
      throw new Error('Failed to send verification email');
    }
  }

  async sendWelcomeEmail(userEmail, userName, username) {
    if (!this.transporter) {
      throw new Error('Email service not available');
    }

    const frontendUrl = this.getFrontendUrl();
    const loginUrl = `${frontendUrl}/login`;

    const mailOptions = {
      from: {
        name: process.env.BREVO_FROM_NAME || 'Snaplove',
        address: process.env.BREVO_FROM_EMAIL
      },
      to: userEmail,
      subject: 'Welcome to Snaplove - Your Account is Now Active! 🎉',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Snaplove</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #ffffff; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .button { display: inline-block; background: #48bb78; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
            .button:hover { background: #38a169; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
            .success-box { background: #f0fff4; border: 1px solid #9ae6b4; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
            h1 { margin: 0; font-size: 28px; }
            h2 { color: #48bb78; }
            .logo { font-size: 32px; font-weight: bold; }
            .feature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
            .feature { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; }
            @media (max-width: 480px) { .feature-grid { grid-template-columns: 1fr; } }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">📸 Snaplove</div>
              <h1>Account Verified Successfully! 🎉</h1>
            </div>
            
            <div class="content">
              <div class="success-box">
                <h2>🎊 Congratulations, ${userName}!</h2>
                <p><strong>Your Snaplove account (@${username}) is now fully activated!</strong></p>
              </div>
              
              <p>Welcome to the Snaplove community! Your email has been verified and you now have full access to all our features.</p>
              
              <div style="text-align: center;">
                <a href="${loginUrl}" class="button">🚀 Start Creating</a>
              </div>
              
              <h3>🌟 What You Can Do Now:</h3>
              
              <div class="feature-grid">
                <div class="feature">
                  <h4>🖼️ Create Frames</h4>
                  <p>Design custom photo frames for your community</p>
                </div>
                <div class="feature">
                  <h4>📸 Capture Photos</h4>
                  <p>Take amazing photos using created frames</p>
                </div>
                <div class="feature">
                  <h4>👥 Social Features</h4>
                  <p>Follow creators and build your network</p>
                </div>
                <div class="feature">
                  <h4>🏆 Compete</h4>
                  <p>Join leaderboards and trending sections</p>
                </div>
              </div>
              
              <h3>📋 Getting Started Checklist:</h3>
              <ul style="list-style-type: none; padding: 0;">
                <li>✅ Email verified</li>
                <li>🔲 Complete your profile</li>
                <li>🔲 Create your first frame</li>
                <li>🔲 Set your birthday for celebrations</li>
                <li>🔲 Follow some creators</li>
              </ul>
              
              <p><strong>Pro Tip:</strong> Set your birthday in your profile settings to receive special birthday badges and celebrations! 🎂</p>
              
              <div class="footer">
                <p>Questions? Our community is here to help!</p>
                <p>Follow us for updates and tips on getting the most out of Snaplove.</p>
                <p style="color: #999; font-size: 12px;">
                  You're receiving this because you successfully verified your Snaplove account.
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Welcome email sent:', info.messageId);
      return {
        success: true,
        messageId: info.messageId
      };
    } catch (error) {
      console.error('❌ Failed to send welcome email:', error);
      throw new Error('Failed to send welcome email');
    }
  }

  generateVerificationToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  // async testConnection() {
  //   if (!this.transporter) {
  //     throw new Error('Email service not initialized');
  //   }

  //   try {
  //     await this.transporter.verify();
  //     console.log('✅ Email service connection test passed');
  //     return true;
  //   } catch (error) {
  //     console.error('❌ Email service connection test failed:', error);
  //     throw error;
  //   }
  // }
}

module.exports = new MailService();