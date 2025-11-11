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
              <img src="https://i.ibb.co/1Y8k2vHw/Snaplove-logo-full-white-2.png" alt="Snaplove" style="max-width: 200px; height: auto; margin: 0 auto 16px auto; display: block;" />
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
    const loginUrl = `${frontendUrl}`;

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
<img src="https://i.ibb.co/FLsn2Jsw/Snaplove-logo-full-black-2.png" alt="Snaplove" style="max-width: 200px; height: auto; margin: 0 auto 16px auto; display: block;" />
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


  async sendRenewalReminder(subscription, user, daysUntilRenewal) {
    if (!this.transporter) {
      console.log('Email service not initialized - skipping renewal reminder');
      return;
    }

    const frontendUrl = this.getFrontendUrl();
    const manageUrl = `${frontendUrl}/profile?tab=subscription`;

    const renewalDate = new Date(subscription.subscription_end_date);
    const formattedDate = renewalDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const mailOptions = {
      from: {
        name: process.env.BREVO_FROM_NAME || 'Snaplove',
        address: process.env.BREVO_FROM_EMAIL
      },
      to: user.email,
      subject: `Your Snaplove Premium Renews in ${daysUntilRenewal} Days`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Subscription Renewal Reminder</title>
</head>
<body style="margin: 0; padding: 16px; background-color: #f9fafb; font-family: 'Nunito', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333;">
  <div style="max-width: 672px; margin: 0 auto;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #FFD586 0%, #FFE99A 100%); color: #1f2937; padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
      <img src="https://i.ibb.co/FLsn2Jsw/Snaplove-logo-full-black-2.png" alt="Snaplove" style="max-width: 200px; height: auto; margin: 0 auto 16px auto; display: block;" />
      <h1 style="font-size: 28px; font-weight: 700; margin: 0; font-family: 'Quicksand', 'Nunito', sans-serif;">Renewal Reminder 🔔</h1>
    </div>
    
    <!-- Content -->
    <div style="background-color: white; padding: 32px; border-radius: 0 0 16px 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
      <p style="font-size: 18px; color: #374151; margin: 0 0 24px 0;">Hi ${user.name},</p>
      
      <p style="color: #374151; margin: 0 0 24px 0; line-height: 1.625;">
        This is a friendly reminder that your <span style="font-weight: 700; color: #FF9898;">Snaplove Premium</span> subscription will automatically renew on <span style="font-weight: 600;">${formattedDate}</span>.
      </p>
      
      <!-- Renewal Details Box -->
      <div style="background: linear-gradient(to right, #FFE99A, #FFD586); padding: 24px; border-radius: 16px; margin-bottom: 24px;">
        <table style="width: 100%; border-spacing: 0;">
          <tr>
            <td style="padding: 8px 0;">
              <span style="font-weight: 600; color: #1f2937;">Renewal Date:</span>
            </td>
            <td style="text-align: right; padding: 8px 0;">
              <span style="color: #1f2937;">${formattedDate}</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0;">
              <span style="font-weight: 600; color: #1f2937;">Amount:</span>
            </td>
            <td style="text-align: right; padding: 8px 0;">
              <span style="color: #1f2937;">Rp ${subscription.amount.toLocaleString('id-ID')}</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0;">
              <span style="font-weight: 600; color: #1f2937;">Payment Method:</span>
            </td>
            <td style="text-align: right; padding: 8px 0;">
              <span style="color: #1f2937;">${subscription.payment_method || 'Same as last time'}</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0;">
              <span style="font-weight: 600; color: #1f2937;">Auto-Renewal:</span>
            </td>
            <td style="text-align: right; padding: 8px 0;">
              <span style="color: #10b981; font-weight: 600;">✅ Enabled</span>
            </td>
          </tr>
        </table>
      </div>
      
      <p style="color: #374151; margin: 0 0 24px 0; line-height: 1.625;">
        No action is needed on your part. We'll automatically process the payment and extend your premium access for another 30 days.
      </p>
      
      <!-- CTA Button -->
      <div style="text-align: center; margin-bottom: 32px;">
        <a href="${manageUrl}" style="display: inline-block; background: #FF9898; color: white; font-weight: 600; padding: 16px 32px; border-radius: 9999px; font-size: 18px; text-decoration: none; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
          Manage Subscription
        </a>
      </div>
      
      <!-- Info Box -->
      <div style="background-color: #f3f4f6; border-left: 4px solid #FF9898; padding: 16px 20px; border-radius: 8px; margin-bottom: 24px;">
        <p style="color: #374151; margin: 0; line-height: 1.625;">
          <strong>Want to make changes?</strong><br>
          You can update your payment method, disable auto-renewal, or cancel your subscription anytime in your account settings.
        </p>
      </div>
      
      <!-- Footer -->
      <div style="text-align: center; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; padding-top: 24px; margin-top: 32px;">
        <p style="margin: 0 0 8px 0;">Questions about your subscription?</p>
        <p style="margin: 0 0 8px 0;">Contact our support team or visit your account settings.</p>
        <p style="color: #9ca3af; font-size: 12px; margin: 8px 0 0 0;">
          This email was sent to ${user.email} regarding your Snaplove Premium subscription.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`✅ Renewal reminder sent to ${user.email} (${daysUntilRenewal} days)`);
    } catch (error) {
      console.error('❌ Failed to send renewal reminder:', error);
    }
  }

  async sendRenewalSuccess(subscription, user) {
    if (!this.transporter) {
      console.log('Email service not initialized - skipping renewal success email');
      return;
    }

    const frontendUrl = this.getFrontendUrl();
    const newExpiryDate = new Date(subscription.subscription_end_date);
    const formattedDate = newExpiryDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const mailOptions = {
      from: {
        name: process.env.BREVO_FROM_NAME || 'Snaplove',
        address: process.env.BREVO_FROM_EMAIL
      },
      to: user.email,
      subject: 'Payment Successful - Snaplove Premium Renewed! 🎉',
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Renewal Successful</title>
</head>
<body style="margin: 0; padding: 16px; background-color: #f9fafb; font-family: 'Nunito', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333;">
  <div style="max-width: 672px; margin: 0 auto;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #A8EECC 0%, #C7F9E3 100%); color: #1f2937; padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
      <img src="https://i.ibb.co/FLsn2Jsw/Snaplove-logo-full-black-2.png" alt="Snaplove" style="max-width: 200px; height: auto; margin: 0 auto 16px auto; display: block;" />
      <h1 style="font-size: 28px; font-weight: 700; margin: 0; font-family: 'Quicksand', 'Nunito', sans-serif;">Payment Successful! ✅</h1>
    </div>
    
    <!-- Content -->
    <div style="background-color: white; padding: 32px; border-radius: 0 0 16px 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
      <!-- Success Badge -->
      <div style="background: linear-gradient(to right, #A8EECC, #C7F9E3); padding: 24px; border-radius: 16px; text-align: center; margin-bottom: 24px;">
        <div style="font-size: 48px; margin-bottom: 8px;">🎊</div>
        <h2 style="font-size: 24px; font-weight: 700; color: #1f2937; margin: 0 0 8px 0; font-family: 'Quicksand', 'Nunito', sans-serif;">Premium Renewed!</h2>
        <p style="font-size: 16px; color: #374151; margin: 0;">Your subscription has been extended</p>
      </div>
      
      <p style="font-size: 18px; color: #374151; margin: 0 0 24px 0;">Hi ${user.name},</p>
      
      <p style="color: #374151; margin: 0 0 24px 0; line-height: 1.625;">
        Great news! Your <span style="font-weight: 700; color: #FF9898;">Snaplove Premium</span> subscription has been successfully renewed. Your payment has been processed and your premium access continues uninterrupted.
      </p>
      
      <!-- Payment Details -->
      <div style="background-color: #f9fafb; border: 2px solid #A8EECC; padding: 24px; border-radius: 16px; margin-bottom: 24px;">
        <h3 style="font-size: 18px; font-weight: 700; color: #1f2937; margin: 0 0 16px 0;">Payment Details</h3>
        <table style="width: 100%; border-spacing: 0;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Amount Paid:</td>
            <td style="text-align: right; padding: 8px 0; font-weight: 600; color: #1f2937;">Rp ${subscription.amount.toLocaleString('id-ID')}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Payment Method:</td>
            <td style="text-align: right; padding: 8px 0; font-weight: 600; color: #1f2937;">${subscription.payment_method || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">New Expiry Date:</td>
            <td style="text-align: right; padding: 8px 0; font-weight: 600; color: #10b981;">${formattedDate}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Order ID:</td>
            <td style="text-align: right; padding: 8px 0; font-size: 12px; color: #6b7280;">${subscription.order_id}</td>
          </tr>
        </table>
      </div>
      
      <p style="color: #374151; margin: 0 0 24px 0; line-height: 1.625;">
        You'll continue enjoying all premium features including unlimited frame creation, priority support, and exclusive content.
      </p>
      
      <!-- CTA Button -->
      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${frontendUrl}" style="display: inline-block; background: #A8EECC; color: #1f2937; font-weight: 600; padding: 16px 32px; border-radius: 9999px; font-size: 18px; text-decoration: none; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
          Go to Snaplove
        </a>
      </div>
      
      <!-- Footer -->
      <div style="text-align: center; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; padding-top: 24px; margin-top: 32px;">
        <p style="margin: 0 0 8px 0;">Thank you for being a premium member! 💖</p>
        <p style="margin: 0 0 8px 0;">Your next renewal will be on <strong>${formattedDate}</strong></p>
        <p style="color: #9ca3af; font-size: 12px; margin: 8px 0 0 0;">
          This receipt was sent to ${user.email}
        </p>
      </div>
    </div>
  </div>
</body>
</html>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`✅ Renewal success email sent to ${user.email}`);
    } catch (error) {
      console.error('❌ Failed to send renewal success email:', error);
    }
  }

  async sendRenewalFailed(subscription, user, attemptNumber) {
    if (!this.transporter) {
      console.log('Email service not initialized - skipping renewal failed email');
      return;
    }

    const frontendUrl = this.getFrontendUrl();
    const manageUrl = `${frontendUrl}/profile?tab=subscription`;
    const maxAttempts = 3;
    const remainingAttempts = maxAttempts - attemptNumber;

    const mailOptions = {
      from: {
        name: process.env.BREVO_FROM_NAME || 'Snaplove',
        address: process.env.BREVO_FROM_EMAIL
      },
      to: user.email,
      subject: '⚠️ Payment Failed - Action Required for Snaplove Premium',
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Failed</title>
</head>
<body style="margin: 0; padding: 16px; background-color: #f9fafb; font-family: 'Nunito', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333;">
  <div style="max-width: 672px; margin: 0 auto;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #FF9898 0%, #FFAAAA 100%); color: white; padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
      <img src="https://i.ibb.co/1Y8k2vHw/Snaplove-logo-full-white-2.png" alt="Snaplove" style="max-width: 200px; height: auto; margin: 0 auto 16px auto; display: block;" />
      <h1 style="font-size: 28px; font-weight: 700; margin: 0; font-family: 'Quicksand', 'Nunito', sans-serif;">Payment Failed ⚠️</h1>
    </div>
    
    <!-- Content -->
    <div style="background-color: white; padding: 32px; border-radius: 0 0 16px 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
      <p style="font-size: 18px; color: #374151; margin: 0 0 24px 0;">Hi ${user.name},</p>
      
      <p style="color: #374151; margin: 0 0 24px 0; line-height: 1.625;">
        We attempted to renew your <span style="font-weight: 700; color: #FF9898;">Snaplove Premium</span> subscription, but the payment was unsuccessful.
      </p>
      
      <!-- Warning Box -->
      <div style="background-color: #FEF3C7; border: 2px solid #F59E0B; padding: 24px; border-radius: 16px; margin-bottom: 24px;">
        <div style="display: table; width: 100%;">
          <div style="display: table-cell; vertical-align: top; width: 40px; padding-right: 12px;">
            <span style="font-size: 32px;">⚠️</span>
          </div>
          <div style="display: table-cell; vertical-align: top;">
            <h3 style="font-size: 18px; font-weight: 700; color: #92400E; margin: 0 0 8px 0;">Action Required</h3>
            <p style="color: #78350F; margin: 0; line-height: 1.625;">
              This is attempt <strong>${attemptNumber}</strong> of <strong>${maxAttempts}</strong>. 
              ${remainingAttempts > 0
          ? `We'll try again in 24 hours. (${remainingAttempts} ${remainingAttempts === 1 ? 'attempt' : 'attempts'} remaining)`
          : 'This was our final attempt. Your subscription will enter a grace period.'}
            </p>
          </div>
        </div>
      </div>
      
      <p style="color: #374151; margin: 0 0 24px 0; line-height: 1.625;">
        <strong>Possible reasons for payment failure:</strong>
      </p>
      
      <ul style="color: #374151; margin: 0 0 24px 0; padding-left: 24px; line-height: 1.8;">
        <li>Insufficient funds</li>
        <li>Expired or invalid payment method</li>
        <li>Payment method limit exceeded</li>
        <li>Temporary payment gateway issue</li>
      </ul>
      
      <!-- CTA Button -->
      <div style="text-align: center; margin-bottom: 32px;">
        <a href="${manageUrl}" style="display: inline-block; background: #FF9898; color: white; font-weight: 600; padding: 16px 32px; border-radius: 9999px; font-size: 18px; text-decoration: none; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
          Update Payment Method
        </a>
      </div>
      
      <!-- Info Box -->
      <div style="background-color: #f3f4f6; border-left: 4px solid #6b7280; padding: 16px 20px; border-radius: 8px; margin-bottom: 24px;">
        <p style="color: #374151; margin: 0; line-height: 1.625;">
          <strong>What happens next?</strong><br>
          ${remainingAttempts > 0
          ? 'We\'ll automatically retry the payment. You can also manually update your payment method now to avoid any interruption.'
          : 'You\'ll enter a 3-day grace period with limited access. Update your payment method to restore full premium features.'}
        </p>
      </div>
      
      <!-- Footer -->
      <div style="text-align: center; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; padding-top: 24px; margin-top: 32px;">
        <p style="margin: 0 0 8px 0;">Need help? Contact our support team.</p>
        <p style="color: #9ca3af; font-size: 12px; margin: 8px 0 0 0;">
          Order ID: ${subscription.order_id}
        </p>
      </div>
    </div>
  </div>
</body>
</html>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`✅ Renewal failed email sent to ${user.email} (Attempt ${attemptNumber})`);
    } catch (error) {
      console.error('❌ Failed to send renewal failed email:', error);
    }
  }

  async sendGracePeriodNotification(subscription, user) {
    if (!this.transporter) {
      console.log('Email service not initialized - skipping grace period notification');
      return;
    }

    const frontendUrl = this.getFrontendUrl();
    const manageUrl = `${frontendUrl}/profile?tab=subscription`;
    const gracePeriodEnd = new Date(subscription.grace_period_end);
    const daysRemaining = Math.ceil((gracePeriodEnd - Date.now()) / (1000 * 60 * 60 * 24));

    const mailOptions = {
      from: {
        name: process.env.BREVO_FROM_NAME || 'Snaplove',
        address: process.env.BREVO_FROM_EMAIL
      },
      to: user.email,
      subject: '🕐 Grace Period Active - Update Payment to Keep Premium Access',
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Grace Period Active</title>
</head>
<body style="margin: 0; padding: 16px; background-color: #f9fafb; font-family: 'Nunito', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333;">
  <div style="max-width: 672px; margin: 0 auto;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #F59E0B 0%, #FCD34D 100%); color: #1f2937; padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
      <img src="https://i.ibb.co/FLsn2Jsw/Snaplove-logo-full-black-2.png" alt="Snaplove" style="max-width: 200px; height: auto; margin: 0 auto 16px auto; display: block;" />
      <h1 style="font-size: 28px; font-weight: 700; margin: 0; font-family: 'Quicksand', 'Nunito', sans-serif;">Grace Period Active 🕐</h1>
    </div>
    
    <!-- Content -->
    <div style="background-color: white; padding: 32px; border-radius: 0 0 16px 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
      <p style="font-size: 18px; color: #374151; margin: 0 0 24px 0;">Hi ${user.name},</p>
      
      <p style="color: #374151; margin: 0 0 24px 0; line-height: 1.625;">
        Your <span style="font-weight: 700; color: #FF9898;">Snaplove Premium</span> subscription payment couldn't be processed after multiple attempts. You've entered a <strong>3-day grace period</strong>.
      </p>
      
      <!-- Countdown Box -->
      <div style="background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%); padding: 32px; border-radius: 16px; text-align: center; margin-bottom: 24px; border: 3px solid #F59E0B;">
        <div style="font-size: 64px; font-weight: 700; color: #92400E; margin-bottom: 8px;">${daysRemaining}</div>
        <div style="font-size: 20px; font-weight: 600; color: #78350F;">Day${daysRemaining !== 1 ? 's' : ''} Remaining</div>
      </div>
      
      <p style="color: #374151; margin: 0 0 24px 0; line-height: 1.625;">
        <strong>During the grace period:</strong>
      </p>
      
      <table style="width: 100%; margin-bottom: 24px; border-spacing: 0;">
        <tr>
          <td style="padding: 12px; background-color: #FEE2E2; border-radius: 12px; margin-bottom: 8px; width: 50%; vertical-align: top;">
            <div style="text-align: center;">
              <div style="font-size: 32px; margin-bottom: 8px;">❌</div>
              <div style="font-weight: 600; color: #991B1B;">Limited Access</div>
              <div style="font-size: 14px; color: #7F1D1D; margin-top: 4px;">Can't create frames or upload</div>
            </div>
          </td>
          <td style="width: 16px;"></td>
          <td style="padding: 12px; background-color: #D1FAE5; border-radius: 12px; margin-bottom: 8px; width: 50%; vertical-align: top;">
            <div style="text-align: center;">
              <div style="font-size: 32px; margin-bottom: 8px;">✅</div>
              <div style="font-weight: 600; color: #065F46;">View Only</div>
              <div style="font-size: 14px; color: #064E3B; margin-top: 4px;">Browse and view content</div>
            </div>
          </td>
        </tr>
      </table>
      
      <!-- Warning Box -->
      <div style="background-color: #FEF3C7; border: 2px solid #F59E0B; padding: 24px; border-radius: 16px; margin-bottom: 24px;">
        <div style="display: table; width: 100%;">
          <div style="display: table-cell; vertical-align: top; width: 40px; padding-right: 12px;">
            <span style="font-size: 32px;">⏰</span>
          </div>
          <div style="display: table-cell; vertical-align: top;">
            <h3 style="font-size: 18px; font-weight: 700; color: #92400E; margin: 0 0 8px 0;">Urgent Action Needed</h3>
            <p style="color: #78350F; margin: 0; line-height: 1.625;">
              Update your payment method within ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} to restore full premium access. After the grace period ends, you'll be downgraded to the free tier.
            </p>
          </div>
        </div>
      </div>
      
      <!-- CTA Button -->
      <div style="text-align: center; margin-bottom: 32px;">
        <a href="${manageUrl}" style="display: inline-block; background: #F59E0B; color: white; font-weight: 600; padding: 16px 32px; border-radius: 9999px; font-size: 18px; text-decoration: none; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
          Reactivate Premium Now
        </a>
      </div>
      
      <!-- Help Section -->
      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 12px; text-align: center;">
        <p style="color: #374151; margin: 0 0 12px 0; font-weight: 600;">Need Help?</p>
        <p style="color: #6b7280; margin: 0; font-size: 14px; line-height: 1.625;">
          If you're experiencing issues with payment, our support team is here to help. Reply to this email or contact us through the app.
        </p>
      </div>
      
      <!-- Footer -->
      <div style="text-align: center; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; padding-top: 24px; margin-top: 32px;">
        <p style="margin: 0 0 8px 0;">We hope to keep you as a premium member! 💖</p>
        <p style="color: #9ca3af; font-size: 12px; margin: 8px 0 0 0;">
          Grace period ends: ${gracePeriodEnd.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>
    </div>
  </div>
</body>
</html>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`✅ Grace period notification sent to ${user.email}`);
    } catch (error) {
      console.error('❌ Failed to send grace period notification:', error);
    }
  }

  async sendCancellationConfirmation(subscription, user, withRefund) {
    if (!this.transporter) {
      console.log('Email service not initialized - skipping cancellation confirmation');
      return;
    }

    const frontendUrl = this.getFrontendUrl();
    const accessUntil = subscription.subscription_end_date
      ? new Date(subscription.subscription_end_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : 'N/A';

    const mailOptions = {
      from: {
        name: process.env.BREVO_FROM_NAME || 'Snaplove',
        address: process.env.BREVO_FROM_EMAIL
      },
      to: user.email,
      subject: withRefund ? 'Subscription Cancelled & Refund Processed' : 'Subscription Cancelled - Access Until Period End',
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Subscription Cancelled</title>
</head>
<body style="margin: 0; padding: 16px; background-color: #f9fafb; font-family: 'Nunito', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333;">
  <div style="max-width: 672px; margin: 0 auto;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, ${withRefund ? '#C9A7FF 0%, #E2CFFF 100%' : '#9CA3AF 0%, #D1D5DB 100%'}); color: ${withRefund ? 'white' : '#1f2937'}; padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
      <img src="${withRefund ? 'https://i.ibb.co/1Y8k2vHw/Snaplove-logo-full-white-2.png' : 'https://i.ibb.co/FLsn2Jsw/Snaplove-logo-full-black-2.png'}" alt="Snaplove" style="max-width: 200px; height: auto; margin: 0 auto 16px auto; display: block;" />
      <h1 style="font-size: 28px; font-weight: 700; margin: 0; font-family: 'Quicksand', 'Nunito', sans-serif;">Subscription Cancelled</h1>
    </div>
    
    <!-- Content -->
    <div style="background-color: white; padding: 32px; border-radius: 0 0 16px 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
      <p style="font-size: 18px; color: #374151; margin: 0 0 24px 0;">Hi ${user.name},</p>
      
      <p style="color: #374151; margin: 0 0 24px 0; line-height: 1.625;">
        We've processed your cancellation request for <span style="font-weight: 700; color: #FF9898;">Snaplove Premium</span>. We're sorry to see you go! 😢
      </p>
      
      ${withRefund ? `
      <!-- Refund Confirmation -->
      <div style="background: linear-gradient(to right, #C9A7FF, #E2CFFF); padding: 24px; border-radius: 16px; margin-bottom: 24px; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 12px;">💰</div>
        <h2 style="font-size: 24px; font-weight: 700; color: white; margin: 0 0 8px 0; font-family: 'Quicksand', 'Nunito', sans-serif;">Refund Processed</h2>
        <p style="font-size: 20px; font-weight: 600; color: white; margin: 0;">Rp ${subscription.refund_amount ? subscription.refund_amount.toLocaleString('id-ID') : subscription.amount.toLocaleString('id-ID')}</p>
      </div>
      
      <p style="color: #374151; margin: 0 0 24px 0; line-height: 1.625;">
        Your refund of <strong>Rp ${subscription.refund_amount ? subscription.refund_amount.toLocaleString('id-ID') : subscription.amount.toLocaleString('id-ID')}</strong> has been initiated. It will be returned to your original payment method within 5-14 business days, depending on your payment provider.
      </p>
      
      <div style="background-color: #F3E8FF; border: 2px solid #C9A7FF; padding: 20px; border-radius: 12px; margin-bottom: 24px;">
        <p style="color: #374151; margin: 0; line-height: 1.625;">
          <strong>⚠️ Immediate Effect:</strong><br>
          Your premium access has ended immediately. You've been downgraded to the free tier.
        </p>
      </div>
      ` : `
      <!-- Access Continuation -->
      <div style="background: linear-gradient(to right, #A8EECC, #C7F9E3); padding: 24px; border-radius: 16px; margin-bottom: 24px; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 12px;">✅</div>
        <h2 style="font-size: 24px; font-weight: 700; color: #1f2937; margin: 0 0 8px 0; font-family: 'Quicksand', 'Nunito', sans-serif;">Auto-Renewal Disabled</h2>
        <p style="font-size: 16px; color: #374151; margin: 0;">You still have premium access!</p>
      </div>
      
      <p style="color: #374151; margin: 0 0 24px 0; line-height: 1.625;">
        Good news! You'll continue to enjoy all premium features until <strong>${accessUntil}</strong>. After that, you'll be moved to the free tier.
      </p>
      
      <div style="background-color: #FFF7ED; border: 2px solid #FFD586; padding: 20px; border-radius: 12px; margin-bottom: 24px;">
        <p style="color: #374151; margin: 0; line-height: 1.625;">
          <strong>💡 No Refund:</strong><br>
          Since it's been more than 5 days since your payment, you'll keep your premium access until the end of your current billing period.
        </p>
      </div>
      `}
      
      <!-- Cancellation Details -->
      <div style="background-color: #f9fafb; padding: 20px; border-radius: 12px; margin-bottom: 24px;">
        <h3 style="font-size: 18px; font-weight: 700; color: #1f2937; margin: 0 0 16px 0;">Cancellation Details</h3>
        <table style="width: 100%; border-spacing: 0;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Order ID:</td>
            <td style="text-align: right; padding: 8px 0; font-size: 12px; color: #6b7280;">${subscription.order_id}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Cancelled On:</td>
            <td style="text-align: right; padding: 8px 0; color: #1f2937;">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
          </tr>
          ${!withRefund ? `
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Access Until:</td>
            <td style="text-align: right; padding: 8px 0; font-weight: 600; color: #10b981;">${accessUntil}</td>
          </tr>
          ` : ''}
          ${withRefund && subscription.refund_reference ? `
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Refund Reference:</td>
            <td style="text-align: right; padding: 8px 0; font-size: 12px; color: #6b7280;">${subscription.refund_reference}</td>
          </tr>
          ` : ''}
        </table>
      </div>
      
      <!-- Feedback Section -->
      <div style="background-color: #FEF3C7; padding: 24px; border-radius: 16px; margin-bottom: 24px;">
        <h3 style="font-size: 18px; font-weight: 700; color: #92400E; margin: 0 0 12px 0;">We'd Love Your Feedback</h3>
        <p style="color: #78350F; margin: 0; line-height: 1.625;">
          Help us improve! Would you mind sharing why you cancelled? Your feedback helps us make Snaplove better for everyone.
        </p>
      </div>
      
      <!-- Come Back CTA -->
      <div style="text-align: center; margin-bottom: 24px;">
        <p style="color: #374151; margin: 0 0 16px 0; font-weight: 600;">Changed your mind? You can resubscribe anytime!</p>
        <a href="${frontendUrl}/profile?tab=subscription" style="display: inline-block; background: #FF9898; color: white; font-weight: 600; padding: 16px 32px; border-radius: 9999px; font-size: 18px; text-decoration: none; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
          View Subscription Options
        </a>
      </div>
      
      <!-- Footer -->
      <div style="text-align: center; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; padding-top: 24px; margin-top: 32px;">
        <p style="margin: 0 0 8px 0;">Thank you for being part of the Snaplove community! 💖</p>
        <p style="margin: 0 0 8px 0;">You can continue using Snaplove with our free tier.</p>
        <p style="color: #9ca3af; font-size: 12px; margin: 8px 0 0 0;">
          Questions? Contact our support team anytime.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`✅ Cancellation confirmation sent to ${user.email} (Refund: ${withRefund})`);
    } catch (error) {
      console.error('❌ Failed to send cancellation confirmation:', error);
    }
  }

  async sendSubscriptionEnding(subscription, user) {
    if (!this.transporter) {
      console.log('Email service not initialized - skipping subscription ending notification');
      return;
    }

    const frontendUrl = this.getFrontendUrl();
    const renewUrl = `${frontendUrl}/profile?tab=subscription`;
    const expiryDate = new Date(subscription.subscription_end_date);
    const daysUntilExpiry = Math.ceil((expiryDate - Date.now()) / (1000 * 60 * 60 * 24));

    const mailOptions = {
      from: {
        name: process.env.BREVO_FROM_NAME || 'Snaplove',
        address: process.env.BREVO_FROM_EMAIL
      },
      to: user.email,
      subject: `Your Snaplove Premium Ends in ${daysUntilExpiry} Days`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Subscription Ending Soon</title>
</head>
<body style="margin: 0; padding: 16px; background-color: #f9fafb; font-family: 'Nunito', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333;">
  <div style="max-width: 672px; margin: 0 auto;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #9CA3AF 0%, #D1D5DB 100%); color: #1f2937; padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
      <img src="https://i.ibb.co/FLsn2Jsw/Snaplove-logo-full-black-2.png" alt="Snaplove" style="max-width: 200px; height: auto; margin: 0 auto 16px auto; display: block;" />
      <h1 style="font-size: 28px; font-weight: 700; margin: 0; font-family: 'Quicksand', 'Nunito', sans-serif;">Subscription Ending Soon</h1>
    </div>
    
    <!-- Content -->
    <div style="background-color: white; padding: 32px; border-radius: 0 0 16px 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
      <p style="font-size: 18px; color: #374151; margin: 0 0 24px 0;">Hi ${user.name},</p>
      
      <p style="color: #374151; margin: 0 0 24px 0; line-height: 1.625;">
        Your <span style="font-weight: 700; color: #FF9898;">Snaplove Premium</span> subscription will expire on <strong>${expiryDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</strong>.
      </p>
      
      <!-- Info Box -->
      <div style="background-color: #FEF3C7; border: 2px solid #F59E0B; padding: 24px; border-radius: 16px; margin-bottom: 24px;">
        <div style="display: table; width: 100%;">
          <div style="display: table-cell; vertical-align: top; width: 40px; padding-right: 12px;">
            <span style="font-size: 32px;">ℹ️</span>
          </div>
          <div style="display: table-cell; vertical-align: top;">
            <h3 style="font-size: 18px; font-weight: 700; color: #92400E; margin: 0 0 8px 0;">Auto-Renewal is Disabled</h3>
            <p style="color: #78350F; margin: 0; line-height: 1.625;">
              Your subscription won't automatically renew. To continue enjoying premium features, you'll need to manually renew.
            </p>
          </div>
        </div>
      </div>
      
      <p style="color: #374151; margin: 0 0 24px 0; line-height: 1.625;">
        <strong>What you'll lose after expiry:</strong>
      </p>
      
      <table style="width: 100%; margin-bottom: 24px; border-spacing: 0;">
        <tr>
          <td style="padding: 12px; background-color: #FEE2E2; border-radius: 12px; width: 48%;">
            <div style="text-align: center;">
              <div style="font-size: 24px; margin-bottom: 8px;">🖼️</div>
              <div style="font-weight: 600; color: #991B1B; font-size: 14px;">Unlimited Frames</div>
            </div>
          </td>
          <td style="width: 4%;"></td>
          <td style="padding: 12px; background-color: #FEE2E2; border-radius: 12px; width: 48%;">
            <div style="text-align: center;">
              <div style="font-size: 24px; margin-bottom: 8px;">⚡</div>
              <div style="font-weight: 600; color: #991B1B; font-size: 14px;">Priority Support</div>
            </div>
          </td>
        </tr>
        <tr><td colspan="3" style="height: 8px;"></td></tr>
        <tr>
          <td style="padding: 12px; background-color: #FEE2E2; border-radius: 12px;">
            <div style="text-align: center;">
              <div style="font-size: 24px; margin-bottom: 8px;">✨</div>
              <div style="font-weight: 600; color: #991B1B; font-size: 14px;">Exclusive Features</div>
            </div>
          </td>
          <td style="width: 4%;"></td>
          <td style="padding: 12px; background-color: #FEE2E2; border-radius: 12px;">
            <div style="text-align: center;">
              <div style="font-size: 24px; margin-bottom: 8px;">👑</div>
              <div style="font-weight: 600; color: #991B1B; font-size: 14px;">Premium Badge</div>
            </div>
          </td>
        </tr>
      </table>
      
      <!-- CTA Button -->
      <div style="text-align: center; margin-bottom: 32px;">
        <p style="color: #374151; margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">Don't lose your premium benefits!</p>
        <a href="${renewUrl}" style="display: inline-block; background: #FF9898; color: white; font-weight: 600; padding: 16px 32px; border-radius: 9999px; font-size: 18px; text-decoration: none; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
          Renew Premium Now
        </a>
      </div>
      
      <!-- Enable Auto-Renewal Box -->
      <div style="background: linear-gradient(to right, #A8EECC, #C7F9E3); padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 24px;">
        <h3 style="font-size: 18px; font-weight: 700; color: #1f2937; margin: 0 0 8px 0;">💡 Pro Tip</h3>
        <p style="color: #374151; margin: 0; line-height: 1.625;">
          Enable auto-renewal to never worry about losing your premium status again!
        </p>
      </div>
      
      <!-- Footer -->
      <div style="text-align: center; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; padding-top: 24px; margin-top: 32px;">
        <p style="margin: 0 0 8px 0;">We'd love to keep you as a premium member! 💖</p>
        <p style="color: #9ca3af; font-size: 12px; margin: 8px 0 0 0;">
          Questions? Our support team is here to help.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`✅ Subscription ending notification sent to ${user.email}`);
    } catch (error) {
      console.error('❌ Failed to send subscription ending notification:', error);
    }
  }
}

module.exports = new MailService();