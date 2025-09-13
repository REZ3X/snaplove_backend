const axios = require('axios');
const crypto = require('crypto');

class DiscordHookHandler {
  constructor() {
    this.webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    this.allowedUserIds = (process.env.DISCORD_ADMIN_IDS || '').split(',').filter(Boolean);
    this.commandPrefix = '!snap';
    this.sessionTokens = new Map();
    this.webhookInfo = null;   }

  async getWebhookInfo() {
    if (!this.webhookUrl) return null;
    
    try {

      const webhookMatch = this.webhookUrl.match(/webhooks\/(\d+)\/([a-zA-Z0-9_-]+)/);
      if (!webhookMatch) return null;
      
      const [, webhookId, webhookToken] = webhookMatch;

      const response = await axios.get(`https://discord.com/api/v10/webhooks/${webhookId}/${webhookToken}`);
      this.webhookInfo = response.data;
      
      return this.webhookInfo;
    } catch (error) {
      console.error('Failed to fetch webhook info:', error.message);
      return null;
    }
  }

  async sendMessage(content, embeds = null, components = null) {
    if (!this.webhookUrl) {
      console.warn('Discord webhook URL not configured');
      return false;
    }

    try {

      if (!this.webhookInfo) {
        await this.getWebhookInfo();
      }

      const payload = {
        content,

        username: this.webhookInfo?.name || 'Snaplove Admin',
        avatar_url: this.webhookInfo?.avatar 
          ? `https://cdn.discordapp.com/avatars/${this.webhookInfo.id}/${this.webhookInfo.avatar}.png?size=64`
          : 'https://via.placeholder.com/64x64/7289da/ffffff?text=S',
        ...(embeds && { embeds }),
        ...(components && { components })
      };

      await axios.post(this.webhookUrl, payload);
      return true;
    } catch (error) {
      console.error('Discord webhook error:', error.response?.data || error.message);
      return false;
    }
  }

  async sendEmbed(title, description, fields = [], color = 0x7289da, footer = null) {

    if (!this.webhookInfo) {
      await this.getWebhookInfo();
    }

    const embed = {
      title,
      description,
      color,
      timestamp: new Date().toISOString(),
      ...(fields.length > 0 && { fields }),
      footer: footer ? { text: footer } : {
        text: this.webhookInfo?.name ? `${this.webhookInfo.name} • Snaplove Admin Panel` : 'Snaplove Admin Panel',
        icon_url: this.webhookInfo?.avatar 
          ? `https://cdn.discordapp.com/avatars/${this.webhookInfo.id}/${this.webhookInfo.avatar}.png?size=16`
          : undefined
      }
    };

    return await this.sendMessage(null, [embed]);
  }

  async sendError(message, error = null) {
    const description = error ? `${message}\n\`\`\`${error}\`\`\`` : message;
    return await this.sendEmbed('❌ Error', description, [], 0xff0000, 'Error occurred while processing command');
  }

  async sendSuccess(message, fields = []) {
    return await this.sendEmbed('✅ Success', message, fields, 0x00ff00, 'Command executed successfully');
  }

  async sendStartupMessage() {
    if (!this.webhookInfo) {
      await this.getWebhookInfo();
    }

    const embed = {
      title: '🚀 Snaplove Backend Started',
      description: 'Backend server is now online and ready to receive Discord commands!',
      color: 0x00ff00,
      fields: [
        {
          name: '🤖 Webhook Info',
          value: this.webhookInfo 
            ? `**Name:** ${this.webhookInfo.name}\n**ID:** ${this.webhookInfo.id}\n**Guild:** ${this.webhookInfo.guild_id || 'N/A'}`
            : 'Webhook information not available',
          inline: false
        },
        {
          name: '⚡ Commands',
          value: `Use \`${this.commandPrefix} help\` to see available commands`,
          inline: true
        },
        {
          name: '👥 Authorized Admins',
          value: `${this.allowedUserIds.length} admin(s) configured`,
          inline: true
        }
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: this.webhookInfo?.name ? `${this.webhookInfo.name} • Backend Service` : 'Snaplove Backend Service',
        icon_url: this.webhookInfo?.avatar 
          ? `https://cdn.discordapp.com/avatars/${this.webhookInfo.id}/${this.webhookInfo.avatar}.png?size=16`
          : undefined
      }
    };

    return await this.sendMessage(null, [embed]);
  }

  async sendHelpMessage() {
    if (!this.webhookInfo) {
      await this.getWebhookInfo();
    }

    const embed = {
      title: '🔧 Snaplove Admin Commands',
      description: 'Available administrative commands for managing the Snaplove platform',
      color: 0x7289da,
      fields: [
        {
          name: '🖼️ Frame Management',
          value: [
            `\`${this.commandPrefix} frames [status]\` - List frames (pending/approved/rejected)`,
            `\`${this.commandPrefix} approve <frame_id> [reason]\` - Approve frame`,
            `\`${this.commandPrefix} reject <frame_id> <reason>\` - Reject frame`,
            `\`${this.commandPrefix} frame <frame_id>\` - Get frame details`
          ].join('\n'),
          inline: false
        },
        {
          name: '👥 User Management',
          value: [
            `\`${this.commandPrefix} users [role]\` - List users by role`,
            `\`${this.commandPrefix} user <username>\` - Get user details`,
            `\`${this.commandPrefix} ban <username> [duration] [reason]\` - Ban user`,
            `\`${this.commandPrefix} unban <username>\` - Unban user`,
            `\`${this.commandPrefix} role <username> <role>\` - Change user role`
          ].join('\n'),
          inline: false
        },
        {
          name: '📋 Reports & Tickets',
          value: [
            `\`${this.commandPrefix} reports [status]\` - List reports`,
            `\`${this.commandPrefix} tickets [status]\` - List tickets`,
            `\`${this.commandPrefix} report <report_id>\` - Get report details`,
            `\`${this.commandPrefix} ticket <ticket_id>\` - Get ticket details`
          ].join('\n'),
          inline: false
        },
        {
          name: '📢 Broadcasting',
          value: [
            `\`${this.commandPrefix} broadcast <message>\` - Send broadcast to all users`,
            `\`${this.commandPrefix} broadcast-role <role> <message>\` - Send to specific role`
          ].join('\n'),
          inline: false
        },
        {
          name: '⚙️ System Commands',
          value: [
            `\`${this.commandPrefix} stats\` - Get system statistics`,
            `\`${this.commandPrefix} health\` - Get server health`,
            `\`${this.commandPrefix} help\` - Show this help message`
          ].join('\n'),
          inline: false
        },
        {
          name: '💡 Examples',
          value: [
            `\`${this.commandPrefix} frames pending\``,
            `\`${this.commandPrefix} approve 674a1234567890abcdef1234\``,
            `\`${this.commandPrefix} ban baduser 7d Spam violation\``,
            `\`${this.commandPrefix} broadcast Hello everyone! New features are live!\``
          ].join('\n'),
          inline: false
        }
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: this.webhookInfo?.name ? `${this.webhookInfo.name} • Admin Command Center` : 'Snaplove Admin Command Center',
        icon_url: this.webhookInfo?.avatar 
          ? `https://cdn.discordapp.com/avatars/${this.webhookInfo.id}/${this.webhookInfo.avatar}.png?size=16`
          : undefined
      }
    };

    return await this.sendMessage(null, [embed]);
  }

  generateSessionToken(discordUserId) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + (5 * 60 * 1000);
    
    this.sessionTokens.set(token, {
      discordUserId,
      expiresAt
    });

    setTimeout(() => {
      this.sessionTokens.delete(token);
    }, 5 * 60 * 1000);

    return token;
  }

  validateSessionToken(token) {
    const session = this.sessionTokens.get(token);
    if (!session) return null;
    
    if (Date.now() > session.expiresAt) {
      this.sessionTokens.delete(token);
      return null;
    }

    return session;
  }

  isAuthorizedAdmin(discordUserId) {
    return this.allowedUserIds.includes(discordUserId);
  }

  parseCommand(content) {
    if (!content.startsWith(this.commandPrefix)) return null;

    const args = content.slice(this.commandPrefix.length).trim().split(/\s+/);
    const command = args.shift()?.toLowerCase();

    return { command, args };
  }

  formatUserInfo(user) {
    return [
      { name: 'ID', value: user.id, inline: true },
      { name: 'Username', value: `@${user.username}`, inline: true },
      { name: 'Role', value: user.role, inline: true },
      { name: 'Ban Status', value: user.ban_status ? '🔴 Banned' : '🟢 Active', inline: true },
      { name: 'Member Since', value: new Date(user.created_at).toLocaleDateString(), inline: true }
    ];
  }

  formatFrameInfo(frame) {
    return [
      { name: 'ID', value: frame.id, inline: true },
      { name: 'Title', value: frame.title, inline: true },
      { name: 'Status', value: frame.approval_status, inline: true },
      { name: 'Creator', value: `@${frame.user?.username || 'Unknown'}`, inline: true },
      { name: 'Likes/Uses', value: `${frame.total_likes || 0}/${frame.total_uses || 0}`, inline: true },
      { name: 'Created', value: new Date(frame.created_at).toLocaleDateString(), inline: true }
    ];
  }

  formatTicketInfo(ticket) {
    return [
      { name: 'ID', value: ticket.id, inline: true },
      { name: 'Type', value: ticket.type || 'N/A', inline: true },
      { name: 'Status', value: ticket.status, inline: true },
      { name: 'Priority', value: ticket.priority || 'medium', inline: true },
      { name: 'User', value: `@${ticket.user?.username || 'Unknown'}`, inline: true },
      { name: 'Created', value: new Date(ticket.created_at).toLocaleDateString(), inline: true }
    ];
  }

  getHelpMessage() {
    return `
**🔧 Snaplove Admin Commands**

**Frame Management:**
\`${this.commandPrefix} frames [status]\` - List frames (pending/approved/rejected)
\`${this.commandPrefix} approve <frame_id> [reason]\` - Approve frame
\`${this.commandPrefix} reject <frame_id> <reason>\` - Reject frame
\`${this.commandPrefix} frame <frame_id>\` - Get frame details

**User Management:**
\`${this.commandPrefix} users [role]\` - List users by role
\`${this.commandPrefix} user <username>\` - Get user details
\`${this.commandPrefix} ban <username> [duration] [reason]\` - Ban user
\`${this.commandPrefix} unban <username>\` - Unban user
\`${this.commandPrefix} role <username> <role>\` - Change user role

**Reports & Tickets:**
\`${this.commandPrefix} reports [status]\` - List reports
\`${this.commandPrefix} tickets [status]\` - List tickets
\`${this.commandPrefix} report <report_id>\` - Get report details
\`${this.commandPrefix} ticket <ticket_id>\` - Get ticket details

**Broadcast:**
\`${this.commandPrefix} broadcast <message>\` - Send broadcast to all users
\`${this.commandPrefix} broadcast-role <role> <message>\` - Send to specific role

**System:**
\`${this.commandPrefix} stats\` - Get system statistics
\`${this.commandPrefix} health\` - Get server health
\`${this.commandPrefix} help\` - Show this help message

**Examples:**
\`${this.commandPrefix} frames pending\`
\`${this.commandPrefix} approve 674a1234567890abcdef1234\`
\`${this.commandPrefix} ban baduser 7d Spam violation\`
\`${this.commandPrefix} broadcast Hello everyone! New features are live!\`
    `;
  }
}

module.exports = new DiscordHookHandler();