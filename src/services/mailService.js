const nodemailer = require('nodemailer');
const crypto = require('crypto');

class MailService {
  constructor() {
    this.transporter = null;
    this.initialize();
  }

  initialize() {
    if (!process.env.BREVO_SMTP_HOST) {
      console.log('Brevo SMTP credentials not found - email service disabled');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: process.env.BREVO_SMTP_HOST,
      port: parseInt(process.env.BREVO_SMTP_PORT),
      secure: false,
      auth: {
        user: process.env.BREVO_SMTP_USER,
        pass: process.env.BREVO_SMTP_PASS
      }
    });

    this.transporter.verify((error, _success) => {
      if (error) {
        console.error('Brevo SMTP connection failed:', error);
      } else {
        console.log('Brevo SMTP server is ready to send emails');
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
        </head>
        <body style="margin: 0; padding: 16px; background-color: #f9fafb; font-family: 'Nunito', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333;">
          <div style="max-width: 672px; margin: 0 auto;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #FF9898 0%, #FFE99A 100%); color: white; padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
              <img src="https://i.ibb.co.com/1Y8k2vHw/Snaplove-logo-full-white-2.png" alt="Snaplove" style="max-width: 200px; height: auto; margin: 0 auto 16px auto; display: block;" />
            </div>
            
            <!-- Content -->
            <div style="background-color: white; padding: 32px; border-radius: 0 0 16px 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
              <h2 style="font-size: 24px; font-weight: 700; color: #FF9898; margin: 0 0 16px 0; font-family: 'Quicksand', 'Nunito', sans-serif;">Hello ${userName}! 👋</h2>
              
              <p style="color: #374151; margin: 0 0 24px 0; line-height: 1.625;">
                Thank you for joining <span style="font-weight: 600; color: #FF9898;">Snaplove</span>! We're excited to have you as part of our community where creativity meets photography.
              </p>
              
              <p style="color: #374151; margin: 0 0 24px 0; line-height: 1.625;">
                To get started and unlock all features, please verify your email address by clicking the button below:
              </p>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin-bottom: 32px;">
                <a href="${verificationUrl}" style="display: inline-block; background: #FF9898; color: white; font-weight: 600; padding: 16px 32px; border-radius: 9999px; font-size: 18px; text-decoration: none; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);">
                  Verify My Email
                </a>
              </div>
              
              <!-- Warning Box -->
              <div style="background-color: #FFE99A; border: 2px solid #FFD586; padding: 24px; border-radius: 16px; margin-bottom: 32px;">
                <table style="width: 100%; border-spacing: 0;">
                  <tr>
                    <td style="vertical-align: top; width: 40px; padding-right: 12px;">
                      <span style="font-size: 24px;">⚠</span>
                    </td>
                    <td style="vertical-align: top;">
                      <p style="font-weight: 600; color: #1f2937; margin: 0 0 8px 0;">Important:</p>
                      <p style="color: #374151; margin: 0;">You need to verify your email within <strong>24 hours</strong> to activate your account. Unverified accounts will be automatically removed.</p>
                    </td>
                  </tr>
                </table>
              </div>
              
              <!-- Features Section -->
              <h3 style="font-size: 20px; font-weight: 700; color: #FF9898; margin: 0 0 16px 0; font-family: 'Quicksand', 'Nunito', sans-serif;">What's Next?</h3>
              <table style="width: 100%; margin-bottom: 32px; border-spacing: 0;">
                <tr>
                  <td style="width: 50%; padding: 0 8px 16px 0; vertical-align: top;">
                    <div style="background: linear-gradient(to right, #FF9898, #FFAAAA); padding: 16px; border-radius: 16px; color: white;">
                      <div style="font-size: 24px; margin-bottom: 8px;">🖼</div>
                      <p style="font-weight: 600; margin: 0;">Create custom photo frames</p>
                    </div>
                  </td>
                  <td style="width: 50%; padding: 0 0 16px 8px; vertical-align: top;">
                    <div style="background: linear-gradient(to right, #C9A7FF, #E2CFFF); padding: 16px; border-radius: 16px; color: white;">
                      <div style="font-size: 24px; margin-bottom: 8px;">📸</div>
                      <p style="font-weight: 600; margin: 0;">Capture photos using frames</p>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="width: 50%; padding: 0 8px 0 0; vertical-align: top;">
                    <div style="background: linear-gradient(to right, #A8EECC, #C7F9E3); padding: 16px; border-radius: 16px; color: #1f2937;">
                      <div style="font-size: 24px; margin-bottom: 8px;">👥</div>
                      <p style="font-weight: 600; margin: 0;">Follow other creators</p>
                    </div>
                  </td>
                  <td style="width: 50%; padding: 0 0 0 8px; vertical-align: top;">
                    <div style="background: linear-gradient(to right, #FFD586, #FFE99A); padding: 16px; border-radius: 16px; color: #1f2937;">
                      <div style="font-size: 24px; margin-bottom: 8px;">🏆</div>
                      <p style="font-weight: 600; margin: 0;">Join leaderboards and trending</p>
                    </div>
                  </td>
                </tr>
              </table>
              
              <!-- Footer -->
              <div style="text-align: center; color: #4b5563; font-size: 14px;">
                <p style="margin: 0 0 8px 0;">Need help? Contact our support team or visit our help center.</p>
                <p style="margin: 0 0 8px 0;">This email was sent to <span style="font-weight: 600;">${userEmail}</span> because you registered for a Snaplove account.</p>
                <p style="color: #9ca3af; font-size: 12px; margin: 0;">
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
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;600;700;800&family=Plus+Jakarta+Sans:wght@300;400;600;700&family=Quicksand:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body style="font-family: 'Nunito', 'Plus Jakarta Sans', sans-serif; color: #333; background-color: #f9fafb; padding: 16px; margin: 0;">
  <div style="max-width: 672px; margin: 0 auto;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #A8EECC 0%, #C7F9E3 100%); color: #1f2937; padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
<img src="https://i.ibb.co.com/FLsn2Jsw/Snaplove-logo-full-black-2.png" alt="Snaplove" style="max-width: 200px; height: auto; margin: 0 auto 16px auto; display: block;" />
    </div>
    
    <!-- Content -->
    <div style="background-color: #ffffff; padding: 32px; border-radius: 0 0 16px 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
      <!-- Success Box -->
      <div style="background: linear-gradient(to right, #A8EECC, #C7F9E3); padding: 24px; border-radius: 16px; text-align: center; margin-bottom: 24px;">
        <h2 style="font-size: 24px; font-weight: 700; color: #1f2937; margin-bottom: 8px; margin-top: 0; font-family: 'Quicksand', 'Nunito', sans-serif;">🎊 Congratulations, ${userName}!</h2>
        <p style="font-size: 18px; font-weight: 600; color: #374151; margin: 0;">Your Snaplove account (@${username}) is now fully activated!</p>
      </div>
      
      <p style="color: #374151; margin-bottom: 24px; line-height: 1.625; margin-top: 0;">
        Welcome to the Snaplove community! Your email has been verified and you now have full access to all our features.
      </p>
      
      <!-- CTA Button -->
      <div style="text-align: center; margin-bottom: 32px;">
        <a href="${loginUrl}" style="display: inline-block; background-color: #A8EECC; color: #1f2937; font-weight: 600; padding: 16px 32px; border-radius: 9999px; font-size: 18px; text-decoration: none; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
        Start Creating
        </a>
      </div>
      
      <!-- Features Grid -->
      <h3 style="font-size: 20px; font-weight: 700; color: #000000; margin-bottom: 24px; margin-top: 0; font-family: 'Quicksand', 'Nunito', sans-serif;">What You Can Do Now:</h3>
      
      <table style="width: 100%; margin-bottom: 32px; border-spacing: 0;">
        <tr>
          <td style="width: 50%; padding: 8px; vertical-align: top;">
            <div style="background: linear-gradient(to bottom right, #FF9898, #FFAAAA); padding: 24px; border-radius: 16px; color: #ffffff; text-align: center; height: 100%; box-sizing: border-box;">
              <div style="font-size: 30px; margin-bottom: 12px;">🖼</div>
              <h4 style="font-weight: 700; margin-bottom: 8px; margin-top: 0; font-family: 'Quicksand', 'Nunito', sans-serif;">Create Frames</h4>
              <p style="font-size: 14px; opacity: 0.9; margin: 0;">Design custom photo frames for your community</p>
            </div>
          </td>
          <td style="width: 50%; padding: 8px; vertical-align: top;">
            <div style="background: linear-gradient(to bottom right, #C9A7FF, #E2CFFF); padding: 24px; border-radius: 16px; color: #ffffff; text-align: center; height: 100%; box-sizing: border-box;">
              <div style="font-size: 30px; margin-bottom: 12px;">📸</div>
              <h4 style="font-weight: 700; margin-bottom: 8px; margin-top: 0; font-family: 'Quicksand', 'Nunito', sans-serif;">Capture Photos</h4>
              <p style="font-size: 14px; opacity: 0.9; margin: 0;">Take amazing photos using created frames</p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="width: 50%; padding: 8px; vertical-align: top;">
            <div style="background: linear-gradient(to bottom right, #A8EECC, #C7F9E3); padding: 24px; border-radius: 16px; color: #1f2937; text-align: center; height: 100%; box-sizing: border-box;">
              <div style="font-size: 30px; margin-bottom: 12px;">👥</div>
              <h4 style="font-weight: 700; margin-bottom: 8px; margin-top: 0; font-family: 'Quicksand', 'Nunito', sans-serif;">Social Features</h4>
              <p style="font-size: 14px; margin: 0;">Follow creators and build your network</p>
            </div>
          </td>
          <td style="width: 50%; padding: 8px; vertical-align: top;">
            <div style="background: linear-gradient(to bottom right, #FFD586, #FFE99A); padding: 24px; border-radius: 16px; color: #1f2937; text-align: center; height: 100%; box-sizing: border-box;">
              <div style="font-size: 30px; margin-bottom: 12px;">🏆</div>
              <h4 style="font-weight: 700; margin-bottom: 8px; margin-top: 0; font-family: 'Quicksand', 'Nunito', sans-serif;">Compete</h4>
              <p style="font-size: 14px; margin: 0;">Join leaderboards and trending sections</p>
            </div>
          </td>
        </tr>
      </table>
      
      <!-- Pro Tip -->
      <div style="background: linear-gradient(to right, #FFD586, #FFE99A); padding: 24px; border-radius: 16px; margin-bottom: 24px;">
        <p style="color: #1f2937; margin: 0;"><span style="font-weight: 700;">Pro Tip:</span> Set your birthday in your profile settings to receive special birthday badges and celebrations! 🎂</p>
      </div>
      
      <!-- Footer -->
      <div style="text-align: center; color: #4b5563; font-size: 14px;">
        <p style="margin: 8px 0;">Questions? Our community is here to help!</p>
        <p style="margin: 8px 0;">Follow us for updates and tips on getting the most out of Snaplove.</p>
        <p style="color: #9ca3af; font-size: 12px; margin: 8px 0;">
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

  async testConnection() {
    if (!this.transporter) {
      throw new Error('Email service not initialized');
    }

    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('❌ Email service connection test failed:', error);
      throw error;
    }
  }
}

module.exports = new MailService();