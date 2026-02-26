/**
 * Slack Integration Service
 * Handles all Slack interactions including:
 * - Sending messages to channels
 * - Direct messages to users
 * - Handling bot events and commands
 */

import pkg from '@slack/bolt';
const { App } = pkg;
import config from '../config/index.js';

class SlackService {
  constructor() {
    this.app = null;
    this.messageHandlers = [];
  }

  /**
   * Initialize the Slack app
   */
  initialize() {
    this.app = new App({
      token: config.slack.botToken,
      signingSecret: config.slack.signingSecret,
      socketMode: true,
      appToken: config.slack.appToken,
    });

    this._setupEventHandlers();
    console.log('Slack service initialized');
  }

  /**
   * Set up Slack event handlers
   */
  _setupEventHandlers() {
    // Handle direct messages and channel messages
    this.app.message(async ({ message, say }) => {
      // Ignore bot messages
      if (message.bot_id || message.subtype === 'bot_message') {
        return;
      }

      // Call registered handlers
      for (const handler of this.messageHandlers) {
        try {
          await handler(message, say);
        } catch (error) {
          console.error('Error in message handler:', error);
        }
      }
    });

    // Handle app mentions
    this.app.event('app_mention', async ({ event, say }) => {
      // Remove the bot mention from the text
      const cleanText = event.text.replace(/<@[A-Z0-9]+>/g, '').trim();

      // Call registered handlers with cleaned text
      for (const handler of this.messageHandlers) {
        try {
          await handler({ ...event, text: cleanText, isMention: true }, say);
        } catch (error) {
          console.error('Error in mention handler:', error);
        }
      }
    });
  }

  /**
   * Register a handler for incoming messages
   * @param {Function} handler - Handler function (message, say) => void
   */
  registerMessageHandler(handler) {
    this.messageHandlers.push(handler);
  }

  /**
   * Start the Slack app
   */
  async start() {
    await this.app.start();
    console.log('⚡️ Slack bot is running in Socket Mode!');
  }

  /**
   * Send a message to a Slack channel
   * @param {string} channel - Channel ID or name
   * @param {string} text - Message text (fallback for notifications)
   * @param {Array} blocks - Optional Block Kit blocks
   * @param {string} threadTs - Optional thread timestamp
   * @returns {Promise<string|null>} Message timestamp if successful
   */
  async sendMessage(channel, text, blocks = null, threadTs = null) {
    try {
      const result = await this.app.client.chat.postMessage({
        channel,
        text,
        blocks,
        thread_ts: threadTs,
      });
      return result.ts;
    } catch (error) {
      console.error(`Failed to send message to ${channel}:`, error.message);
      return null;
    }
  }

  /**
   * Send a direct message to a user
   * @param {string} userId - Slack user ID
   * @param {string} text - Message text
   * @param {Array} blocks - Optional Block Kit blocks
   * @returns {Promise<string|null>} Message timestamp if successful
   */
  async sendDM(userId, text, blocks = null) {
    try {
      // Open a DM channel with the user
      const result = await this.app.client.conversations.open({ users: userId });
      const channelId = result.channel?.id;

      if (!channelId) {
        console.error(`Failed to open DM with user ${userId}`);
        return null;
      }

      return this.sendMessage(channelId, text, blocks);
    } catch (error) {
      console.error(`Failed to send DM to ${userId}:`, error.message);
      return null;
    }
  }

  /**
   * Get all members of a channel
   * @param {string} channel - Channel ID or name
   * @returns {Promise<Array>} List of user objects
   */
  async getChannelMembers(channel) {
    try {
      // Get channel ID if name was provided
      let channelId = channel;
      if (channel.startsWith('#')) {
        channelId = await this._getChannelId(channel.substring(1));
        if (!channelId) return [];
      }

      // Get member IDs
      const result = await this.app.client.conversations.members({ channel: channelId });
      const memberIds = result.members || [];

      // Get user info for each member
      const users = [];
      for (const userId of memberIds) {
        const userInfo = await this.getUserInfo(userId);
        if (userInfo && !userInfo.isBot) {
          users.push(userInfo);
        }
      }

      console.log(`Found ${users.length} members in channel ${channel}`);
      return users;
    } catch (error) {
      console.error('Failed to get channel members:', error.message);
      return [];
    }
  }

  /**
   * Get information about a Slack user
   * @param {string} userId - Slack user ID
   * @returns {Promise<Object|null>} User object
   */
  async getUserInfo(userId) {
    try {
      const result = await this.app.client.users.info({ user: userId });
      const user = result.user;
      
      return {
        id: user.id,
        name: user.name,
        realName: user.profile?.real_name || user.real_name || '',
        email: user.profile?.email || null,
        isBot: user.is_bot || false,
      };
    } catch (error) {
      console.error(`Failed to get user info for ${userId}:`, error.message);
      return null;
    }
  }

  /**
   * Find a Slack user by email address
   * @param {string} email - User's email address
   * @returns {Promise<Object|null>} User object
   */
  async getUserByEmail(email) {
    try {
      const result = await this.app.client.users.lookupByEmail({ email });
      const user = result.user;

      return {
        id: user.id,
        name: user.name,
        realName: user.profile?.real_name || user.real_name || '',
        email: user.profile?.email || email,
        isBot: user.is_bot || false,
      };
    } catch (error) {
      console.error(`Failed to find user by email ${email}:`, error.message);
      return null;
    }
  }

  /**
   * Get channel ID from channel name
   * @param {string} channelName - Channel name without #
   * @returns {Promise<string|null>} Channel ID
   */
  async _getChannelId(channelName) {
    try {
      const result = await this.app.client.conversations.list({
        types: 'public_channel,private_channel',
      });

      for (const channel of result.channels || []) {
        if (channel.name === channelName) {
          return channel.id;
        }
      }
      return null;
    } catch (error) {
      console.error(`Failed to get channel ID for ${channelName}:`, error.message);
      return null;
    }
  }

  /**
   * Create Block Kit blocks for standup prompt
   * @param {string} userName - Name of the user
   * @param {Array} tasks - List of task objects
   * @returns {Array} Block Kit blocks
   */
  createStandupPromptBlocks(userName, tasks) {
    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `👋 Hi *${userName}*! Time for your daily standup.`,
        },
      },
      { type: 'divider' },
    ];

    if (tasks && tasks.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*📋 Your current tasks:*',
        },
      });

      for (const task of tasks.slice(0, 5)) {
        const statusEmoji = this._getStatusEmoji(task.status);
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${statusEmoji} *${task.key}*: ${task.summary}\n_Status: ${task.status}_`,
          },
        });
      }

      blocks.push({ type: 'divider' });
    }

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: "Please share your update. I'll ask about:\n• Progress on your tasks\n• Any blockers\n• Timeline estimates for To-Do/In-Progress items",
      },
    });

    return blocks;
  }

  /**
   * Get emoji for task status
   * @param {string} status - Task status
   * @returns {string} Emoji
   */
  _getStatusEmoji(status) {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('done')) return '✅';
    if (statusLower.includes('progress')) return '🔄';
    if (statusLower.includes('review')) return '👀';
    if (statusLower.includes('blocked')) return '🚫';
    return '📋';
  }
}

export default new SlackService();
