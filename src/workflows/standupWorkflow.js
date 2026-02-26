/**
 * Standup Workflow Orchestrator
 * Manages the daily standup process including:
 * - Initiating standups at scheduled times
 * - Collecting updates from team members
 * - Processing responses with LLM
 * - Updating JIRA tickets
 * - Handling leave management
 */

import config from '../config/index.js';
import jiraService from '../services/jiraService.js';
import slackService from '../services/slackService.js';
import llmService from '../services/llmService.js';
import leaveService from '../services/leaveService.js';

// Standup states
const StandupState = {
  NOT_STARTED: 'not_started',
  AWAITING_UPDATE: 'awaiting_update',
  AWAITING_TIMELINE: 'awaiting_timeline',
  AWAITING_BLOCKERS: 'awaiting_blockers',
  COMPLETED: 'completed',
  SKIPPED: 'skipped',
};

class StandupWorkflow {
  constructor() {
    // Active standup sessions keyed by user_id
    this.sessions = new Map();
    
    // Track today's standup
    this.standupDate = null;
    this.standupThreadTs = null;
  }

  /**
   * Initiate the daily standup for all team members
   * @returns {Promise<boolean>} True if standup started successfully
   */
  async startDailyStandup() {
    console.log('🌅 Starting daily standup...');

    // Reset sessions for new day
    this.sessions.clear();
    this.standupDate = new Date().toISOString().split('T')[0];

    // Get channel for standup
    const channel = config.slack.standupChannel;

    // Send standup header message
    const headerBlocks = this._createStandupHeader();
    this.standupThreadTs = await slackService.sendMessage(
      channel,
      '🌅 Daily Standup Starting!',
      headerBlocks
    );

    if (!this.standupThreadTs) {
      console.error('Failed to send standup header message');
      return false;
    }

    // Get team members from JIRA
    const teamMembers = await jiraService.getTeamMembers();

    if (teamMembers.length === 0) {
      console.warn('No team members found in JIRA project');
      return false;
    }

    // Process each team member
    const onLeaveMembers = [];
    const activeMembers = [];

    for (const member of teamMembers) {
      const { email, name } = member;

      // Check if on leave
      if (leaveService.isOnLeave(email)) {
        const leaveRecord = leaveService.getLeaveRecord(email);
        onLeaveMembers.push({
          name,
          reason: leaveRecord?.reason || 'On leave',
        });
        continue;
      }

      // Find Slack user
      const slackUser = await slackService.getUserByEmail(email);
      if (!slackUser) {
        console.warn(`Could not find Slack user for ${email}`);
        continue;
      }

      // Get user's tasks from JIRA
      const tasks = await jiraService.getUserTasks(email);

      // Create session
      const session = {
        userId: slackUser.id,
        userEmail: email,
        userName: name,
        state: StandupState.NOT_STARTED,
        tasks,
        updates: [],
        pendingTimelineTasks: [],
        blockers: [],
        threadTs: null,
        startedAt: new Date(),
        completedAt: null,
      };

      this.sessions.set(slackUser.id, session);
      activeMembers.push(session);
    }

    // Announce who's on leave
    if (onLeaveMembers.length > 0) {
      let leaveMsg = '📅 *Team members on leave today:*\n';
      for (const member of onLeaveMembers) {
        leaveMsg += `• ${member.name}`;
        if (member.reason) {
          leaveMsg += ` - ${member.reason}`;
        }
        leaveMsg += '\n';
      }

      await slackService.sendMessage(channel, leaveMsg, null, this.standupThreadTs);
    }

    // Send prompts to active members
    for (const session of activeMembers) {
      await this._sendStandupPrompt(session, channel);
    }

    console.log(`Standup started with ${activeMembers.length} active members, ${onLeaveMembers.length} on leave`);
    return true;
  }

  /**
   * Create the standup header message blocks
   */
  _createStandupHeader() {
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🌅 Daily Standup',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${today}*\n\nGood morning team! Time for our daily standup.`,
        },
      },
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: "*Please share:*\n• What you worked on yesterday\n• What you're working on today\n• Any blockers\n\n_I'll ask for timelines on To-Do and In-Progress tasks._",
        },
      },
      { type: 'divider' },
    ];
  }

  /**
   * Send standup prompt to a user
   */
  async _sendStandupPrompt(session, channel) {
    // Create task context
    const tasksInfo = session.tasks.slice(0, 10).map(task => ({
      key: task.key,
      summary: task.summary,
      status: task.status,
    }));

    const blocks = slackService.createStandupPromptBlocks(session.userName, tasksInfo);

    // Send in thread
    const msgTs = await slackService.sendMessage(
      channel,
      `Standup prompt for ${session.userName}`,
      blocks,
      this.standupThreadTs
    );

    if (msgTs) {
      session.threadTs = msgTs;
      session.state = StandupState.AWAITING_UPDATE;
      console.log(`Sent standup prompt to ${session.userName}`);
    }
  }

  /**
   * Handle a message from a user during standup
   * @param {string} userId - Slack user ID
   * @param {string} message - Message text
   * @param {string} channel - Channel ID
   * @param {string} threadTs - Thread timestamp if in thread
   * @returns {Promise<string|null>} Response message or null
   */
  async handleUserMessage(userId, message, channel, threadTs = null) {
    const session = this.sessions.get(userId);

    if (!session) {
      return null;
    }

    if (session.state === StandupState.COMPLETED) {
      return "You've already completed your standup for today! 🎉";
    }

    if (session.state === StandupState.SKIPPED) {
      return null;
    }

    // Build task context for LLM
    const tasksContext = session.tasks
      .map(t => jiraService.formatTicketContext(t))
      .join('\n\n');

    // Analyze the response
    const analysis = await llmService.analyzeStandupResponse(message, tasksContext);

    // Handle off-topic messages
    if (analysis.isOffTopic) {
      const redirectMsg = await llmService.generateRedirectMessage(
        analysis.offTopicReason || 'off-topic discussion',
        message
      );
      return redirectMsg;
    }

    // Process task updates
    for (const update of analysis.taskUpdates) {
      session.updates.push({
        ticketKey: update.ticketKey,
        newStatus: update.newStatus,
        progressNote: update.progressNote,
        blocker: update.blocker,
        timeline: update.timeline,
      });

      // Update JIRA if status changed
      if (update.newStatus) {
        await jiraService.updateTicketStatus(update.ticketKey, update.newStatus);

        // Add comment with progress note
        if (update.progressNote) {
          const comment = `[Standup Update] ${update.progressNote}`;
          await jiraService.addComment(update.ticketKey, comment);
        }
      }
    }

    // Track blockers
    session.blockers.push(...analysis.blockers);

    // Check for missing timelines on To-Do/In-Progress tasks
    const tasksNeedingTimeline = [];
    for (const task of session.tasks) {
      const statusLower = task.status.toLowerCase();
      if (statusLower.includes('to do') || statusLower.includes('in progress')) {
        // Check if we got a timeline for this task
        const hasTimeline = session.updates.some(
          u => u.ticketKey === task.key && u.timeline
        );
        if (!hasTimeline) {
          tasksNeedingTimeline.push(task.key);
        }
      }
    }

    // If there are follow-up questions or missing timelines
    if (analysis.followUpQuestions.length > 0 || tasksNeedingTimeline.length > 0) {
      session.pendingTimelineTasks = tasksNeedingTimeline;
      session.state = StandupState.AWAITING_TIMELINE;

      const responseParts = [];

      if (analysis.summary) {
        responseParts.push(`Thanks for the update! ${analysis.summary}`);
      }

      if (tasksNeedingTimeline.length > 0) {
        const tasksStr = tasksNeedingTimeline.slice(0, 3).join(', ');
        responseParts.push(`\n\n📅 Could you provide estimated timelines for: ${tasksStr}?`);
      }

      for (const question of analysis.followUpQuestions.slice(0, 2)) {
        responseParts.push(`\n\n${question}`);
      }

      return responseParts.join('');
    }

    // Standup complete for this user
    session.state = StandupState.COMPLETED;
    session.completedAt = new Date();

    // Generate completion message
    const completionMsg = this._generateCompletionMessage(session, analysis);

    // Check if all standups are complete
    await this._checkStandupCompletion(channel);

    return completionMsg;
  }

  /**
   * Generate a completion message for the user
   */
  _generateCompletionMessage(session, analysis) {
    const msgParts = ['✅ Thanks for your standup update!'];

    if (analysis.summary) {
      msgParts.push(`\n\n*Summary:* ${analysis.summary}`);
    }

    if (session.blockers.length > 0) {
      msgParts.push(`\n\n🚧 *Blockers noted:* ${session.blockers.join(', ')}`);
      msgParts.push("\nI'll flag these for the team's attention.");
    }

    // List any JIRA updates made
    const statusUpdates = session.updates.filter(u => u.newStatus);
    if (statusUpdates.length > 0) {
      msgParts.push('\n\n*JIRA Updates:*');
      for (const update of statusUpdates) {
        msgParts.push(`\n• ${update.ticketKey} → ${update.newStatus}`);
      }
    }

    return msgParts.join('');
  }

  /**
   * Check if all standups are complete and send summary
   */
  async _checkStandupCompletion(channel) {
    const allComplete = Array.from(this.sessions.values()).every(
      s => s.state === StandupState.COMPLETED || s.state === StandupState.SKIPPED
    );

    if (allComplete && this.sessions.size > 0) {
      await this._sendStandupSummary(channel);
    }
  }

  /**
   * Send the standup summary to the channel
   */
  async _sendStandupSummary(channel) {
    console.log('All standups complete, generating summary...');

    // Collect all updates
    const allUpdates = [];
    const allBlockers = [];

    for (const session of this.sessions.values()) {
      if (session.state === StandupState.COMPLETED) {
        allUpdates.push({
          name: session.userName,
          updates: session.updates,
          blockers: session.blockers,
        });

        for (const blocker of session.blockers) {
          allBlockers.push({
            user: session.userName,
            blocker,
          });
        }
      }
    }

    // Generate summary with LLM
    const summary = await llmService.generateStandupSummary(allUpdates);

    // Create summary blocks
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📊 Standup Summary',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: summary,
        },
      },
    ];

    // Add blockers section if any
    if (allBlockers.length > 0) {
      blocks.push({ type: 'divider' });

      let blockersText = '*🚧 Blockers Requiring Attention:*\n';
      for (const item of allBlockers) {
        blockersText += `• *${item.user}*: ${item.blocker}\n`;
      }

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: blockersText,
        },
      });
    }

    // Send summary
    await slackService.sendMessage(channel, 'Standup Summary', blocks, this.standupThreadTs);

    console.log('Standup summary sent');
  }

  /**
   * Mark a user as on leave
   * @param {string} email - User's email
   * @param {string} startDate - Leave start date (YYYY-MM-DD)
   * @param {string} endDate - Leave end date (YYYY-MM-DD)
   * @param {string} reason - Optional reason
   */
  markUserOnLeave(email, startDate, endDate, reason = null) {
    leaveService.addLeave(email, startDate, endDate, reason);
    console.log(`Marked ${email} on leave from ${startDate} to ${endDate}`);
  }

  /**
   * Get a user's current standup session
   */
  getSession(userId) {
    return this.sessions.get(userId);
  }

  /**
   * Get all active standup sessions
   */
  getAllSessions() {
    return new Map(this.sessions);
  }

  /**
   * Skip standup for a user
   */
  skipUserStandup(userId, reason = 'Manually skipped') {
    const session = this.sessions.get(userId);
    if (session) {
      session.state = StandupState.SKIPPED;
      console.log(`Skipped standup for ${session.userName}: ${reason}`);
    }
  }
}

export default new StandupWorkflow();
