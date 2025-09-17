const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes } = require('discord.js');
const axios = require('axios');

class DiscordBotService {
  constructor() {
    this.client = null;
    this.channelId = process.env.DISCORD_CHANNEL_ID;
    this.adminIds = (process.env.DISCORD_ADMIN_IDS || '').split(',').filter(Boolean);

    this.baseUrl = 'http://127.0.0.1:4000';

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
        .setName('user')
        .setDescription('Get detailed user information')
        .addStringOption(option =>
          option.setName('username')
            .setDescription('Username to lookup')
            .setRequired(true)),

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
        .setName('unban')
        .setDescription('Unban a user')
        .addStringOption(option =>
          option.setName('username')
            .setDescription('Username to unban')
            .setRequired(true)),

      new SlashCommandBuilder()
        .setName('role')
        .setDescription('Change user role')
        .addStringOption(option =>
          option.setName('username')
            .setDescription('Username to update')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('new_role')
            .setDescription('New role to assign')
            .setRequired(true)
            .addChoices(
              { name: 'Basic', value: 'basic' },
              { name: 'Verified Basic', value: 'verified_basic' },
              { name: 'Verified Premium', value: 'verified_premium' },
              { name: 'Official', value: 'official' },
              { name: 'Developer', value: 'developer' }
            )),

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
            ))
        .addIntegerOption(option =>
          option.setName('limit')
            .setDescription('Number of reports to show (1-25)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(25)),

      new SlashCommandBuilder()
        .setName('report')
        .setDescription('Get detailed report information')
        .addStringOption(option =>
          option.setName('report_id')
            .setDescription('Report ID to lookup')
            .setRequired(true)),

      new SlashCommandBuilder()
        .setName('resolve-report')
        .setDescription('Resolve a report')
        .addStringOption(option =>
          option.setName('report_id')
            .setDescription('Report ID to resolve')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('action')
            .setDescription('Action to take')
            .setRequired(true)
            .addChoices(
              { name: 'Mark as Done', value: 'done' },
              { name: 'Delete Frame', value: 'delete_frame' },
              { name: 'Reject Report', value: 'rejected' }
            ))
        .addStringOption(option =>
          option.setName('response')
            .setDescription('Admin response/reason')
            .setRequired(false)
            .setMaxLength(500)),

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
        .addIntegerOption(option =>
          option.setName('limit')
            .setDescription('Number of tickets to show (1-25)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(25)),

      new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Get detailed ticket information')
        .addStringOption(option =>
          option.setName('ticket_id')
            .setDescription('Ticket ID to lookup')
            .setRequired(true)),

      new SlashCommandBuilder()
        .setName('resolve-ticket')
        .setDescription('Update ticket status and respond')
        .addStringOption(option =>
          option.setName('ticket_id')
            .setDescription('Ticket ID to update')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('status')
            .setDescription('New ticket status')
            .setRequired(true)
            .addChoices(
              { name: 'In Progress', value: 'in_progress' },
              { name: 'Resolved', value: 'resolved' },
              { name: 'Closed', value: 'closed' }
            ))
        .addStringOption(option =>
          option.setName('response')
            .setDescription('Admin response to user')
            .setRequired(false)
            .setMaxLength(1000))
        .addStringOption(option =>
          option.setName('priority')
            .setDescription('Update priority')
            .setRequired(false)
            .addChoices(
              { name: 'Low', value: 'low' },
              { name: 'Medium', value: 'medium' },
              { name: 'High', value: 'high' },
              { name: 'Urgent', value: 'urgent' }
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

      try {
        await this.testInternalConnection();
        this.sendStartupNotification();
      } catch (error) {
        console.error('❌ Internal connection test failed:', error.message);
      }
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
        case 'user':
          await this.handleUser(interaction, {
            username: options.getString('username')
          });
          break;
        case 'ban':
          await this.handleBan(interaction, {
            username: options.getString('username'),
            duration: options.getString('duration'),
            reason: options.getString('reason')
          });
          break;
        case 'unban':
          await this.handleUnban(interaction, {
            username: options.getString('username')
          });
          break;
        case 'role':
          await this.handleRole(interaction, {
            username: options.getString('username'),
            newRole: options.getString('new_role')
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
            status: options.getString('status'),
            limit: options.getInteger('limit') || 10
          });
          break;
        case 'report':
          await this.handleReport(interaction, {
            reportId: options.getString('report_id')
          });
          break;
        case 'resolve-report':
          await this.handleResolveReport(interaction, {
            reportId: options.getString('report_id'),
            action: options.getString('action'),
            response: options.getString('response')
          });
          break;
        case 'tickets':
          await this.handleTickets(interaction, {
            status: options.getString('status'),
            priority: options.getString('priority'),
            limit: options.getInteger('limit') || 10
          });
          break;
        case 'ticket':
          await this.handleTicket(interaction, {
            ticketId: options.getString('ticket_id')
          });
          break;
        case 'resolve-ticket':
          await this.handleResolveTicket(interaction, {
            ticketId: options.getString('ticket_id'),
            status: options.getString('status'),
            response: options.getString('response'),
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

  async testInternalConnection() {
    try {
      console.log('🔍 Testing internal API connection...');
      const response = await this.makeApiRequest('/health');
      console.log('✅ Internal API connection successful');
      return response;
    } catch (error) {
      console.error('❌ Internal API connection failed:', error.message);
      throw error;
    }
  }

  async makeApiRequest(endpoint, method = 'GET', data = null) {
    const maxRetries = 3;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const config = {
          method,
          url: `${this.baseUrl}${endpoint}`,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'SnaploveDiscordBot/1.0',
            'X-Internal-Request': 'true',
            'X-Discord-Bot': 'true',
            'Connection': 'close'
          },
          timeout: 15000, ...(data && { data })
        };

        console.log(`🤖 Discord Bot Internal API Request (Attempt ${attempt}/${maxRetries}): ${method} ${endpoint}`);
        const response = await axios(config);

        if (attempt > 1) {
          console.log(`✅ Request succeeded on attempt ${attempt}`);
        }

        return response.data;
      } catch (error) {
        lastError = error;

        const isTimeout = error.code === 'ECONNABORTED';
        const isConnectionError = ['ECONNREFUSED', 'ENOTFOUND', 'ECONNRESET'].includes(error.code);

        console.error(`❌ Discord Bot Internal API Request Failed (Attempt ${attempt}/${maxRetries}): ${method} ${endpoint}`, {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message,
          code: error.code,
          timeout: isTimeout,
          connection: isConnectionError
        });

        if (attempt === maxRetries || (!isTimeout && !isConnectionError)) {
          break;
        }

        const delay = Math.pow(2, attempt) * 1000; console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error(lastError?.response?.data?.message || lastError?.message || 'Internal API request failed after retries');
  }

  async makeDiscordApiRequest(endpoint, method = 'GET', data = null, discordUserId = null) {
    try {
      console.log(`🔐 Making Discord authenticated request for user: ${discordUserId}`);

      const authResponse = await this.makeApiRequest('/api/admin/discord/auth', 'POST', {
        discord_user_id: discordUserId,
        discord_username: `Discord-${discordUserId}`
      });

      if (!authResponse.success || !authResponse.data?.token) {
        throw new Error('Failed to get Discord auth token');
      }

      const token = authResponse.data.token;

      const config = {
        method,
        url: `${this.baseUrl}${endpoint}`,
        headers: {
          'Content-Type': 'application/json',
          'X-Discord-Token': token,
          'X-Discord-User': discordUserId,
          'X-Internal-Request': 'true',
          'User-Agent': 'SnaploveDiscordBot/1.0',
          'Connection': 'close'
        },
        timeout: 15000,
        ...(data && { data })
      };

      console.log(`🤖 Discord Authenticated API Request: ${method} ${endpoint} (User: ${discordUserId})`);
      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error(`❌ Discord Authenticated API Request Failed: ${method} ${endpoint}`, {
        user: discordUserId,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
        code: error.code
      });
      throw new Error(error.response?.data?.message || error.message || 'Discord API request failed');
    }
  }

  async sendStartupNotification() {
    if (!this.isReady || !this.channelId) return;

    try {
      const channel = await this.client.channels.fetch(this.channelId);
      const embed = new EmbedBuilder()
        .setTitle('🚀 Snaplove Admin Bot Online')
        .setDescription('Discord admin bot is now online with **Full Admin Commands**!')
        .setColor(0x00ff00)
        .addFields(
          { name: '⚡ Features', value: 'All admin endpoints now available via Discord slash commands!', inline: false },
          { name: '🔧 Commands', value: `Use \`/help\` to see all ${this.commands.size} available commands`, inline: true },
          { name: '👥 Authorized Admins', value: this.adminIds.length.toString(), inline: true },
          { name: '🌐 Environment', value: process.env.NODE_ENV || 'unknown', inline: true },
          { name: '📡 Channel', value: `<#${this.channelId}>`, inline: true },
          { name: '🔗 API Connection', value: '✅ Connected', inline: true },
          { name: '📝 Quick Start', value: 'Try `/test` to verify your permissions!', inline: false }
        )
        .setTimestamp();

      await channel.send({ embeds: [embed] });
      console.log('✅ Discord startup notification sent successfully');
    } catch (error) {
      console.error('❌ Failed to send startup notification:', error.message);
    }
  }

  async handleTest(interaction) {
    try {
      const health = await this.makeApiRequest('/health');

      const embed = new EmbedBuilder()
        .setTitle('🧪 Bot Test')
        .setDescription('Bot is working correctly with full admin commands!')
        .setColor(0x00ff00)
        .addFields(
          { name: '🤖 Bot User', value: this.client.user.tag, inline: true },
          { name: '📡 Channel', value: `<#${interaction.channel.id}>`, inline: true },
          { name: '👤 User', value: `<@${interaction.user.id}>`, inline: true },
          { name: '🏠 Guild', value: interaction.guild?.name || 'DM', inline: true },
          { name: '🔐 Admin Access', value: this.isAuthorizedAdmin(interaction.user.id) ? '✅ Yes' : '❌ No', inline: true },
          { name: '🌐 Environment', value: process.env.NODE_ENV || 'unknown', inline: true },
          { name: '⚡ Command Type', value: 'Slash Command', inline: true },
          { name: '📊 Available Commands', value: this.commands.size.toString(), inline: true },
          { name: '🔗 API Status', value: health.status === 'healthy' ? '✅ Healthy' : '⚠️ Degraded', inline: true }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({
        embeds: [this.createErrorEmbed('❌ Test Failed', `API connection failed: ${error.message}`)]
      });
    }
  }

  async handleHelp(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('🔧 Snaplove Admin Commands')
      .setDescription('Complete admin panel via Discord slash commands')
      .setColor(0x7289da)
      .addFields(
        {
          name: '📊 System',
          value: '`/stats` `/health` `/test` `/help`',
          inline: false
        },
        {
          name: '🖼️ Frame Management',
          value: '`/frames` `/approve` `/reject`',
          inline: false
        },
        {
          name: '👥 User Management',
          value: '`/users` `/user` `/ban` `/unban` `/role`',
          inline: false
        },
        {
          name: '📋 Reports',
          value: '`/reports` `/report` `/resolve-report`',
          inline: false
        },
        {
          name: '🎫 Tickets',
          value: '`/tickets` `/ticket` `/resolve-ticket`',
          inline: false
        },
        {
          name: '📢 Broadcasting',
          value: '`/broadcast`',
          inline: false
        },
        {
          name: '✨ Features',
          value: '• Full admin panel access\n• Real-time updates\n• Secure authentication\n• Rich embed responses',
          inline: false
        }
      )
      .setFooter({ text: `${this.commands.size} commands available • Use responsibly` })
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
      const _response = await this.makeDiscordApiRequest(
        `/api/admin/discord/frames?status=${status}&limit=${limit}`,
        'GET',
        null,
        interaction.user.id
      );

      await interaction.editReply({
        embeds: [this.createSuccessEmbed('🖼️ Frames Listed', `Listed ${status} frames. Check Discord for details.`)]
      });

    } catch (error) {
      await interaction.editReply({
        embeds: [this.createErrorEmbed('❌ Frames Failed', error.message)]
      });
    }
  }

  async handleApprove(interaction, options) {
    try {
      const { frameId } = options;
      const _response = await this.makeDiscordApiRequest(
        `/api/admin/discord/frame/${frameId}/approve`,
        'POST',
        {},
        interaction.user.id
      );

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

      const _response = await this.makeDiscordApiRequest(
        `/api/admin/discord/frame/${frameId}/reject`,
        'POST',
        { reason },
        interaction.user.id
      );

      await interaction.editReply({
        embeds: [this.createSuccessEmbed('❌ Frame Rejected', `Frame \`${frameId}\` has been rejected.\n**Reason:** ${reason}`)]
      });

    } catch (error) {
      await interaction.editReply({
        embeds: [this.createErrorEmbed('❌ Rejection Failed', error.message)]
      });
    }
  }

  async handleUsers(interaction, options) {
    try {
      const { role, limit } = options;
      const query = new URLSearchParams();
      if (role) query.append('role', role); query.append('limit', limit.toString());

      const _response = await this.makeDiscordApiRequest(
        `/api/admin/discord/users?${query}`,
        'GET',
        null,
        interaction.user.id
      );

      await interaction.editReply({
        embeds: [this.createSuccessEmbed('👥 Users Listed', `Listed ${role ? role + ' ' : ''}users. Check Discord for details.`)]
      });

    } catch (error) {
      await interaction.editReply({
        embeds: [this.createErrorEmbed('❌ Users Failed', error.message)]
      });
    }
  }

  async handleUser(interaction, options) {
    try {
      let { username } = options;

      username = username.replace(/^@/, '');

      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        await interaction.editReply({
          embeds: [this.createErrorEmbed('❌ Invalid Username', 'Username can only contain letters, numbers, and underscores.')]
        });
        return;
      }

      const user = await this.makeApiRequest(`/api/admin/users/${username}`);

      if (!user.success) {
        await interaction.editReply({
          embeds: [this.createErrorEmbed('❌ User Not Found', `User "${username}" not found.`)]
        });
        return;
      }

      const userData = user.data.user;
      const embed = new EmbedBuilder()
        .setTitle(`👤 User Details: @${userData.username}`)
        .setColor(userData.ban_status ? 0xff0000 : 0x00ff00)
        .addFields(
          { name: 'ID', value: userData.id, inline: true },
          { name: 'Name', value: userData.name, inline: true },
          { name: 'Role', value: userData.role, inline: true },
          { name: 'Status', value: userData.ban_status ? '🔴 Banned' : '🟢 Active', inline: true },
          { name: 'Email', value: userData.email || 'Not provided', inline: true },
          { name: 'Google ID', value: userData.google_id || 'Not connected', inline: true },
          { name: 'Bio', value: userData.bio || 'No bio', inline: false },
          { name: 'Created', value: new Date(userData.created_at).toLocaleDateString(), inline: true },
          { name: 'Updated', value: new Date(userData.updated_at).toLocaleDateString(), inline: true }
        )
        .setTimestamp();

      if (userData.ban_status && userData.ban_release_datetime) {
        embed.addFields({
          name: 'Ban Release',
          value: new Date(userData.ban_release_datetime).toLocaleString(),
          inline: true
        });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Discord user lookup error:', error);
      await interaction.editReply({
        embeds: [this.createErrorEmbed('❌ User Lookup Failed', error.message)]
      });
    }
  }

  async handleBan(interaction, options) {
    try {
      const { username: rawUsername, duration, reason } = options;

      if (!rawUsername) {
        await interaction.editReply({
          embeds: [this.createErrorEmbed('❌ Missing Username', 'Username parameter is required for ban command.')]
        });
        return;
      }

      const username = String(rawUsername).trim().replace(/^@/, '');

      if (!/^[a-zA-Z0-9_.-]+$/.test(username) || username.length < 1 || username.length > 50) {
        await interaction.editReply({
          embeds: [this.createErrorEmbed('❌ Invalid Username', 'Username must be 1-50 characters and contain only letters, numbers, underscores, dots, or hyphens.')]
        });
        return;
      }

      if (!/^[a-zA-Z0-9_.-]+$/.test(username) || username.length < 1 || username.length > 50) {
        await interaction.editReply({
          embeds: [this.createErrorEmbed('❌ Invalid Username', 'Username must be 1-50 characters and contain only letters, numbers, underscores, dots, or hyphens.')]
        });
        return;
      }

      if (duration) {
        const durationRegex = /^(\d+)([dhm])$/;
        if (!durationRegex.test(duration)) {
          await interaction.editReply({
            embeds: [this.createErrorEmbed('❌ Invalid Duration', 'Duration must be in format: 7d, 24h, or 30m (days, hours, minutes).')]
          });
          return;
        }
      }

      if (reason && reason.length > 500) {
        await interaction.editReply({
          embeds: [this.createErrorEmbed('❌ Reason Too Long', 'Ban reason must be 500 characters or less.')]
        });
        return;
      }

      const requestData = {
        ...(duration && { duration }),
        ...(reason && { reason })
      };

      console.log(`🔨 Discord ban request for user: ${username}`, requestData);

      await this.makeDiscordApiRequest(
        `/api/admin/discord/user/${encodeURIComponent(username)}/ban`,
        'POST',
        requestData,
        interaction.user.id
      );

      let responseMessage = `User @${username} has been banned successfully!`;
      if (duration) {
        responseMessage += `\n**Duration:** ${duration}`;
      }
      if (reason) {
        responseMessage += `\n**Reason:** ${reason}`;
      }

      await interaction.editReply({
        embeds: [this.createSuccessEmbed('🔨 User Banned', responseMessage)]
      });

    } catch (error) {
      console.error('Discord ban error:', error);

      let errorMessage = error.message;
      if (error.message.includes('Validation failed')) {
        errorMessage = 'Invalid ban parameters. Please check username format and try again.';
      } else if (error.message.includes('User not found')) {
        errorMessage = 'User not found. Please check the username and try again.';
      } else if (error.message.includes('already banned')) {
        errorMessage = 'User is already banned.';
      } else if (error.message.includes('Cannot ban admin')) {
        errorMessage = 'Cannot ban admin users.';
      }

      await interaction.editReply({
        embeds: [this.createErrorEmbed('❌ Ban Failed', errorMessage)]
      });
    }
  } async handleUnban(interaction, options) {
    try {
      const { username: rawUsername } = options;

      if (!rawUsername) {
        await interaction.editReply({
          embeds: [this.createErrorEmbed('❌ Missing Username', 'Username parameter is required.')]
        });
        return;
      }

      const username = String(rawUsername).trim().replace(/^@/, '');

      if (!/^[a-zA-Z0-9_.-]+$/.test(username) || username.length < 1 || username.length > 50) {
        await interaction.editReply({
          embeds: [this.createErrorEmbed('❌ Invalid Username', 'Username must be 1-50 characters and contain only letters, numbers, underscores, dots, or hyphens.')]
        });
        return;
      }

      await this.makeDiscordApiRequest(
        `/api/admin/discord/user/${encodeURIComponent(username)}/unban`,
        'POST',
        {},
        interaction.user.id
      );

      await interaction.editReply({
        embeds: [this.createSuccessEmbed('✅ User Unbanned', `User @${username} has been unbanned successfully!`)]
      });

    } catch (error) {
      console.error('Discord unban error:', error);

      let errorMessage = error.message;
      if (error.message.includes('User not found')) {
        errorMessage = 'User not found. Please check the username and try again.';
      } else if (error.message.includes('not banned')) {
        errorMessage = 'User is not currently banned.';
      }

      await interaction.editReply({
        embeds: [this.createErrorEmbed('❌ Unban Failed', errorMessage)]
      });
    }
  }

  async handleRole(interaction, options) {
    try {
      const { username: rawUsername, newRole } = options;

      if (!rawUsername) {
        await interaction.editReply({
          embeds: [this.createErrorEmbed('❌ Missing Username', 'Username parameter is required.')]
        });
        return;
      }

      const username = String(rawUsername).trim().replace(/^@/, '');

      if (!/^[a-zA-Z0-9_.-]+$/.test(username) || username.length < 1 || username.length > 50) {
        await interaction.editReply({
          embeds: [this.createErrorEmbed('❌ Invalid Username', 'Username must be 1-50 characters and contain only letters, numbers, underscores, dots, or hyphens.')]
        });
        return;
      }

      await this.makeDiscordApiRequest(
        `/api/admin/discord/user/${encodeURIComponent(username)}/role`,
        'POST',
        { role: newRole },
        interaction.user.id
      );

      await interaction.editReply({
        embeds: [this.createSuccessEmbed('🔄 Role Updated', `User @${username} role changed to **${newRole}**`)]
      });

    } catch (error) {
      console.error('Discord role change error:', error);

      let errorMessage = error.message;
      if (error.message.includes('User not found')) {
        errorMessage = 'User not found. Please check the username and try again.';
      } else if (error.message.includes('already has this role')) {
        errorMessage = 'User already has this role.';
      }

      await interaction.editReply({
        embeds: [this.createErrorEmbed('❌ Role Change Failed', errorMessage)]
      });
    }
  }

  async handleBroadcast(interaction, options) {
    try {
      const { message, audience, type } = options;

      const _response = await this.makeDiscordApiRequest(
        '/api/admin/discord/broadcast',
        'POST',
        { message, target_audience: audience, type },
        interaction.user.id
      );

      await interaction.editReply({
        embeds: [this.createSuccessEmbed('📢 Broadcast Sent', `Message sent successfully!\n\n**Message:** ${message}`)]
      });

    } catch (error) {
      await interaction.editReply({
        embeds: [this.createErrorEmbed('❌ Broadcast Failed', error.message)]
      });
    }
  }

  async handleReports(interaction, options) {
    try {
      const { status, limit } = options;
      const query = new URLSearchParams();
      if (status) query.append('status', status); query.append('limit', limit.toString());

      const reports = await this.makeApiRequest(`/api/admin/reports?${query}`);

      if (reports.data.reports.length === 0) {
        await interaction.editReply({
          embeds: [this.createInfoEmbed('📋 No Reports', `No ${status || 'pending'} reports found.`)]
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`📋 Reports (${status || 'all'})`)
        .setDescription(`Found ${reports.data.reports.length} reports`)
        .setColor(0xff9900);

      reports.data.reports.slice(0, 10).forEach((report, index) => {
        embed.addFields({
          name: `${index + 1}. ${report.title}`,
          value: `**ID:** \`${report.id}\`\n**Status:** ${report.report_status}\n**By:** @${report.reporter.username}`,
          inline: false
        });
      });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      await interaction.editReply({
        embeds: [this.createErrorEmbed('❌ Reports Failed', error.message)]
      });
    }
  }

  async handleReport(interaction, options) {
    try {
      const { reportId } = options;
      const report = await this.makeApiRequest(`/api/admin/reports/${reportId}`);

      if (!report.success) {
        await interaction.editReply({
          embeds: [this.createErrorEmbed('❌ Report Not Found', `Report "${reportId}" not found.`)]
        });
        return;
      }

      const reportData = report.data.report;
      const embed = new EmbedBuilder()
        .setTitle(`📋 Report Details`)
        .setColor(reportData.report_status === 'pending' ? 0xff9900 : 0x00ff00)
        .addFields(
          { name: 'ID', value: reportData.id, inline: true },
          { name: 'Title', value: reportData.title, inline: true },
          { name: 'Status', value: reportData.report_status, inline: true },
          { name: 'Reporter', value: `@${reportData.reporter.username}`, inline: true },
          { name: 'Created', value: new Date(reportData.created_at).toLocaleDateString(), inline: true },
          { name: 'Description', value: reportData.description || 'No description', inline: false }
        )
        .setTimestamp();

      if (reportData.admin_response) {
        embed.addFields({ name: 'Admin Response', value: reportData.admin_response, inline: false });
      }

      if (reportData.frame) {
        embed.addFields({ name: 'Reported Frame', value: reportData.frame.title, inline: true });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      await interaction.editReply({
        embeds: [this.createErrorEmbed('❌ Report Lookup Failed', error.message)]
      });
    }
  }

  async handleResolveReport(interaction, options) {
    try {
      const { reportId, action, response } = options;

      const updateData = {
        report_status: action === 'delete_frame' ? 'done' : action,
        ...(action === 'delete_frame' && { action: 'delete_frame' }),
        ...(response && { admin_response: response })
      };

      const _result = await this.makeApiRequest(`/api/admin/reports/${reportId}`, 'PUT', updateData);

      await interaction.editReply({
        embeds: [this.createSuccessEmbed('✅ Report Resolved', `Report \`${reportId}\` has been ${action === 'delete_frame' ? 'resolved and frame deleted' : action}.`)]
      });

    } catch (error) {
      await interaction.editReply({
        embeds: [this.createErrorEmbed('❌ Report Resolution Failed', error.message)]
      });
    }
  }

  async handleTickets(interaction, options) {
    try {
      const { status, priority, limit } = options;
      const query = new URLSearchParams();
      if (status) query.append('status', status); if (priority) query.append('priority', priority); query.append('limit', limit.toString());

      const tickets = await this.makeApiRequest(`/api/admin/ticket?${query}`);

      if (tickets.data.tickets.length === 0) {
        await interaction.editReply({
          embeds: [this.createInfoEmbed('🎫 No Tickets', `No ${status || priority || 'pending'} tickets found.`)]
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`🎫 Tickets (${status || priority || 'all'})`)
        .setDescription(`Found ${tickets.data.tickets.length} tickets`)
        .setColor(0x3498db);

      tickets.data.tickets.slice(0, 10).forEach((ticket, index) => {
        const priorityEmoji = {
          urgent: '🔴',
          high: '🟠',
          medium: '🟡',
          low: '🟢'
        }[ticket.priority] || '⚪';

        embed.addFields({
          name: `${index + 1}. ${ticket.title}`,
          value: `**ID:** \`${ticket.id}\`\n**Status:** ${ticket.status}\n**Priority:** ${priorityEmoji} ${ticket.priority}\n**By:** @${ticket.user.username}`,
          inline: false
        });
      });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      await interaction.editReply({
        embeds: [this.createErrorEmbed('❌ Tickets Failed', error.message)]
      });
    }
  }

  async handleTicket(interaction, options) {
    try {
      const { ticketId } = options;
      const ticket = await this.makeApiRequest(`/api/admin/ticket/${ticketId}`);

      if (!ticket.success) {
        await interaction.editReply({
          embeds: [this.createErrorEmbed('❌ Ticket Not Found', `Ticket "${ticketId}" not found.`)]
        });
        return;
      }

      const ticketData = ticket.data.ticket;
      const priorityEmoji = {
        urgent: '🔴',
        high: '🟠',
        medium: '🟡',
        low: '🟢'
      }[ticketData.priority] || '⚪';

      const embed = new EmbedBuilder()
        .setTitle(`🎫 Ticket Details`)
        .setColor(ticketData.status === 'resolved' ? 0x00ff00 : 0x3498db)
        .addFields(
          { name: 'ID', value: ticketData.id, inline: true },
          { name: 'Title', value: ticketData.title, inline: true },
          { name: 'Status', value: ticketData.status, inline: true },
          { name: 'Priority', value: `${priorityEmoji} ${ticketData.priority}`, inline: true },
          { name: 'Type', value: ticketData.type || 'General', inline: true },
          { name: 'User', value: `@${ticketData.user.username}`, inline: true },
          { name: 'Created', value: new Date(ticketData.created_at).toLocaleDateString(), inline: true },
          { name: 'Updated', value: new Date(ticketData.updated_at).toLocaleDateString(), inline: true },
          { name: 'Description', value: ticketData.description || 'No description', inline: false }
        )
        .setTimestamp();

      if (ticketData.admin_response) {
        embed.addFields({ name: 'Admin Response', value: ticketData.admin_response, inline: false });
      }

      if (ticketData.admin && ticketData.admin.username) {
        embed.addFields({ name: 'Assigned Admin', value: `@${ticketData.admin.username}`, inline: true });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      await interaction.editReply({
        embeds: [this.createErrorEmbed('❌ Ticket Lookup Failed', error.message)]
      });
    }
  }

  async handleResolveTicket(interaction, options) {
    try {
      const { ticketId, status, response, priority } = options;

      const updateData = {
        status,
        ...(response && { admin_response: response }),
        ...(priority && { priority })
      };

      const _result = await this.makeApiRequest(`/api/admin/ticket/${ticketId}`, 'PUT', updateData);

      const embed = new EmbedBuilder()
        .setTitle('✅ Ticket Updated')
        .setDescription(`Ticket \`${ticketId}\` has been updated successfully!`)
        .setColor(0x00ff00)
        .addFields(
          { name: 'New Status', value: status, inline: true },
          ...(priority ? [{ name: 'New Priority', value: priority, inline: true }] : []),
          ...(response ? [{ name: 'Response Sent', value: 'Yes', inline: true }] : [])
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      await interaction.editReply({
        embeds: [this.createErrorEmbed('❌ Ticket Update Failed', error.message)]
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