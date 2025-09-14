const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes } = require('discord.js');
const axios = require('axios');

class DiscordBotService {
  constructor() {
    this.client = null;
    this.channelId = process.env.DISCORD_CHANNEL_ID;
    this.adminIds = (process.env.DISCORD_ADMIN_IDS || '').split(',').filter(Boolean);
    this.baseUrl = process.env.NODE_ENV === 'production' 
      ? 'http://localhost:4000' 
      : 'http://localhost:4000';
    this.commandPrefix = '!snap'; 
    this.isReady = false;
    this.commands = new Map();
    this.rest = null;
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


      this.rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

      this.setupSlashCommands();
      this.setupEventHandlers();
      await this.client.login(process.env.DISCORD_BOT_TOKEN);
      
    } catch (error) {
      console.error('❌ Discord bot failed to start:', error.message);
    }
  }

  setupSlashCommands() {

    const commands = [
      new SlashCommandBuilder()
        .setName('help')
        .setDescription('Show all available admin commands'),

      new SlashCommandBuilder()
        .setName('test')
        .setDescription('Test bot functionality and permissions'),

      new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Get system statistics'),

      new SlashCommandBuilder()
        .setName('health')
        .setDescription('Check server health status'),

      new SlashCommandBuilder()
        .setName('frames')
        .setDescription('List frames by status')
        .addStringOption(option =>
          option.setName('status')
            .setDescription('Filter by frame status')
            .setRequired(false)
            .addChoices(
              { name: 'Pending', value: 'pending' },
              { name: 'Approved', value: 'approved' },
              { name: 'Rejected', value: 'rejected' },
              { name: 'All', value: 'all' }
            ))
        .addIntegerOption(option =>
          option.setName('limit')
            .setDescription('Number of frames to show (1-25)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(25)),

      new SlashCommandBuilder()
        .setName('approve')
        .setDescription('Approve a frame')
        .addStringOption(option =>
          option.setName('frame_id')
            .setDescription('Frame ID to approve')
            .setRequired(true)),

      new SlashCommandBuilder()
        .setName('reject')
        .setDescription('Reject a frame')
        .addStringOption(option =>
          option.setName('frame_id')
            .setDescription('Frame ID to reject')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('reason')
            .setDescription('Reason for rejection')
            .setRequired(true)
            .setMaxLength(500)),

      new SlashCommandBuilder()
        .setName('users')
        .setDescription('List users by role')
        .addStringOption(option =>
          option.setName('role')
            .setDescription('Filter by user role')
            .setRequired(false)
            .addChoices(
              { name: 'Basic', value: 'basic' },
              { name: 'Verified Basic', value: 'verified_basic' },
              { name: 'Verified Premium', value: 'verified_premium' },
              { name: 'Official', value: 'official' },
              { name: 'Developer', value: 'developer' }
            ))
        .addIntegerOption(option =>
          option.setName('limit')
            .setDescription('Number of users to show (1-25)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(25)),

      new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a user')
        .addStringOption(option =>
          option.setName('username')
            .setDescription('Username to ban')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('duration')
            .setDescription('Ban duration (e.g., 7d, 24h, 30m) - leave empty for permanent')
            .setRequired(false))
        .addStringOption(option =>
          option.setName('reason')
            .setDescription('Reason for ban')
            .setRequired(false)
            .setMaxLength(500)),

      new SlashCommandBuilder()
        .setName('broadcast')
        .setDescription('Send broadcast message to all users')
        .addStringOption(option =>
          option.setName('message')
            .setDescription('Broadcast message content')
            .setRequired(true)
            .setMaxLength(500))
        .addStringOption(option =>
          option.setName('audience')
            .setDescription('Target audience')
            .setRequired(false)
            .addChoices(
              { name: 'All Users', value: 'all' },
              { name: 'Verified Users', value: 'verified' },
              { name: 'Premium Users', value: 'premium' },
              { name: 'Basic Users', value: 'basic' }
            ))
        .addStringOption(option =>
          option.setName('type')
            .setDescription('Broadcast type')
            .setRequired(false)
            .addChoices(
              { name: 'Announcement', value: 'announcement' },
              { name: 'Maintenance', value: 'maintenance' },
              { name: 'Update', value: 'update' },
              { name: 'Alert', value: 'alert' }
            )),

      new SlashCommandBuilder()
        .setName('reports')
        .setDescription('List content reports')
        .addStringOption(option =>
          option.setName('status')
            .setDescription('Filter by report status')
            .setRequired(false)
            .addChoices(
              { name: 'Pending', value: 'pending' },
              { name: 'Done', value: 'done' },
              { name: 'Rejected', value: 'rejected' }
            )),

      new SlashCommandBuilder()
        .setName('tickets')
        .setDescription('List support tickets')
        .addStringOption(option =>
          option.setName('status')
            .setDescription('Filter by ticket status')
            .setRequired(false)
            .addChoices(
              { name: 'Pending', value: 'pending' },
              { name: 'In Progress', value: 'in_progress' },
              { name: 'Resolved', value: 'resolved' },
              { name: 'Closed', value: 'closed' }
            ))
        .addStringOption(option =>
          option.setName('priority')
            .setDescription('Filter by priority')
            .setRequired(false)
            .addChoices(
              { name: 'Urgent', value: 'urgent' },
              { name: 'High', value: 'high' },
              { name: 'Medium', value: 'medium' },
              { name: 'Low', value: 'low' }
            ))
    ];


    commands.forEach(command => {
      this.commands.set(command.name, command);
    });

    return commands.map(command => command.toJSON());
  }

  async registerSlashCommands() {
    try {
      console.log('🔄 Started refreshing application (/) commands.');

      const commands = this.setupSlashCommands();
      

      if (process.env.DISCORD_GUILD_ID) {

        await this.rest.put(
          Routes.applicationGuildCommands(this.client.user.id, process.env.DISCORD_GUILD_ID),
          { body: commands }
        );
        console.log(`✅ Successfully reloaded ${commands.length} guild application (/) commands.`);
      } else {

        await this.rest.put(
          Routes.applicationCommands(this.client.user.id),
          { body: commands }
        );
        console.log(`✅ Successfully reloaded ${commands.length} global application (/) commands.`);
      }
    } catch (error) {
      console.error('❌ Error registering slash commands:', error);
    }
  }

  setupEventHandlers() {

    this.client.on('clientReady', async () => {
      console.log(`🤖 Discord bot logged in as ${this.client.user.tag}`);
      this.isReady = true;
      

      await this.registerSlashCommands();
      

      this.sendStartupNotification();
    });


    this.client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;


      if (!this.isAuthorizedAdmin(interaction.user.id)) {
        await interaction.reply({
          embeds: [this.createErrorEmbed('❌ Unauthorized', 'You are not authorized to use admin commands.')],
          ephemeral: true 
        });
        return;
      }


      if (this.channelId && interaction.channel.id !== this.channelId) {
        await interaction.reply({
          embeds: [this.createErrorEmbed('❌ Wrong Channel', `Commands only allowed in <#${this.channelId}>`)],
          ephemeral: true
        });
        return;
      }

      await this.processSlashCommand(interaction);
    });


    this.client.on('messageCreate', async (message) => {

      if (message.author.bot) return;


      if (!message.content.startsWith(this.commandPrefix)) return;


      if (this.isAuthorizedAdmin(message.author.id)) {
        await message.reply({
          embeds: [this.createInfoEmbed(
            '⚡ Slash Commands Available!', 
            `This bot now uses Discord slash commands! Type \`/\` to see all available commands.\n\nOld-style \`${this.commandPrefix}\` commands are deprecated.`
          )]
        });
      }
    });

    this.client.on('error', (error) => {
      console.error('🚨 Discord bot error:', error);
    });

    this.client.on('disconnect', () => {
      console.log('🔌 Discord bot disconnected');
      this.isReady = false;
    });
  }

  async processSlashCommand(interaction) {
    const { commandName, options } = interaction;


    await interaction.deferReply();

    try {
      switch (commandName) {
        case 'help':
          await this.handleHelp(interaction);
          break;
        case 'test':
          await this.handleTest(interaction);
          break;
        case 'stats':
          await this.handleStats(interaction);
          break;
        case 'health':
          await this.handleHealth(interaction);
          break;
        case 'frames':
          await this.handleFrames(interaction, {
            status: options.getString('status') || 'pending',
            limit: options.getInteger('limit') || 10
          });
          break;
        case 'approve':
          await this.handleApprove(interaction, {
            frameId: options.getString('frame_id')
          });
          break;
        case 'reject':
          await this.handleReject(interaction, {
            frameId: options.getString('frame_id'),
            reason: options.getString('reason')
          });
          break;
        case 'users':
          await this.handleUsers(interaction, {
            role: options.getString('role'),
            limit: options.getInteger('limit') || 10
          });
          break;
        case 'ban':
          await this.handleBan(interaction, {
            username: options.getString('username'),
            duration: options.getString('duration'),
            reason: options.getString('reason')
          });
          break;
        case 'broadcast':
          await this.handleBroadcast(interaction, {
            message: options.getString('message'),
            audience: options.getString('audience') || 'all',
            type: options.getString('type') || 'announcement'
          });
          break;
        case 'reports':
          await this.handleReports(interaction, {
            status: options.getString('status')
          });
          break;
        case 'tickets':
          await this.handleTickets(interaction, {
            status: options.getString('status'),
            priority: options.getString('priority')
          });
          break;
        default:
          await interaction.editReply({
            embeds: [this.createErrorEmbed('❌ Unknown Command', `Unknown command: \`${commandName}\``)]
          });
      }
    } catch (error) {
      console.error('Slash command processing error:', error);
      
      const errorEmbed = this.createErrorEmbed('❌ Command Failed', `Error: ${error.message}`);
      
      if (interaction.deferred) {
        await interaction.editReply({ embeds: [errorEmbed] });
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }
  }

  async sendStartupNotification() {
    if (!this.isReady) {
      console.log('⚠️ Bot not ready, skipping startup notification');
      return;
    }

    if (!this.channelId) {
      console.log('⚠️ No channel ID configured, skipping startup notification');
      return;
    }

    try {
      const channel = await this.client.channels.fetch(this.channelId).catch(error => {
        console.error(`❌ Cannot access channel ${this.channelId}:`, error.message);
        console.log('💡 Possible issues:');
        console.log('   1. Bot is not in the server');
        console.log('   2. Bot lacks "View Channel" permission');
        console.log('   3. Channel ID is incorrect');
        console.log('   4. Bot lacks "Send Messages" permission');
        return null;
      });

      if (!channel) {
        console.log('❌ Failed to fetch channel for startup notification');
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('🚀 Snaplove Admin Bot Online')
        .setDescription('Discord admin bot is now online with **Slash Commands**!')
        .setColor(0x00ff00)
        .addFields(
          { name: '⚡ New Feature', value: 'Now using Discord **Slash Commands**! Type `/` to see all commands.', inline: false },
          { name: '🔧 Available Commands', value: `Use \`/help\` to see all available commands`, inline: true },
          { name: '👥 Authorized Admins', value: this.adminIds.length.toString(), inline: true },
          { name: '🌐 Environment', value: process.env.NODE_ENV || 'unknown', inline: true },
          { name: '📡 Channel', value: `<#${this.channelId}>`, inline: true },
          { name: '📝 Quick Start', value: 'Try `/test` to verify your permissions!', inline: false }
        )
        .setTimestamp();

      await channel.send({ embeds: [embed] });
      console.log('✅ Discord startup notification sent successfully');
    } catch (error) {
      console.error('❌ Failed to send startup notification:', error.message);
      
      if (error.code === 50001) {
        console.log('💡 Discord Error 50001 - Missing Access. Check:');
        console.log('   1. Bot is invited to the server');
        console.log('   2. Bot has "View Channel" permission'); 
        console.log('   3. Bot has "Send Messages" permission');
        console.log('   4. Channel ID is correct');
      } else if (error.code === 50013) {
        console.log('💡 Discord Error 50013 - Missing Permissions. Bot needs:');
        console.log('   1. "Send Messages" permission');
        console.log('   2. "Embed Links" permission');
        console.log('   3. "Use Slash Commands" permission');
      }
    }
  }


  async handleTest(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('🧪 Bot Test')
      .setDescription('Bot is working correctly with slash commands!')
      .setColor(0x00ff00)
      .addFields(
        { name: '🤖 Bot User', value: this.client.user.tag, inline: true },
        { name: '📡 Channel', value: `<#${interaction.channel.id}>`, inline: true },
        { name: '👤 User', value: `<@${interaction.user.id}>`, inline: true },
        { name: '🏠 Guild', value: interaction.guild?.name || 'DM', inline: true },
        { name: '🔐 Admin Access', value: this.isAuthorizedAdmin(interaction.user.id) ? '✅ Yes' : '❌ No', inline: true },
        { name: '🌐 Environment', value: process.env.NODE_ENV || 'unknown', inline: true },
        { name: '⚡ Command Type', value: 'Slash Command', inline: true },
        { name: '🆔 Command ID', value: interaction.id, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  async handleHelp(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('🔧 Snaplove Admin Slash Commands')
      .setDescription('Available Discord slash commands for admins')
      .setColor(0x7289da)
      .addFields(
        { 
          name: '📊 General', 
          value: '`/stats` - System statistics\n`/health` - Server health check\n`/test` - Test bot functionality\n`/help` - This help message',
          inline: false 
        },
        { 
          name: '🖼️ Frame Management', 
          value: '`/frames [status] [limit]` - List frames\n`/approve <frame_id>` - Approve frame\n`/reject <frame_id> <reason>` - Reject frame',
          inline: false 
        },
        { 
          name: '👥 User Management', 
          value: '`/users [role] [limit]` - List users\n`/ban <username> [duration] [reason]` - Ban user',
          inline: false 
        },
        { 
          name: '📢 Broadcasting', 
          value: '`/broadcast <message> [audience] [type]` - Send announcement',
          inline: false 
        },
        { 
          name: '📋 Reports & Tickets', 
          value: '`/reports [status]` - List reports\n`/tickets [status] [priority]` - List tickets',
          inline: false 
        },
        {
          name: '⚡ Slash Command Benefits',
          value: '• Auto-completion\n• Parameter validation\n• Better user experience\n• Native Discord integration',
          inline: false
        }
      )
      .setFooter({ text: 'Use slash commands responsibly • Snaplove Admin Bot' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  async handleStats(interaction) {
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

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({
        embeds: [this.createErrorEmbed('❌ Stats Failed', error.message)]
      });
    }
  }

  async handleFrames(interaction, options) {
    try {
      const { status, limit } = options;
      const frames = await this.makeApiRequest(`/api/admin/framePublicApproval?status=${status}&limit=${limit}`);
      
      if (frames.data.frames.length === 0) {
        await interaction.editReply({
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

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({
        embeds: [this.createErrorEmbed('❌ Frames Failed', error.message)]
      });
    }
  }

  async handleApprove(interaction, options) {
    try {
      const { frameId } = options;
      const _result = await this.makeApiRequest(`/api/admin/framePublicApproval/${frameId}`, 'PUT', {
        approval_status: 'approved'
      });

      await interaction.editReply({
        embeds: [this.createSuccessEmbed('✅ Frame Approved', `Frame \`${frameId}\` has been approved successfully!`)]
      });

    } catch (error) {
      await interaction.editReply({
        embeds: [this.createErrorEmbed('❌ Approval Failed', error.message)]
      });
    }
  }

  async handleReject(interaction, options) {
    try {
      const { frameId, reason } = options;
      
      const _result = await this.makeApiRequest(`/api/admin/framePublicApproval/${frameId}`, 'PUT', {
        approval_status: 'rejected',
        rejection_reason: reason
      });

      await interaction.editReply({
        embeds: [this.createSuccessEmbed('❌ Frame Rejected', `Frame \`${frameId}\` has been rejected.\n**Reason:** ${reason}`)]
      });

    } catch (error) {
      await interaction.editReply({
        embeds: [this.createErrorEmbed('❌ Rejection Failed', error.message)]
      });
    }
  }

  async handleUsers(interaction, _options) {
    await interaction.editReply({
      embeds: [this.createErrorEmbed('🚧 Not Implemented', 'User management commands are not yet implemented via Discord bot. Use the admin panel.')]
    });
  }

  async handleBan(interaction, _options) {
    await interaction.editReply({
      embeds: [this.createErrorEmbed('🚧 Not Implemented', 'Ban commands are not yet implemented via Discord bot. Use the admin panel.')]
    });
  }

  async handleBroadcast(interaction, options) {
    try {
      const { message, audience, type } = options;

      const result = await this.makeApiRequest('/api/admin/broadcast', 'POST', {
        title: '📢 Discord Broadcast',
        message,
        type,
        priority: 'medium',
        target_audience: audience,
        send_immediately: true
      });

      await interaction.editReply({
        embeds: [this.createSuccessEmbed('📢 Broadcast Sent', `Message sent to ${result.data.delivery_stats?.total_recipients || 'all'} users!\n\n**Message:** ${message}`)]
      });

    } catch (error) {
      await interaction.editReply({
        embeds: [this.createErrorEmbed('❌ Broadcast Failed', error.message)]
      });
    }
  }

  async handleHealth(interaction) {
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

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({
        embeds: [this.createErrorEmbed('❌ Health Check Failed', 'Could not retrieve server health information.')]
      });
    }
  }

  async handleReports(interaction, _options) {
    await interaction.editReply({
      embeds: [this.createErrorEmbed('🚧 Not Implemented', 'Report management commands are not yet implemented via Discord bot. Use the admin panel.')]
    });
  }

  async handleTickets(interaction, _options) {
    await interaction.editReply({
      embeds: [this.createErrorEmbed('🚧 Not Implemented', 'Ticket management commands are not yet implemented via Discord bot. Use the admin panel.')]
    });
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