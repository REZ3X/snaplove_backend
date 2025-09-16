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
      secure: false,
      auth: {
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
          <script src="https://cdn.tailwindcss.com"></script>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;600;700;800&family=Plus+Jakarta+Sans:wght@300;400;600;700&family=Quicksand:wght@400;600;700&display=swap" rel="stylesheet">
          <style>
            body { 
              font-family: 'Nunito', 'Plus Jakarta Sans', sans-serif; 
              color: #333; 
            }
            h1, h2, h3, h4, h5, h6 {
              font-family: 'Quicksand', 'Nunito', sans-serif;
              font-weight: 700;
            }
            .btn-primary {
              background: #FF9898;
              transition: all 0.3s ease;
            }
            .btn-primary:hover {
              background: #FFAAAA;
              transform: translateY(-2px);
              box-shadow: 0 8px 25px rgba(255, 152, 152, 0.3);
            }
            .gradient-bg {
              background: linear-gradient(135deg, #FF9898 0%, #FFE99A 100%);
            }
            .card-shadow {
              box-shadow: 0 10px 25px rgba(0,0,0,0.1);
            }
          </style>
        </head>
        <body class="bg-gray-50 p-4">
          <div class="max-w-2xl mx-auto">
            <!-- Header -->
            <div class="gradient-bg text-white p-8 rounded-t-2xl text-center">
              <div class="text-4xl font-bold mb-4">📸 Snaplove</div>
              <h1 class="text-3xl font-bold mb-2">Welcome to Snaplove!</h1>
              <p class="text-lg opacity-90">Frame-based photo sharing platform</p>
            </div>
            
            <!-- Content -->
            <div class="bg-white p-8 rounded-b-2xl card-shadow">
              <h2 class="text-2xl font-bold text-[#FF9898] mb-4">Hello ${userName}! 👋</h2>
              
              <p class="text-gray-700 mb-6 leading-relaxed">
                Thank you for joining <span class="font-semibold text-[#FF9898]">Snaplove</span>! We're excited to have you as part of our community where creativity meets photography.
              </p>
              
              <p class="text-gray-700 mb-6 leading-relaxed">
                To get started and unlock all features, please verify your email address by clicking the button below:
              </p>
              
              <!-- CTA Button -->
              <div class="text-center mb-8">
                <a href="${verificationUrl}" class="btn-primary inline-block text-white font-semibold py-4 px-8 rounded-full text-lg shadow-lg hover:shadow-xl transition-all duration-300">
                  ✅ Verify My Email
                </a>
              </div>
              
              <!-- Warning Box -->
              <div class="bg-[#FFE99A] border-2 border-[#FFD586] p-6 rounded-2xl mb-8">
                <div class="flex items-start space-x-3">
                  <span class="text-2xl">⚠️</span>
                  <div>
                    <p class="font-semibold text-gray-800 mb-2">Important:</p>
                    <p class="text-gray-700">You need to verify your email within <strong>24 hours</strong> to activate your account. Unverified accounts will be automatically removed.</p>
                  </div>
                </div>
              </div>
              
              <!-- Features Section -->
              <h3 class="text-xl font-bold text-[#C9A7FF] mb-4">What's Next?</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div class="bg-gradient-to-r from-[#FF9898] to-[#FFAAAA] p-4 rounded-2xl text-white">
                  <div class="text-2xl mb-2">🖼️</div>
                  <p class="font-semibold">Create custom photo frames</p>
                </div>
                <div class="bg-gradient-to-r from-[#C9A7FF] to-[#E2CFFF] p-4 rounded-2xl text-white">
                  <div class="text-2xl mb-2">📸</div>
                  <p class="font-semibold">Capture photos using frames</p>
                </div>
                <div class="bg-gradient-to-r from-[#A8EECC] to-[#C7F9E3] p-4 rounded-2xl text-gray-800">
                  <div class="text-2xl mb-2">👥</div>
                  <p class="font-semibold">Follow other creators</p>
                </div>
                <div class="bg-gradient-to-r from-[#FFD586] to-[#FFE99A] p-4 rounded-2xl text-gray-800">
                  <div class="text-2xl mb-2">🏆</div>
                  <p class="font-semibold">Join leaderboards and trending</p>
                </div>
              </div>
              
              <!-- Alternative Methods -->
              <div class="bg-gray-50 p-6 rounded-2xl mb-6">
                <h4 class="text-lg font-bold text-[#FF9898] mb-4">Alternative Verification Methods:</h4>
                
                <div class="mb-4">
                  <p class="font-semibold text-gray-800 mb-2">Manual Link:</p>
                  <p class="text-sm text-gray-600 mb-2">If the button doesn't work, copy and paste this link into your browser:</p>
                  <div class="bg-white p-3 rounded-lg border-2 border-[#FFD586] overflow-x-auto">
                    <code class="text-xs text-[#FF9898] break-all">${verificationUrl}</code>
                  </div>
                </div>
                
                <div class="mb-4">
                  <p class="font-semibold text-gray-800 mb-2">Direct API Call:</p>
                  <p class="text-sm text-gray-600 mb-2">For developers or if you're experiencing issues:</p>
                  <div class="bg-white p-3 rounded-lg border-2 border-[#C9A7FF] overflow-x-auto">
                    <code class="text-xs text-[#C9A7FF] break-all">GET ${apiVerificationUrl}</code>
                  </div>
                </div>
                
                <div>
                  <p class="font-semibold text-gray-800 mb-2">Verification Details:</p>
                  <div class="bg-white p-3 rounded-lg border-2 border-[#A8EECC]">
                    <ul class="text-xs space-y-1">
                      <li><span class="font-semibold">Token:</span> <code class="text-[#A8EECC]">${verificationToken}</code></li>
                      <li><span class="font-semibold">Username:</span> <code class="text-[#A8EECC]">${username}</code></li>
                      <li><span class="font-semibold">Expires:</span> 24 hours from registration</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              <!-- Footer -->
              <div class="text-center text-gray-600 text-sm space-y-2">
                <p>Need help? Contact our support team or visit our help center.</p>
                <p>This email was sent to <span class="font-semibold">${userEmail}</span> because you registered for a Snaplove account.</p>
                <p class="text-gray-400 text-xs">
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
          <script src="https://cdn.tailwindcss.com"></script>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;600;700;800&family=Plus+Jakarta+Sans:wght@300;400;600;700&family=Quicksand:wght@400;600;700&display=swap" rel="stylesheet">
          <style>
            body { 
              font-family: 'Nunito', 'Plus Jakarta Sans', sans-serif; 
              color: #333; 
            }
            h1, h2, h3, h4, h5, h6 {
              font-family: 'Quicksand', 'Nunito', sans-serif;
              font-weight: 700;
            }
            .btn-success {
              background: #A8EECC;
              transition: all 0.3s ease;
            }
            .btn-success:hover {
              background: #C7F9E3;
              transform: translateY(-2px);
              box-shadow: 0 8px 25px rgba(168, 238, 204, 0.3);
            }
            .success-gradient {
              background: linear-gradient(135deg, #A8EECC 0%, #C7F9E3 100%);
            }
            .card-shadow {
              box-shadow: 0 10px 25px rgba(0,0,0,0.1);
            }
          </style>
        </head>
        <body class="bg-gray-50 p-4">
          <div class="max-w-2xl mx-auto">
            <!-- Header -->
            <div class="success-gradient text-gray-800 p-8 rounded-t-2xl text-center">
              <div class="text-4xl font-bold mb-4">📸 Snaplove</div>
              <h1 class="text-3xl font-bold mb-2">Account Verified Successfully! 🎉</h1>
            </div>
            
            <!-- Content -->
            <div class="bg-white p-8 rounded-b-2xl card-shadow">
              <!-- Success Box -->
              <div class="bg-gradient-to-r from-[#A8EECC] to-[#C7F9E3] p-6 rounded-2xl text-center mb-6">
                <h2 class="text-2xl font-bold text-gray-800 mb-2">🎊 Congratulations, ${userName}!</h2>
                <p class="text-lg font-semibold text-gray-700">Your Snaplove account (@${username}) is now fully activated!</p>
              </div>
              
              <p class="text-gray-700 mb-6 leading-relaxed">
                Welcome to the Snaplove community! Your email has been verified and you now have full access to all our features.
              </p>
              
              <!-- CTA Button -->
              <div class="text-center mb-8">
                <a href="${loginUrl}" class="btn-success inline-block text-gray-800 font-semibold py-4 px-8 rounded-full text-lg shadow-lg hover:shadow-xl transition-all duration-300">
                  🚀 Start Creating
                </a>
              </div>
              
              <!-- Features Grid -->
              <h3 class="text-xl font-bold text-[#FF9898] mb-6">🌟 What You Can Do Now:</h3>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div class="bg-gradient-to-br from-[#FF9898] to-[#FFAAAA] p-6 rounded-2xl text-white text-center">
                  <div class="text-3xl mb-3">🖼️</div>
                  <h4 class="font-bold mb-2">Create Frames</h4>
                  <p class="text-sm opacity-90">Design custom photo frames for your community</p>
                </div>
                <div class="bg-gradient-to-br from-[#C9A7FF] to-[#E2CFFF] p-6 rounded-2xl text-white text-center">
                  <div class="text-3xl mb-3">📸</div>
                  <h4 class="font-bold mb-2">Capture Photos</h4>
                  <p class="text-sm opacity-90">Take amazing photos using created frames</p>
                </div>
                <div class="bg-gradient-to-br from-[#A8EECC] to-[#C7F9E3] p-6 rounded-2xl text-gray-800 text-center">
                  <div class="text-3xl mb-3">👥</div>
                  <h4 class="font-bold mb-2">Social Features</h4>
                  <p class="text-sm">Follow creators and build your network</p>
                </div>
                <div class="bg-gradient-to-br from-[#FFD586] to-[#FFE99A] p-6 rounded-2xl text-gray-800 text-center">
                  <div class="text-3xl mb-3">🏆</div>
                  <h4 class="font-bold mb-2">Compete</h4>
                  <p class="text-sm">Join leaderboards and trending sections</p>
                </div>
              </div>
              
              <!-- Checklist -->
              <h3 class="text-xl font-bold text-[#C9A7FF] mb-4">📋 Getting Started Checklist:</h3>
              <div class="bg-gray-50 p-6 rounded-2xl mb-6">
                <ul class="space-y-3">
                  <li class="flex items-center space-x-3">
                    <span class="text-[#A8EECC] text-xl">✅</span>
                    <span class="text-gray-700">Email verified</span>
                  </li>
                  <li class="flex items-center space-x-3">
                    <span class="text-[#FFD586] text-xl">🔲</span>
                    <span class="text-gray-700">Complete your profile</span>
                  </li>
                  <li class="flex items-center space-x-3">
                    <span class="text-[#FFD586] text-xl">🔲</span>
                    <span class="text-gray-700">Create your first frame</span>
                  </li>
                  <li class="flex items-center space-x-3">
                    <span class="text-[#FFD586] text-xl">🔲</span>
                    <span class="text-gray-700">Set your birthday for celebrations</span>
                  </li>
                  <li class="flex items-center space-x-3">
                    <span class="text-[#FFD586] text-xl">🔲</span>
                    <span class="text-gray-700">Follow some creators</span>
                  </li>
                </ul>
              </div>
              
              <!-- Pro Tip -->
              <div class="bg-gradient-to-r from-[#FFD586] to-[#FFE99A] p-6 rounded-2xl mb-6">
                <p class="text-gray-800"><span class="font-bold">Pro Tip:</span> Set your birthday in your profile settings to receive special birthday badges and celebrations! 🎂</p>
              </div>
              
              <!-- Footer -->
              <div class="text-center text-gray-600 text-sm space-y-2">
                <p>Questions? Our community is here to help!</p>
                <p>Follow us for updates and tips on getting the most out of Snaplove.</p>
                <p class="text-gray-400 text-xs">
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