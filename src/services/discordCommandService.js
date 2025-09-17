const discordHandler = require('../utils/DiscordHookHandler');
const axios = require('axios');

class DiscordCommandService {
  constructor() {
    this.baseUrl = process.env.NODE_ENV === 'production'
      ? 'https://api.snaplove.pics'
      : 'http://localhost:4000';
    this.isProcessing = false;
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

  async makeRequest(method, endpoint, data = null, token = null, discordUserId = null) {
    const config = {
      method,
      url: `${this.baseUrl}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'X-Discord-Token': token }),
        ...(discordUserId && { 'X-Discord-User': discordUserId })
      },
      ...(data && { data })
    };

    const response = await axios(config);
    return response.data;
  }

  async handleHelp() {
    const helpMessage = discordHandler.getHelpMessage();
    await discordHandler.sendEmbed('🔧 Admin Commands', helpMessage, [], 0x7289da);
  }

  async handleFrames(args, token, discordUserId) {
    const status = args[0] || 'pending';
    const limit = args[1] ? parseInt(args[1]) : 10;

    await this.makeRequest('GET', `/api/admin/discord/frames?status=${status}&limit=${limit}`, null, token, discordUserId);
  }

  async handleApprove(args, token, discordUserId) {
    if (!args[0]) {
      await discordHandler.sendError('Usage: `!snap approve <frame_id> [reason]`');
      return;
    }

    const frameId = args[0];
    const reason = args.slice(1).join(' ') || 'Approved via Discord';

    await this.makeRequest('POST', `/api/admin/discord/frame/${frameId}/approve`, { reason }, token, discordUserId);
  }

  async handleReject(args, token, discordUserId) {
    if (!args[0] || !args[1]) {
      await discordHandler.sendError('Usage: `!snap reject <frame_id> <reason>`');
      return;
    }

    const frameId = args[0];
    const reason = args.slice(1).join(' ');

    await this.makeRequest('POST', `/api/admin/discord/frame/${frameId}/reject`, { reason }, token, discordUserId);
  }

  async handleUsers(args, token, discordUserId) {
    const role = args[0];
    const limit = args[1] ? parseInt(args[1]) : 10;

    const query = new URLSearchParams();
    if (role) query.append('role', role);
    query.append('limit', limit.toString());

    await this.makeRequest('GET', `/api/admin/discord/users?${query}`, null, token, discordUserId);
  }

  async handleBan(args, token, discordUserId) {
    if (!args[0]) {
      await discordHandler.sendError('Usage: `!snap ban <username> [duration] [reason]`');
      return;
    }

    const username = args[0];
    const duration = args[1] && /^\d+[dhm]$/.test(args[1]) ? args[1] : null;
    const reason = args.slice(duration ? 2 : 1).join(' ');

    await this.makeRequest('POST', `/api/admin/discord/user/${username}/ban`, {
      duration,
      reason
    }, token, discordUserId);
  }

  async handleUnban(args, token, discordUserId) {
    if (!args[0]) {
      await discordHandler.sendError('Usage: `!snap unban <username>`');
      return;
    }

    const username = args[0];

    await this.makeRequest('POST', `/api/admin/discord/user/${username}/unban`, {}, token, discordUserId);
  }
  async handleBroadcast(args, token, discordUserId) {
    if (!args[0]) {
      await discordHandler.sendError('Usage: `!snap broadcast <message>`');
      return;
    }

    const message = args.join(' ');
    if (message.length > 500) {
      await discordHandler.sendError('Broadcast message too long (max 500 characters)');
      return;
    }

    await this.makeRequest('POST', '/api/admin/discord/broadcast', {
      message,
      type: 'announcement',
      target_audience: 'all'
    }, token, discordUserId);
  }

  async handleStats(token, discordUserId) {
    await this.makeRequest('GET', '/api/admin/discord/stats', null, token, discordUserId);
  }
}

module.exports = new DiscordCommandService();