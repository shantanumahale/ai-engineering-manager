/**
 * Standup Workflow Orchestrator
 * Manages the daily standup process including:
 * - Initiating standups at scheduled times
 * - Asking team members ONE BY ONE in a SINGLE thread
 * - Processing responses with LLM
 * - Updating JIRA tickets
 * - Handling leave management
 * - Progressive questioning: first in-progress tasks, then todo tasks
 * - Limiting conversations: 2 back-n-forth for in-progress, 2 for todo
 * - Skipping non-dev team members (EM, PM)
 * - Skipping unavailable members (no repeated prompts)
 */

import config from '../config/index.js';
import jiraService from '../services/jiraService.js';
import slackService from '../services/slackService.js';
import llmService from '../services/llmService.js';
import leaveService from '../services/leaveService.js';

// Standup states for individual developers - progressive flow
const StandupState = {
  NOT_STARTED: 'not_started',
  ASKING_IN_PROGRESS: 'asking_in_progress',      // Asking about in-progress tasks
  IN_PROGRESS_FOLLOWUP: 'in_progress_followup',  // Follow-up on in-progress (max 2 exchanges)
  ASKING_TODO: 'asking_todo',                    // Asking about todo tasks
  TODO_FOLLOWUP: 'todo_followup',                // Follow-up on todo (max 2 exchanges)
  COMPLETED: 'completed',
  SKIPPED: 'skipped',
  NEEDS_FOLLOWUP: 'needs_followup', // When responses are unsatisfactory
};

// Overall standup states
const StandupPhase = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
};

// Timeout for waiting for a developer's response (in milliseconds)
const RESPONSE_TIMEOUT_MS = 120000; // 2 minutes - initial wait before checking
const FINAL_TIMEOUT_MS = 60000; // 1 additional minute (3 minutes total) before moving on

// Maximum back-n-forth exchanges per phase (2-3 exchanges per person)
const MAX_IN_PROGRESS_EXCHANGES = 3;
const MAX_TODO_EXCHANGES = 3;

class StandupWorkflow {
  constructor() {
    // Active standup sessions keyed by user_id
    this.sessions = new Map();
    
    // Track today's standup
    this.standupDate = null;
    this.standupChannel = null;
    
    // Overall standup phase
    this.standupPhase = StandupPhase.NOT_STARTED;
    
    // Map Slack user IDs to sessions for quick lookup
    this.userIdToSession = new Map();
    
    // Track timeouts per user (for individual thread responses)
    this.userTimeouts = new Map();
    
    // Members who need 1-1 follow-up
    this.needsFollowup = [];
    
    // Single thread for entire standup
    this.standupThreadTs = null;
    
    // Queue of developers to ask (sequential processing)
    this.developerQueue = [];
    
    // Currently active developer being asked
    this.currentDeveloper = null;
    
    // Set of unavailable developers (skip them entirely)
    this.unavailableDevelopers = new Set();
    
    // Track blockers: Map of blocker owner (email/name) -> array of {blockedUser, blockerDescription}
    // When A says they're blocked on B, we store it here and ask B about it when B's turn comes
    this.pendingBlockerQuestions = new Map();
  }

  /**
   * Check if a member should be excluded from standup (non-dev like EM, PM)
   * @param {string} name - Member's name
   * @param {string} email - Member's email
   * @returns {boolean} True if should be excluded
   */
  _shouldExcludeMember(name, email) {
    const excludedMembers = config.standup?.excludedMembers || [];
    const nameLower = (name || '').toLowerCase();
    const emailLower = (email || '').toLowerCase();
    
    return excludedMembers.some(excluded => {
      const excludedLower = excluded.toLowerCase();
      return nameLower.includes(excludedLower) ||
             emailLower.includes(excludedLower) ||
             excludedLower.includes(nameLower);
    });
  }

  /**
   * Get session for a user by their ID
   * @param {string} userId - Slack user ID
   * @returns {Object|null} Session or null
   */
  getSession(userId) {
    return this.sessions.get(userId) || null;
  }

  /**
   * Categorize tasks into in-progress and todo
   * Sorts by priority if available
   * @param {Array} tasks - All tasks
   * @returns {Object} { inProgressTasks, todoTasks }
   */
  _categorizeTasks(tasks) {
    const inProgressTasks = [];
    const todoTasks = [];
    
    // Priority order mapping (lower number = higher priority)
    const priorityOrder = {
      'highest': 1,
      'high': 2,
      'medium': 3,
      'normal': 3,
      'low': 4,
      'lowest': 5
    };
    
    for (const task of tasks) {
      const statusLower = (task.status || '').toLowerCase();
      if (statusLower.includes('in progress') || statusLower.includes('in-progress')) {
        inProgressTasks.push(task);
      } else if (statusLower.includes('to do') || statusLower.includes('todo') || statusLower.includes('open')) {
        todoTasks.push(task);
      }
    }
    
    // Sort by priority (tasks with priority come first, sorted by priority level)
    const sortByPriority = (a, b) => {
      const priorityA = (a.priority || '').toLowerCase();
      const priorityB = (b.priority || '').toLowerCase();
      const orderA = priorityOrder[priorityA] || 99;
      const orderB = priorityOrder[priorityB] || 99;
      return orderA - orderB;
    };
    
    inProgressTasks.sort(sortByPriority);
    todoTasks.sort(sortByPriority);
    
    return { inProgressTasks, todoTasks };
  }

  /**
   * Maximum number of in-progress tasks to ask about (2-3 items per person)
   */
  static MAX_IN_PROGRESS_TASKS_TO_ASK = 3;

  /**
   * Initiate the daily standup for all team members
   * Asks developers ONE BY ONE in a SINGLE thread
   * @returns {Promise<boolean>} True if standup started successfully
   */
  async startDailyStandup() {
    console.log('🚀 Starting daily standup...');

    // Reset sessions for new day
    this.sessions.clear();
    this.userIdToSession.clear();
    this.userTimeouts.clear();
    this.needsFollowup = [];
    this.developerQueue = [];
    this.currentDeveloper = null;
    this.unavailableDevelopers.clear();
    this.pendingBlockerQuestions.clear();
    this.standupThreadTs = null;
    this.standupDate = new Date().toISOString().split('T')[0];
    this.standupPhase = StandupPhase.IN_PROGRESS;

    // Get channel for standup
    this.standupChannel = config.slack.standupChannel;

    // Send standup header message (this becomes the thread parent)
    const headerBlocks = this._createStandupHeader();
    const headerTs = await slackService.sendMessage(
      this.standupChannel,
      '🚀 Starting daily standup...',
      headerBlocks
    );

    if (!headerTs) {
      console.error('Failed to send standup header message');
      return false;
    }

    // Store the thread timestamp - ALL messages will be in this thread
    this.standupThreadTs = headerTs;

    // Get team members from JIRA
    const teamMembers = await jiraService.getTeamMembers();

    if (teamMembers.length === 0) {
      console.warn('No team members found in JIRA project');
      return false;
    }

    // Process each team member
    const onLeaveMembers = [];
    const excludedMembers = [];

    for (const member of teamMembers) {
      const { email, name } = member;

      // Check if this member should be excluded (non-dev like EM, PM)
      if (this._shouldExcludeMember(name, email)) {
        excludedMembers.push({ name, reason: 'Non-developer (EM/PM)' });
        console.log(`Skipping ${name} - excluded from standup (non-developer)`);
        continue;
      }

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
      
      // Categorize tasks
      const { inProgressTasks, todoTasks } = this._categorizeTasks(tasks);

      // Create session with new tracking fields
      const session = {
        userId: slackUser.id,
        slackName: slackUser.name,
        userEmail: email,
        userName: name,
        state: StandupState.NOT_STARTED,
        tasks,
        inProgressTasks,
        todoTasks,
        updates: [],
        blockers: [],
        promptMessageTs: null,
        startedAt: null,
        completedAt: null,
        conversationHistory: [],
        // Track exchanges per phase
        inProgressExchangeCount: 0,
        todoExchangeCount: 0,
        // Track if responses were satisfactory
        inProgressSatisfactory: true,
        todoSatisfactory: true,
        // Track unsatisfactory reasons
        unsatisfactoryReasons: [],
        // Skip todo items when there are too many in-progress tasks
        skipTodoItems: false,
        // Tasks we're actually asking about (may be subset of inProgressTasks)
        tasksToAskAbout: [],
      };

      this.sessions.set(slackUser.id, session);
      this.userIdToSession.set(slackUser.id, session);
      // Add to queue for sequential processing
      this.developerQueue.push(session);
    }

    // Announce who's on leave (in the thread)
    if (onLeaveMembers.length > 0) {
      let leaveMsg = '📅 *Team members on leave today:*\n';
      for (const member of onLeaveMembers) {
        leaveMsg += `• ${member.name}`;
        if (member.reason) {
          leaveMsg += ` - ${member.reason}`;
        }
        leaveMsg += '\n';
      }
      await slackService.sendMessage(this.standupChannel, leaveMsg, null, this.standupThreadTs);
    }

    console.log(`Standup started with ${this.developerQueue.length} active developers, ${onLeaveMembers.length} on leave, ${excludedMembers.length} excluded`);

    // Start asking developers ONE BY ONE
    if (this.developerQueue.length > 0) {
      await this._askNextDeveloper();
    } else {
      await this._completeStandup();
    }

    return true;
  }

  /**
   * Ask the next developer in the queue (sequential, one at a time)
   */
  async _askNextDeveloper() {
    // Find next available developer (skip unavailable ones)
    while (this.developerQueue.length > 0) {
      const nextSession = this.developerQueue.shift();
      
      // Skip if marked as unavailable
      if (this.unavailableDevelopers.has(nextSession.userId)) {
        console.log(`Skipping ${nextSession.userName} - marked as unavailable`);
        nextSession.state = StandupState.SKIPPED;
        continue;
      }
      
      // Found an available developer
      this.currentDeveloper = nextSession;
      console.log(`📣 Asking ${nextSession.userName} for standup update...`);
      await this._sendInitialPrompt(nextSession);
      return;
    }
    
    // No more developers in queue
    this.currentDeveloper = null;
    await this._completeStandup();
  }

  /**
   * Send initial standup prompt - asks about in-progress tasks only
   * All messages go in the SINGLE standup thread
   * Note: We skip to-do items for everybody - focus only on in-progress work
   */
  async _sendInitialPrompt(session) {
    session.startedAt = new Date();
    // All messages use the same thread
    session.promptMessageTs = this.standupThreadTs;
    
    // Always ask about in-progress tasks (or general update if none)
    // We skip to-do items for everybody
    session.state = StandupState.ASKING_IN_PROGRESS;
    session.skipTodoItems = true; // Always skip to-do items
    await this._askAboutInProgressTasks(session);
  }

  /**
   * Get pending blocker questions for a user (blockers where they are the blocking party)
   * @param {Object} session - The user's session
   * @returns {Array} Array of blocker questions to ask
   */
  _getPendingBlockerQuestionsForUser(session) {
    const blockerQuestions = [];
    const userNameLower = (session.userName || '').toLowerCase();
    const userEmailLower = (session.userEmail || '').toLowerCase();
    const userFirstName = userNameLower.split(' ')[0];
    
    // Check all pending blocker questions to see if any are for this user
    for (const [blockerOwner, blockers] of this.pendingBlockerQuestions) {
      const ownerLower = blockerOwner.toLowerCase();
      if (ownerLower.includes(userFirstName) ||
          ownerLower.includes(userNameLower) ||
          userNameLower.includes(ownerLower) ||
          ownerLower.includes(userEmailLower)) {
        blockerQuestions.push(...blockers);
      }
    }
    
    return blockerQuestions;
  }

  /**
   * Ask about in-progress tasks (in the single standup thread)
   * Asks about specific tasks by name (2-3 items max)
   * Also asks about any blockers where this person is blocking someone else
   * Always skips to-do items - focus only on in-progress work
   */
  async _askAboutInProgressTasks(session) {
    const totalInProgressCount = session.inProgressTasks.length;
    const maxTasksToAsk = StandupWorkflow.MAX_IN_PROGRESS_TASKS_TO_ASK;
    
    // Determine which tasks to ask about (already sorted by priority in _categorizeTasks)
    // Limit to max 3 tasks
    const tasksToAskAbout = session.inProgressTasks.slice(0, maxTasksToAsk);
    
    // Always skip to-do items - focus only on in-progress work
    session.skipTodoItems = true;
    
    // Store the tasks we're actually asking about
    session.tasksToAskAbout = tasksToAskAbout;
    
    // Check if there are any pending blocker questions for this user
    const blockerQuestions = this._getPendingBlockerQuestionsForUser(session);
    
    let message = `<@${session.userId}> Good morning! 👋\n\n`;
    
    // If someone is blocked on this person, ask about it clearly
    if (blockerQuestions.length > 0) {
      message += `🚧 *Blocker Alert:*\n`;
      for (const bq of blockerQuestions) {
        message += `*${bq.blockedUser}* is blocked on you for: "${bq.blockerDescription}". Any update on that?\n`;
      }
      message += `\n`;
    }
    
    if (tasksToAskAbout.length === 0) {
      // No in-progress tasks - ask general update
      message += `I don't see any tasks in progress. What are you working on today?`;
    } else if (tasksToAskAbout.length === 1) {
      // Single task - ask specifically about it by name (no ticket ID)
      const task = tasksToAskAbout[0];
      message += `What's the update on *${task.summary}*? Any blockers or issues?`;
    } else {
      // Multiple tasks - list them by name and ask for updates
      message += `Here are your in-progress items:\n`;
      tasksToAskAbout.forEach((task, index) => {
        message += `${index + 1}. *${task.summary}*\n`;
      });
      message += `\nWhat's the update on these? Any blockers or issues?`;
    }
    
    // Send in the single standup thread
    await slackService.sendMessage(
      this.standupChannel,
      message,
      null,
      this.standupThreadTs
    );

    console.log(`Sent in-progress prompt to ${session.userName} (asking about ${tasksToAskAbout.length} of ${totalInProgressCount} tasks, ${blockerQuestions.length} blocker questions)`);
    this._setUserTimeout(session);
  }

  /**
   * Ask about todo tasks (in the single standup thread)
   */
  async _askAboutTodoTasks(session) {
    const taskCount = session.todoTasks.length;
    
    let message;
    if (session.inProgressTasks.length > 0) {
      // Coming from in-progress phase
      message = `Great! Now about your *${taskCount} to-do task${taskCount > 1 ? 's' : ''}* - `;
      message += `which ones are you planning to pick up today? Any priorities or concerns?`;
    } else {
      // Starting directly with todo (no in-progress tasks)
      message = `<@${session.userId}> Good morning! 👋\n\n`;
      message += `You have *${taskCount} to-do task${taskCount > 1 ? 's' : ''}*. `;
      message += `Which ones are you planning to work on today? Any priorities or concerns?`;
    }
    
    // Send in the single standup thread
    await slackService.sendMessage(
      this.standupChannel,
      message,
      null,
      this.standupThreadTs
    );
    
    console.log(`Sent todo prompt to ${session.userName}`);
    this._setUserTimeout(session);
  }

  /**
   * Ask for general update when no specific tasks (in the single standup thread)
   */
  async _askGeneralUpdate(session) {
    const message = `<@${session.userId}> Good morning! 👋\n\n` +
      `I don't see any active tasks assigned to you. What are you working on today?`;
    
    // Send in the single standup thread
    await slackService.sendMessage(
      this.standupChannel,
      message,
      null,
      this.standupThreadTs
    );

    console.log(`Sent general prompt to ${session.userName}`);
    this._setUserTimeout(session);
  }

  /**
   * Set timeout for a specific user's response
   */
  _setUserTimeout(session) {
    this._clearUserTimeout(session.userId);
    
    const timeout = setTimeout(async () => {
      await this._handleUserInitialTimeout(session);
    }, RESPONSE_TIMEOUT_MS);
    
    this.userTimeouts.set(session.userId, timeout);
  }

  /**
   * Clear timeout for a specific user
   */
  _clearUserTimeout(userId) {
    const existingTimeout = this.userTimeouts.get(userId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.userTimeouts.delete(userId);
    }
  }

  /**
   * Handle initial timeout for a specific user (2 minutes)
   */
  async _handleUserInitialTimeout(session) {
    if (session.state === StandupState.COMPLETED ||
        session.state === StandupState.SKIPPED ||
        session.state === StandupState.NEEDS_FOLLOWUP) {
      return;
    }
    
    console.log(`⏰ Initial timeout (2 min) for ${session.userName}, sending reminder...`);
    
    const reminderMsg = `<@${session.userId}> - Still waiting for your update. Please respond in the next minute if you're available.`;
    await slackService.sendMessage(
      this.standupChannel,
      reminderMsg,
      null,
      this.standupThreadTs
    );
    
    const timeout = setTimeout(async () => {
      await this._handleUserFinalTimeout(session);
    }, FINAL_TIMEOUT_MS);
    
    this.userTimeouts.set(session.userId, timeout);
  }

  /**
   * Handle final timeout for a specific user (3 minutes total)
   * Marks them as unavailable and moves to the next developer
   */
  async _handleUserFinalTimeout(session) {
    if (session.state === StandupState.COMPLETED ||
        session.state === StandupState.SKIPPED ||
        session.state === StandupState.NEEDS_FOLLOWUP) {
      return;
    }
    
    console.log(`⏰ Final timeout (3 min) for ${session.userName}, marking as unavailable and moving on`);
    
    session.state = StandupState.SKIPPED;
    
    // Mark as unavailable so we don't ask them again
    this.unavailableDevelopers.add(session.userId);
    
    const timeoutMsg = `⏰ *${session.userName}* is not available right now. Moving on...`;
    await slackService.sendMessage(
      this.standupChannel,
      timeoutMsg,
      null,
      this.standupThreadTs
    );
    
    // Move to the next developer in the queue
    await this._askNextDeveloper();
  }

  /**
   * Check if all developers have completed their standup
   * (Called when a developer completes, not on timeout - timeout moves to next)
   */
  _checkStandupCompletion() {
    // Only complete if there's no current developer and queue is empty
    if (this.currentDeveloper === null && this.developerQueue.length === 0) {
      this._completeStandup();
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
    if (this.standupPhase !== StandupPhase.IN_PROGRESS) {
      return null;
    }

    const session = this.sessions.get(userId);
    
    if (!session) {
      return null;
    }

    // Verify the message is in the standup thread
    if (threadTs !== this.standupThreadTs) {
      // Message is not in the standup thread - ignore or redirect
      return null;
    }

    // Check if this user is the current developer being asked
    if (this.currentDeveloper && this.currentDeveloper.userId !== userId) {
      // Someone else is responding while we're waiting for currentDeveloper
      // Check if they're providing info about the current developer's availability
      const isAbsenceReport = await this._checkIfAbsenceReport(message, this.currentDeveloper);
      
      if (isAbsenceReport) {
        // Mark current developer as unavailable and move on
        return await this._handleAbsenceReport(userId, this.currentDeveloper, message);
      }
      
      // Not an absence report - check their own status
      if (session.state === StandupState.COMPLETED) {
        return `Thanks <@${userId}>, you've already completed your standup! 🎉`;
      }
      if (session.state === StandupState.NOT_STARTED) {
        return `Hey <@${userId}>, please wait for your turn! I'll ask you shortly. 😊`;
      }
      // If they're skipped or needs followup, ignore
      return null;
    }

    return await this._processUserResponse(session, message);
  }

  /**
   * Check if a message is reporting someone's absence
   * @param {string} message - The message text
   * @param {Object} targetSession - The session of the person being asked
   * @returns {Promise<boolean>} True if this is an absence report
   */
  async _checkIfAbsenceReport(message, targetSession) {
    const messageLower = message.toLowerCase();
    const targetName = (targetSession.userName || '').toLowerCase();
    const targetFirstName = targetName.split(' ')[0];
    
    // Common absence indicators
    const absenceKeywords = [
      'not here', 'not available', 'not around', 'not in', 'not present',
      'is away', 'is out', 'is off', 'is absent', 'is sick', 'is on leave',
      'on leave', 'on sick leave', 'on vacation', 'on holiday', 'on pto',
      'won\'t be', 'will not be', 'can\'t make', 'cannot make',
      'stepped out', 'stepped away', 'busy', 'in a meeting',
      'he\'s not', 'she\'s not', 'they\'re not', 'he is not', 'she is not',
      'move on', 'skip', 'next person', 'not coming'
    ];
    
    // Check if message mentions the target person and contains absence keywords
    const mentionsTarget = messageLower.includes(targetFirstName) ||
                          messageLower.includes(targetName) ||
                          messageLower.includes('he') ||
                          messageLower.includes('she') ||
                          messageLower.includes('they');
    
    const hasAbsenceKeyword = absenceKeywords.some(keyword => messageLower.includes(keyword));
    
    return mentionsTarget && hasAbsenceKeyword;
  }

  /**
   * Extract the name of the person who is blocking from a blocker description
   * Looks for patterns like "blocked on John", "waiting for Sarah", "need input from Mike"
   * @param {string} blockerDescription - The blocker text
   * @param {Object} session - The session of the person who is blocked
   * @returns {string|null} Name of the blocking person, or null if not identifiable
   */
  _extractBlockingPerson(blockerDescription, session) {
    const blockerLower = blockerDescription.toLowerCase();
    
    // Get all team member names for matching FIRST
    const teamMemberNames = [];
    for (const [userId, memberSession] of this.sessions) {
      if (userId !== session.userId) {
        const name = memberSession.userName || '';
        const firstName = name.split(' ')[0];
        if (firstName) {
          teamMemberNames.push({
            fullName: name,
            firstName: firstName.toLowerCase(),
            fullNameLower: name.toLowerCase(),
            session: memberSession
          });
        }
      }
    }
    
    // First, check if any team member name is mentioned directly in the blocker
    // This handles cases like "@Natesh Hegde" or "Natesh Hegde" or just "Natesh"
    for (const member of teamMemberNames) {
      // Check for full name (with or without @)
      if (blockerLower.includes(member.fullNameLower) ||
          blockerLower.includes('@' + member.fullNameLower) ||
          blockerLower.includes(member.firstName)) {
        return member.fullName;
      }
    }
    
    // Patterns that indicate a person is blocking (with support for multi-word names and @ mentions)
    const blockingPatterns = [
      /blocked (?:on|by) @?([A-Za-z][\w\s]+?)(?:\s+(?:the|for|,|\.)|$)/i,
      /waiting (?:on|for) @?([A-Za-z][\w\s]+?)(?:\s+(?:the|for|,|\.)|$)/i,
      /need(?:s|ing)? (?:input|review|approval|help|response) from @?([A-Za-z][\w\s]+?)(?:\s+(?:the|for|,|\.)|$)/i,
      /depends? on @?([A-Za-z][\w\s]+?)(?:\s+(?:the|for|,|\.)|$)/i,
      /@?([A-Za-z][\w\s]+?) (?:needs? to|has to|should|must) (?:review|approve|respond|help)/i,
      /@?([A-Za-z][\w\s]+?)'s (?:review|approval|input|response)/i,
      /pending (?:on|from) @?([A-Za-z][\w\s]+?)(?:\s+(?:the|for|,|\.)|$)/i,
      /@?([A-Za-z][\w\s]+?) is blocking/i,
      /@?([A-Za-z][\w\s]+?) hasn't (?:responded|reviewed|approved)/i
    ];
    
    // Try each pattern
    for (const pattern of blockingPatterns) {
      const match = blockerDescription.match(pattern);
      if (match && match[1]) {
        const extractedName = match[1].trim().toLowerCase();
        
        // Check if extracted name matches any team member
        for (const member of teamMemberNames) {
          if (member.firstName === extractedName ||
              member.fullNameLower === extractedName ||
              member.fullNameLower.includes(extractedName) ||
              extractedName.includes(member.firstName)) {
            return member.fullName;
          }
        }
        
        // If no exact match, return the extracted name anyway (might be partial)
        // Only if it looks like a name (not common words)
        const commonWords = ['the', 'a', 'an', 'this', 'that', 'it', 'them', 'someone', 'anyone', 'team'];
        if (!commonWords.includes(extractedName) && extractedName.length > 2) {
          return extractedName;
        }
      }
    }
    
    return null;
  }

  /**
   * Track a blocker for later - store it so we can ask the blocking person about it
   * @param {string} blockerDescription - Description of the blocker
   * @param {Object} session - Session of the blocked person
   * @param {string} knownBlockingPerson - Optional: already identified blocking person
   */
  _trackBlockerForLater(blockerDescription, session, knownBlockingPerson = null) {
    const blockingPerson = knownBlockingPerson || this._extractBlockingPerson(blockerDescription, session);
    if (blockingPerson) {
      // Store the blocker question for when the blocking person's turn comes
      if (!this.pendingBlockerQuestions.has(blockingPerson)) {
        this.pendingBlockerQuestions.set(blockingPerson, []);
      }
      
      // Check if we already have this blocker tracked
      const existingBlockers = this.pendingBlockerQuestions.get(blockingPerson);
      const alreadyTracked = existingBlockers.some(b =>
        b.blockedUser === session.userName && b.blockerDescription === blockerDescription
      );
      
      if (!alreadyTracked) {
        existingBlockers.push({
          blockedUser: session.userName,
          blockerDescription: blockerDescription,
          timestamp: new Date()
        });
        console.log(`📝 Noted blocker: ${session.userName} is blocked on ${blockingPerson}: "${blockerDescription}"`);
      }
    }
  }

  /**
   * Extract blockers directly from the user's raw message
   * Handles patterns like "I'm blocked on @Name" or "blocked on Name for task X"
   * @param {string} message - The raw user message
   * @param {Object} session - The user's session
   * @returns {Array} Array of {description, blockingPerson}
   */
  _extractBlockersFromMessage(message, session) {
    const blockers = [];
    const messageLower = message.toLowerCase();
    
    // Get all team member names for matching
    const teamMemberNames = [];
    for (const [userId, memberSession] of this.sessions) {
      if (userId !== session.userId) {
        const name = memberSession.userName || '';
        const firstName = name.split(' ')[0];
        if (firstName) {
          teamMemberNames.push({
            fullName: name,
            firstName: firstName.toLowerCase(),
            fullNameLower: name.toLowerCase()
          });
        }
      }
    }
    
    // Patterns to detect blockers with person names
    const blockerPatterns = [
      /(?:i'm|i am|we're|we are)?\s*blocked (?:on|by) @?([A-Za-z][\w\s]+?)(?:\s+(?:for|on|the|,|\.)|$)/gi,
      /waiting (?:on|for) @?([A-Za-z][\w\s]+?)(?:\s+(?:for|to|the|,|\.)|$)/gi,
      /need(?:s|ing)?\s+(?:input|review|approval|help|response)\s+from @?([A-Za-z][\w\s]+?)(?:\s+(?:for|on|the|,|\.)|$)/gi,
      /depends?\s+on @?([A-Za-z][\w\s]+?)(?:\s+(?:for|the|,|\.)|$)/gi,
      /pending\s+(?:on|from) @?([A-Za-z][\w\s]+?)(?:\s+(?:for|the|,|\.)|$)/gi
    ];
    
    for (const pattern of blockerPatterns) {
      let match;
      while ((match = pattern.exec(message)) !== null) {
        const extractedName = match[1].trim();
        
        // Try to match to a team member
        for (const member of teamMemberNames) {
          const extractedLower = extractedName.toLowerCase();
          if (member.firstName === extractedLower ||
              member.fullNameLower === extractedLower ||
              member.fullNameLower.includes(extractedLower) ||
              extractedLower.includes(member.firstName)) {
            
            // Found a match - create blocker description
            const description = `Blocked on ${member.fullName}`;
            blockers.push({
              description: description,
              blockingPerson: member.fullName
            });
            break;
          }
        }
      }
    }
    
    return blockers;
  }

  /**
   * Handle when someone reports another developer's absence
   * @param {string} reporterUserId - User ID of the person reporting
   * @param {Object} absentSession - Session of the absent developer
   * @param {string} message - The original message
   * @returns {Promise<string|null>} Response message
   */
  async _handleAbsenceReport(reporterUserId, absentSession, message) {
    console.log(`📢 ${reporterUserId} reported that ${absentSession.userName} is not available`);
    
    // Clear timeout for the absent developer
    this._clearUserTimeout(absentSession.userId);
    
    // Mark as skipped and unavailable
    absentSession.state = StandupState.SKIPPED;
    this.unavailableDevelopers.add(absentSession.userId);
    
    // Send acknowledgment in the thread
    const ackMsg = `Got it, thanks for letting me know! Moving on from *${absentSession.userName}*.`;
    await slackService.sendMessage(
      this.standupChannel,
      ackMsg,
      null,
      this.standupThreadTs
    );
    
    // Clear current developer and move to next
    this.currentDeveloper = null;
    
    // Small delay before asking next developer
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Ask the next developer
    await this._askNextDeveloper();
    
    return null; // Already sent acknowledgment
  }

  /**
   * Process response from a user based on current state
   */
  async _processUserResponse(session, message) {
    this._clearUserTimeout(session.userId);

    // Track conversation
    session.conversationHistory.push({
      role: 'user',
      content: message,
      timestamp: new Date(),
    });

    if (session.state === StandupState.COMPLETED) {
      return "You've already completed your standup for today! 🎉";
    }

    if (session.state === StandupState.SKIPPED || session.state === StandupState.NEEDS_FOLLOWUP) {
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
      this._setUserTimeout(session);
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

      if (update.newStatus) {
        await jiraService.updateTicketStatus(update.ticketKey, update.newStatus);
        if (update.progressNote) {
          const comment = `[Standup Update] ${update.progressNote}`;
          await jiraService.addComment(update.ticketKey, comment);
        }
      }
    }

    // Track blockers and store them for asking the blocking person later
    // First, check the LLM analysis blockers
    if (analysis.blockers && analysis.blockers.length > 0) {
      session.blockers.push(...analysis.blockers);
      
      // Try to identify who is blocking and store for later
      for (const blocker of analysis.blockers) {
        this._trackBlockerForLater(blocker, session);
      }
    }
    
    // Also extract blockers directly from the raw message (in case LLM missed them)
    // This handles cases like "I'm blocked on @Natesh Hegde"
    const rawBlockers = this._extractBlockersFromMessage(message, session);
    for (const rawBlocker of rawBlockers) {
      // Only add if not already tracked
      if (!session.blockers.includes(rawBlocker.description)) {
        session.blockers.push(rawBlocker.description);
        this._trackBlockerForLater(rawBlocker.description, session, rawBlocker.blockingPerson);
      }
    }

    // Route to appropriate handler based on state
    switch (session.state) {
      case StandupState.ASKING_IN_PROGRESS:
      case StandupState.IN_PROGRESS_FOLLOWUP:
        return await this._handleInProgressResponse(session, message, analysis);
      
      case StandupState.ASKING_TODO:
      case StandupState.TODO_FOLLOWUP:
        return await this._handleTodoResponse(session, message, analysis);
      
      default:
        return await this._completeDeveloperStandup(session, analysis);
    }
  }

  /**
   * Handle response about in-progress tasks
   */
  async _handleInProgressResponse(session, message, analysis) {
    session.inProgressExchangeCount++;
    
    // Check if response is satisfactory
    const isSatisfactory = this._isResponseSatisfactory(analysis, 'in_progress');
    
    if (isSatisfactory) {
      // Good response - move to todo tasks if any (unless skipTodoItems is set)
      if (session.todoTasks.length > 0 && !session.skipTodoItems) {
        session.state = StandupState.ASKING_TODO;
        
        // Send acknowledgment and ask about todo
        const ackMsg = analysis.summary
          ? `Thanks! ${analysis.summary}\n\n`
          : 'Thanks for the update!\n\n';
        
        const todoCount = session.todoTasks.length;
        const todoQuestion = `Now about your *${todoCount} to-do task${todoCount > 1 ? 's' : ''}* - ` +
          `which ones are you planning to pick up today?`;
        
        const fullMsg = ackMsg + todoQuestion;
        
        // Send in the thread
        await slackService.sendMessage(
          this.standupChannel,
          fullMsg,
          null,
          this.standupThreadTs
        );
        
        this._setUserTimeout(session);
        return null; // Already sent
      } else {
        // No todo tasks OR skipTodoItems is set (too many in-progress tasks) - complete standup
        return await this._completeDeveloperStandup(session, analysis);
      }
    }
    
    // Response not satisfactory - check if we've hit the limit
    if (session.inProgressExchangeCount >= MAX_IN_PROGRESS_EXCHANGES) {
      session.inProgressSatisfactory = false;
      session.unsatisfactoryReasons.push('in-progress tasks update incomplete');
      
      // Move to todo tasks if any (unless skipTodoItems is set), otherwise mark for follow-up
      if (session.todoTasks.length > 0 && !session.skipTodoItems) {
        session.state = StandupState.ASKING_TODO;
        
        const todoCount = session.todoTasks.length;
        const moveOnMsg = `Alright, let's move on. About your *${todoCount} to-do task${todoCount > 1 ? 's' : ''}* - ` +
          `which ones are you planning to pick up today?`;
        
        // Send in the thread
        await slackService.sendMessage(
          this.standupChannel,
          moveOnMsg,
          null,
          this.standupThreadTs
        );
        
        this._setUserTimeout(session);
        return null; // Already sent
      } else {
        // No todo tasks OR skipTodoItems is set, and in-progress not satisfactory
        return await this._handleUnsatisfactoryCompletion(session);
      }
    }
    
    // Ask follow-up (still within limit)
    session.state = StandupState.IN_PROGRESS_FOLLOWUP;
    
    // Generate a specific follow-up question
    const followUpQuestion = this._generateFollowUpQuestion(session, analysis, 'in_progress');
    
    // Send in the thread
    await slackService.sendMessage(
      this.standupChannel,
      followUpQuestion,
      null,
      this.standupThreadTs
    );
    
    this._setUserTimeout(session);
    return null; // Already sent
  }

  /**
   * Handle response about todo tasks
   */
  async _handleTodoResponse(session, message, analysis) {
    session.todoExchangeCount++;
    
    // Check if response is satisfactory
    const isSatisfactory = this._isResponseSatisfactory(analysis, 'todo');
    
    if (isSatisfactory) {
      // Good response - complete standup
      return await this._completeDeveloperStandup(session, analysis);
    }
    
    // Response not satisfactory - check if we've hit the limit
    if (session.todoExchangeCount >= MAX_TODO_EXCHANGES) {
      session.todoSatisfactory = false;
      session.unsatisfactoryReasons.push('to-do tasks planning incomplete');
      
      // Check if we need follow-up
      if (!session.inProgressSatisfactory || !session.todoSatisfactory) {
        return await this._handleUnsatisfactoryCompletion(session);
      }
      
      return await this._completeDeveloperStandup(session, analysis);
    }
    
    // Ask follow-up (still within limit)
    session.state = StandupState.TODO_FOLLOWUP;
    
    const followUpQuestion = this._generateFollowUpQuestion(session, analysis, 'todo');
    
    // Send in the thread
    await slackService.sendMessage(
      this.standupChannel,
      followUpQuestion,
      null,
      this.standupThreadTs
    );
    
    this._setUserTimeout(session);
    return null; // Already sent
  }

  /**
   * Check if a response is satisfactory
   */
  _isResponseSatisfactory(analysis, phase) {
    // A response is satisfactory if:
    // 1. It has task updates with progress notes or timelines
    // 2. It's not flagged as needing clarification
    // 3. It provides actionable information
    
    if (!analysis) return false;
    
    const hasUpdates = analysis.taskUpdates && analysis.taskUpdates.length > 0;
    const hasProgressInfo = analysis.taskUpdates?.some(u => u.progressNote || u.timeline);
    const needsClarification = analysis.needsClarification || false;
    const hasSummary = analysis.summary && analysis.summary.length > 20;
    
    // For in-progress: need progress info or clear status
    if (phase === 'in_progress') {
      return (hasUpdates && hasProgressInfo) || (hasSummary && !needsClarification);
    }
    
    // For todo: need to know what they're planning
    if (phase === 'todo') {
      return hasUpdates || (hasSummary && !needsClarification);
    }
    
    return hasSummary;
  }

  /**
   * Generate a follow-up question based on what's missing
   */
  _generateFollowUpQuestion(session, analysis, phase) {
    if (phase === 'in_progress') {
      // Check what's missing from in-progress update
      if (!analysis.taskUpdates || analysis.taskUpdates.length === 0) {
        return `Could you share more details about your in-progress work? ` +
          `For example: current status, any blockers, or expected completion?`;
      }
      
      const missingTimeline = analysis.taskUpdates.filter(u => !u.timeline);
      if (missingTimeline.length > 0) {
        return `Thanks! Are you on track with the timeline? Any estimated completion dates?`;
      }
      
      return `Got it. Any blockers or dependencies I should know about?`;
    }
    
    if (phase === 'todo') {
      if (!analysis.taskUpdates || analysis.taskUpdates.length === 0) {
        return `Which specific tasks are you planning to start today? ` +
          `Any priorities or concerns about them?`;
      }
      
      return `Thanks! Any dependencies or help needed to get started on those?`;
    }
    
    return `Could you elaborate a bit more?`;
  }

  /**
   * Handle completion when responses were unsatisfactory and move to next developer
   */
  async _handleUnsatisfactoryCompletion(session) {
    session.state = StandupState.NEEDS_FOLLOWUP;
    this.needsFollowup.push(session);
    
    this._clearUserTimeout(session.userId);
    
    const reasons = session.unsatisfactoryReasons.join(' and ');
    const message = `Thanks *${session.userName}*! I noticed we didn't fully cover ${reasons}. ` +
      `Please connect with me separately so we can discuss in more detail. 🤝`;
    
    // Send message in the thread
    await slackService.sendMessage(
      this.standupChannel,
      message,
      null,
      this.standupThreadTs
    );

    console.log(`⚠️ ${session.userName} needs follow-up`);

    // Clear current developer and move to next
    this.currentDeveloper = null;
    
    // Small delay before asking next developer
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Ask the next developer
    await this._askNextDeveloper();
    
    // Return null since we already sent the message
    return null;
  }

  /**
   * Complete a developer's standup and move to the next developer
   */
  async _completeDeveloperStandup(session, analysis) {
    session.state = StandupState.COMPLETED;
    session.completedAt = new Date();
    
    this._clearUserTimeout(session.userId);

    const completionMsg = this._generateCompletionMessage(session, analysis);

    // Send completion message in the thread
    await slackService.sendMessage(
      this.standupChannel,
      completionMsg,
      null,
      this.standupThreadTs
    );

    console.log(`✅ ${session.userName} completed standup`);

    // Clear current developer and move to next
    this.currentDeveloper = null;
    
    // Small delay before asking next developer
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Ask the next developer
    await this._askNextDeveloper();

    // Return null since we already sent the message
    return null;
  }

  /**
   * Generate a completion message for the user
   * Note: We don't mention ticket IDs in messages to keep them clean
   */
  _generateCompletionMessage(session, analysis) {
    const msgParts = ['✅ Thanks for your standup update!'];

    if (analysis && analysis.summary) {
      msgParts.push(`\n\n*Summary:* ${analysis.summary}`);
    }

    if (session.blockers && session.blockers.length > 0) {
      msgParts.push(`\n\n🚧 *Blockers noted:* ${session.blockers.join(', ')}`);
      msgParts.push("\nI'll flag these for the team's attention.");
    }

    const statusUpdates = (session.updates || []).filter(u => u.newStatus);
    if (statusUpdates.length > 0) {
      // Don't mention ticket IDs - just confirm updates were made
      const updateCount = statusUpdates.length;
      msgParts.push(`\n\n📝 *JIRA:* Updated ${updateCount} task${updateCount > 1 ? 's' : ''} with your progress.`);
    }

    return msgParts.join('');
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
          text: `*${today}*\n\nGood morning team! Time for our daily standup.\n\n📝 *I'll ask each of you one by one - please reply in this thread when it's your turn.*`,
        },
      },
      { type: 'divider' },
    ];
  }

  /**
   * Complete the entire standup session
   */
  async _completeStandup() {
    console.log('All developers processed, completing standup...');
    
    this.standupPhase = StandupPhase.COMPLETED;

    // Clear all remaining timeouts
    for (const [userId, timeout] of this.userTimeouts) {
      clearTimeout(timeout);
    }
    this.userTimeouts.clear();

    await this._sendStandupSummary();
  }

  /**
   * Send the standup summary to the channel
   */
  async _sendStandupSummary() {
    console.log('Generating standup summary...');

    const allUpdates = [];
    const allBlockers = [];
    const skippedMembers = [];
    const needsFollowupMembers = [];

    for (const session of this.sessions.values()) {
      if (session.state === StandupState.COMPLETED) {
        allUpdates.push({
          name: session.userName,
          updates: session.updates,
          blockers: session.blockers,
        });

        for (const blocker of session.blockers || []) {
          allBlockers.push({
            user: session.userName,
            blocker,
          });
        }
      } else if (session.state === StandupState.SKIPPED) {
        skippedMembers.push(session.userName);
      } else if (session.state === StandupState.NEEDS_FOLLOWUP) {
        needsFollowupMembers.push({
          name: session.userName,
          reasons: session.unsatisfactoryReasons,
        });
        // Still include their partial updates
        if (session.updates && session.updates.length > 0) {
          allUpdates.push({
            name: session.userName,
            updates: session.updates,
            blockers: session.blockers || [],
          });
        }
      }
    }

    // Generate summary with LLM
    let summary = 'Standup complete.';
    if (allUpdates.length > 0) {
      summary = await llmService.generateStandupSummary(allUpdates);
    }

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

    // Add needs-followup members section if any
    if (needsFollowupMembers.length > 0) {
      blocks.push({ type: 'divider' });
      let followupText = '*🤝 Need separate follow-up:*\n';
      for (const member of needsFollowupMembers) {
        followupText += `• ${member.name}`;
        if (member.reasons && member.reasons.length > 0) {
          followupText += ` (${member.reasons.join(', ')})`;
        }
        followupText += '\n';
      }
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: followupText,
        },
      });
    }

    // Add skipped members section if any
    if (skippedMembers.length > 0) {
      blocks.push({ type: 'divider' });
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*⏭️ Missed standup:* ${skippedMembers.join(', ')}`,
        },
      });
    }

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

    // Send summary in the standup thread
    await slackService.sendMessage(this.standupChannel, '📊 Standup Summary', blocks, this.standupThreadTs);

    console.log('Standup summary sent');
  }

  /**
   * Mark a user as on leave
   */
  markUserOnLeave(email, startDate, endDate, reason = null) {
    leaveService.addLeave(email, startDate, endDate, reason);
    console.log(`Marked ${email} on leave from ${startDate} to ${endDate}`);
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
      // Also mark as unavailable so they're not asked again
      this.unavailableDevelopers.add(userId);
      console.log(`Skipped standup for ${session.userName}: ${reason}`);
    }
  }

  /**
   * Get current standup phase
   */
  getStandupPhase() {
    return this.standupPhase;
  }

  /**
   * Get the standup thread timestamp
   */
  getStandupThreadTs() {
    return this.standupThreadTs;
  }

  /**
   * Reset the standup (for testing or manual reset)
   */
  reset() {
    for (const [userId, timeout] of this.userTimeouts) {
      clearTimeout(timeout);
    }
    this.userTimeouts.clear();
    
    this.sessions.clear();
    this.userIdToSession.clear();
    this.needsFollowup = [];
    this.developerQueue = [];
    this.currentDeveloper = null;
    this.unavailableDevelopers.clear();
    this.pendingBlockerQuestions.clear();
    this.standupThreadTs = null;
    this.standupPhase = StandupPhase.NOT_STARTED;
    this.standupDate = null;
    this.standupChannel = null;
    console.log('Standup workflow reset');
  }
}

export default new StandupWorkflow();
