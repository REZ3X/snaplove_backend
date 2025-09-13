const discordHandler = require('../utils/DiscordHookHandler');
const axios = require('axios');

class DiscordCommandService {
  constructor() {
    this.baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://api.snaplove.pics' 
      : 'http://localhost:4000';
    this.isProcessing = false;
  }

  async processCommand(content, discordUserId, discordUsername) {
    if (this.isProcessing) {
      await discordHandler.sendError('Another command is being processed. Please wait...');
      return;
    }

    this.isProcessing = true;

    try {
      const parsed = discordHandler.parseCommand(content);
      if (!parsed) return;

      const { command, args } = parsed;

      if (!discordHandler.isAuthorizedAdmin(discordUserId)) {
        await discordHandler.sendError(
          `❌ Unauthorized: @${discordUsername || discordUserId} is not authorized for admin commands`
        );
        return;
      }

      const authResponse = await this.makeRequest('POST', '/api/admin/discord/auth', {
        discord_user_id: discordUserId,
        discord_username: discordUsername
      });

      if (!authResponse.success) {
        await discordHandler.sendError('Failed to authenticate with Discord API');
        return;
      }

      const token = authResponse.data.token;

      switch (command) {
        case 'help':
          await this.handleHelp();
          break;
        case 'frames':
          await this.handleFrames(args, token, discordUserId);
          break;
        case 'approve':
          await this.handleApprove(args, token, discordUserId);
          break;
        case 'reject':
          await this.handleReject(args, token, discordUserId);
          break;
        case 'users':
          await this.handleUsers(args, token, discordUserId);
          break;
        case 'ban':
          await this.handleBan(args, token, discordUserId);
          break;
        case 'unban':
          await this.handleUnban(args, token, discordUserId);
          break;
        case 'broadcast':
          await this.handleBroadcast(args, token, discordUserId);
          break;
        case 'stats':
          await this.handleStats(token, discordUserId);
          break;
        default:
          await discordHandler.sendError(
            `Unknown command: \`${command}\`\nUse \`!snap help\` for available commands`
          );
      }

    } catch (error) {
      console.error('Discord command processing error:', error);
      await discordHandler.sendError('Command processing failed', error.message);
    } finally {
      this.isProcessing = false;
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

    const _username = args[0];

    const _adminAuthResponse = await this.makeRequest('POST', '/api/admin/discord/auth', {
      discord_user_id: discordUserId
    });

    await discordHandler.sendError('Unban command not yet implemented. Use admin panel for now.');
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