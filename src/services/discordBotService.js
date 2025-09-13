const { Client, GatewayIntentBits, EmbedBuilder, _ActionRowBuilder, _ButtonBuilder, _ButtonStyle } = require('discord.js');
const axios = require('axios');

class DiscordBotService {
  constructor() {
    this.client = null;
    this.channelId = process.env.DISCORD_CHANNEL_ID;
    this.adminIds = (process.env.DISCORD_ADMIN_IDS || '').split(',').filter(Boolean);
    this.baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://api.snaplove.pics' 
      : 'http://localhost:4000';
    this.commandPrefix = '!snap';
    this.isReady = false;
  }

  async start() {
    if (!process.env.DISCORD_BOT_TOKEN) {
      console.log('⚠️ DISCORD_BOT_TOKEN not provided - Discord bot disabled');
      return;
    }

    try {
      this.client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent
        ]
      });

      this.setupEventHandlers();
      await this.client.login(process.env.DISCORD_BOT_TOKEN);
      
    } catch (error) {
      console.error('❌ Discord bot failed to start:', error.message);
    }
  }

  setupEventHandlers() {
    this.client.on('ready', () => {
      console.log(`🤖 Discord bot logged in as ${this.client.user.tag}`);
      this.isReady = true;
      this.sendStartupNotification();
    });

    this.client.on('messageCreate', async (message) => {

      if (message.author.bot) return;

      if (!message.content.startsWith(this.commandPrefix)) return;

      if (!this.isAuthorizedAdmin(message.author.id)) {
        await message.reply({
          embeds: [this.createErrorEmbed('❌ Unauthorized', 'You are not authorized to use admin commands.')]
        });
        return;
      }

      if (this.channelId && message.channel.id !== this.channelId) {
        await message.reply({
          embeds: [this.createErrorEmbed('❌ Wrong Channel', `Commands only allowed in <#${this.channelId}>`)]
        });
        return;
      }

      await this.processCommand(message);
    });

    this.client.on('error', (error) => {
      console.error('🚨 Discord bot error:', error);
    });

    this.client.on('disconnect', () => {
      console.log('🔌 Discord bot disconnected');
      this.isReady = false;
    });
  }

  async processCommand(message) {
    const args = message.content.slice(this.commandPrefix.length).trim().split(/\s+/);
    const command = args.shift()?.toLowerCase();

    await message.channel.sendTyping();

    try {
      switch (command) {
        case 'help':
          await this.handleHelp(message);
          break;
        case 'stats':
          await this.handleStats(message);
          break;
        case 'frames':
          await this.handleFrames(message, args);
          break;
        case 'approve':
          await this.handleApprove(message, args);
          break;
        case 'reject':
          await this.handleReject(message, args);
          break;
        case 'users':
          await this.handleUsers(message, args);
          break;
        case 'ban':
          await this.handleBan(message, args);
          break;
        case 'unban':
          await this.handleUnban(message, args);
          break;
        case 'broadcast':
          await this.handleBroadcast(message, args);
          break;
        case 'reports':
          await this.handleReports(message, args);
          break;
        case 'tickets':
          await this.handleTickets(message, args);
          break;
        case 'health':
          await this.handleHealth(message);
          break;
        default:
          await message.reply({
            embeds: [this.createErrorEmbed('❌ Unknown Command', `Unknown command: \`${command}\`\nUse \`${this.commandPrefix} help\` for available commands.`)]
          });
      }
    } catch (error) {
      console.error('Command processing error:', error);
      await message.reply({
        embeds: [this.createErrorEmbed('❌ Command Failed', `Error: ${error.message}`)]
      });
    }
  }

  async makeApiRequest(endpoint, method = 'GET', data = null) {
    try {
      const config = {
        method,
        url: `${this.baseUrl}${endpoint}`,
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.API_KEYS && { 'X-API-Key': process.env.API_KEYS.split(',')[0] })
        },
        ...(data && { data })
      };

      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error('API request failed:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'API request failed');
    }
  }

  async handleHelp(message) {
    const embed = new EmbedBuilder()
      .setTitle('🔧 Snaplove Admin Commands')
      .setDescription('Available Discord bot commands for admins')
      .setColor(0x7289da)
      .addFields(
        { name: '📊 General', value: '`!snap stats` - System statistics\n`!snap health` - Server health check\n`!snap help` - This help message' },
        { name: '🖼️ Frame Management', value: '`!snap frames [status]` - List frames\n`!snap approve <id>` - Approve frame\n`!snap reject <id> <reason>` - Reject frame' },
        { name: '👥 User Management', value: '`!snap users [role]` - List users\n`!snap ban <username> [duration] [reason]` - Ban user\n`!snap unban <username>` - Unban user' },
        { name: '📢 Broadcasting', value: '`!snap broadcast <message>` - Send announcement to all users' },
        { name: '📋 Reports & Tickets', value: '`!snap reports [status]` - List reports\n`!snap tickets [status]` - List tickets' }
      )
      .setFooter({ text: 'Use commands responsibly • Snaplove Admin Bot' })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  }

  async handleStats(message) {
    try {
      const health = await this.makeApiRequest('/health');
      
      const embed = new EmbedBuilder()
        .setTitle('📊 System Statistics')
        .setColor(0x00ff00)
        .addFields(
          { name: '👥 Users', value: health.statistics.active_users.toString(), inline: true },
          { name: '🖼️ Frames', value: health.statistics.public_frames.toString(), inline: true },
          { name: '📸 Photos', value: health.statistics.total_photos.toString(), inline: true },
          { name: '📈 New Users (24h)', value: health.statistics.recent_activity.new_users_24h.toString(), inline: true },
          { name: '📈 New Frames (24h)', value: health.statistics.recent_activity.new_frames_24h.toString(), inline: true },
          { name: '💾 Memory Usage', value: `${health.performance.memory_usage_mb}MB`, inline: true },
          { name: '⏱️ Uptime', value: health.uptime.formatted, inline: true },
          { name: '🗄️ Database', value: health.database.status, inline: true },
          { name: '🏥 Health', value: health.status, inline: true }
        )
        .setFooter({ text: `Environment: ${health.environment} • v${health.version}` })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (error) {
      await message.reply({
        embeds: [this.createErrorEmbed('❌ Stats Failed', error.message)]
      });
    }
  }

  async handleFrames(message, args) {
    try {
      const status = args[0] || 'pending';
      const limit = Math.min(parseInt(args[1]) || 10, 25);

      const frames = await this.makeApiRequest(`/api/admin/framePublicApproval?status=${status}&limit=${limit}`);
      
      if (frames.data.frames.length === 0) {
        await message.reply({
          embeds: [this.createInfoEmbed('📂 No Frames', `No ${status} frames found.`)]
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`🖼️ Frames (${status})`)
        .setDescription(`Found ${frames.data.frames.length} frames`)
        .setColor(0x3498db);

      frames.data.frames.slice(0, 10).forEach((frame, index) => {
        embed.addFields({
          name: `${index + 1}. ${frame.title}`,
          value: `**ID:** \`${frame.id}\`\n**By:** @${frame.user.username}\n**Status:** ${frame.approval_status}\n**Likes:** ${frame.total_likes}`,
          inline: false
        });
      });

      await message.reply({ embeds: [embed] });
    } catch (error) {
      await message.reply({
        embeds: [this.createErrorEmbed('❌ Frames Failed', error.message)]
      });
    }
  }

  async handleApprove(message, args) {
    if (!args[0]) {
      await message.reply({
        embeds: [this.createErrorEmbed('❌ Missing Frame ID', 'Usage: `!snap approve <frame_id>`')]
      });
      return;
    }

    try {
      const frameId = args[0];
      const _result = await this.makeApiRequest(`/api/admin/framePublicApproval/${frameId}`, 'PUT', {
        approval_status: 'approved'
      });

      await message.reply({
        embeds: [this.createSuccessEmbed('✅ Frame Approved', `Frame \`${frameId}\` has been approved successfully!`)]
      });

    } catch (error) {
      await message.reply({
        embeds: [this.createErrorEmbed('❌ Approval Failed', error.message)]
      });
    }
  }

  async handleReject(message, args) {
    if (!args[0] || !args[1]) {
      await message.reply({
        embeds: [this.createErrorEmbed('❌ Missing Parameters', 'Usage: `!snap reject <frame_id> <reason>`')]
      });
      return;
    }

    try {
      const frameId = args[0];
      const reason = args.slice(1).join(' ');
      
      const _result = await this.makeApiRequest(`/api/admin/framePublicApproval/${frameId}`, 'PUT', {
        approval_status: 'rejected',
        rejection_reason: reason
      });

      await message.reply({
        embeds: [this.createSuccessEmbed('❌ Frame Rejected', `Frame \`${frameId}\` has been rejected.\n**Reason:** ${reason}`)]
      });

    } catch (error) {
      await message.reply({
        embeds: [this.createErrorEmbed('❌ Rejection Failed', error.message)]
      });
    }
  }

  async handleBroadcast(message, args) {
    if (!args[0]) {
      await message.reply({
        embeds: [this.createErrorEmbed('❌ Missing Message', 'Usage: `!snap broadcast <message>`')]
      });
      return;
    }

    try {
      const broadcastMessage = args.join(' ');
      if (broadcastMessage.length > 500) {
        await message.reply({
          embeds: [this.createErrorEmbed('❌ Message Too Long', 'Broadcast message must be 500 characters or less.')]
        });
        return;
      }

      const result = await this.makeApiRequest('/api/admin/broadcast', 'POST', {
        title: '📢 Discord Broadcast',
        message: broadcastMessage,
        type: 'announcement',
        priority: 'medium',
        target_audience: 'all',
        send_immediately: true
      });

      await message.reply({
        embeds: [this.createSuccessEmbed('📢 Broadcast Sent', `Message sent to ${result.data.delivery_stats?.total_recipients || 'all'} users!`)]
      });

    } catch (error) {
      await message.reply({
        embeds: [this.createErrorEmbed('❌ Broadcast Failed', error.message)]
      });
    }
  }

  async handleHealth(message) {
    try {
      const health = await this.makeApiRequest('/health');
      
      const statusColor = health.status === 'healthy' ? 0x00ff00 : 0xff9900;
      const statusEmoji = health.status === 'healthy' ? '🟢' : '🟡';
      
      const embed = new EmbedBuilder()
        .setTitle(`${statusEmoji} Server Health Check`)
        .setDescription(`Status: **${health.status.toUpperCase()}**`)
        .setColor(statusColor)
        .addFields(
          { name: '🗄️ Database', value: health.health_checks.database, inline: true },
          { name: '⚡ Response Time', value: health.health_checks.response_time, inline: true },
          { name: '💾 Memory', value: health.health_checks.memory, inline: true },
          { name: '⏱️ Uptime', value: health.uptime.formatted, inline: true },
          { name: '🌐 Environment', value: health.environment, inline: true },
          { name: '📦 Version', value: health.version, inline: true }
        )
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (error) {
      await message.reply({
        embeds: [this.createErrorEmbed('❌ Health Check Failed', 'Could not retrieve server health information.')]
      });
    }
  }

  isAuthorizedAdmin(userId) {
    return this.adminIds.includes(userId);
  }

  createSuccessEmbed(title, description) {
    return new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(0x00ff00)
      .setTimestamp();
  }

  createErrorEmbed(title, description) {
    return new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(0xff0000)
      .setTimestamp();
  }

  createInfoEmbed(title, description) {
    return new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(0x3498db)
      .setTimestamp();
  }

  async sendStartupNotification() {
    if (!this.isReady || !this.channelId) return;

    try {
      const channel = await this.client.channels.fetch(this.channelId);
      const embed = new EmbedBuilder()
        .setTitle('🚀 Snaplove Admin Bot Online')
        .setDescription('Discord admin bot is now online and ready to receive commands!')
        .setColor(0x00ff00)
        .addFields(
          { name: '🔧 Commands', value: `Use \`${this.commandPrefix} help\` to see all available commands` },
          { name: '👥 Authorized Admins', value: this.adminIds.length.toString(), inline: true },
          { name: '🌐 Environment', value: process.env.NODE_ENV, inline: true }
        )
        .setTimestamp();

      await channel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Failed to send startup notification:', error);
    }
  }

  async stop() {
    if (this.client) {
      await this.client.destroy();
      this.isReady = false;
      console.log('🤖 Discord bot stopped');
    }
  }

  async sendNotification(title, description, color = 0x7289da, fields = []) {
    if (!this.isReady || !this.channelId) return false;

    try {
      const channel = await this.client.channels.fetch(this.channelId);
      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setTimestamp();

      if (fields.length > 0) {
        embed.addFields(fields);
      }

      await channel.send({ embeds: [embed] });
      return true;
    } catch (error) {
      console.error('Failed to send Discord notification:', error);
      return false;
    }
  }
}

module.exports = new DiscordBotService();