/**
 * AI Engineering Manager - Main Application Entry Point
 *
 * A Slack-based standup automation tool with JIRA integration
 * and AI-powered conversation management using Ollama.
 */

import schedule from 'node-schedule';
import config, { validateConfig } from './config/index.js';
import slackService from './services/slackService.js';
import llmService from './services/llmService.js';
import standupWorkflow from './workflows/standupWorkflow.js';

console.log('='.repeat(50));
console.log('🤖 AI Engineering Manager');
console.log('='.repeat(50));

/**
 * Set up message handlers for Slack
 */
function setupMessageHandlers() {
  slackService.registerMessageHandler(async (message, say) => {
    const userId = message.user;
    const text = message.text || '';
    const channel = message.channel;
    const threadTs = message.thread_ts;
    const isMention = message.isMention || false;

    // Skip empty messages
    if (!text.trim()) {
      return;
    }

    // Handle commands when mentioned
    if (isMention) {
      await handleCommand(text, userId, channel, say);
      return;
    }

    // Handle standup responses
    const response = await standupWorkflow.handleUserMessage(
      userId,
      text,
      channel,
      threadTs
    );

    if (response) {
      await say({ text: response, thread_ts: threadTs || message.ts });
    }
  });
}

/**
 * Handle bot commands
 */
async function handleCommand(text, userId, channel, say) {
  const textLower = text.toLowerCase().trim();

  if (textLower.includes('start standup')) {
    await say('🚀 Starting daily standup...');
    await standupWorkflow.startDailyStandup();
  } else if (textLower.includes('status')) {
    const sessions = standupWorkflow.getAllSessions();
    if (sessions.size === 0) {
      await say('No active standup session.');
      return;
    }

    let completed = 0;
    for (const session of sessions.values()) {
      if (session.state === 'completed') completed++;
    }
    await say(`📊 Standup Status: ${completed}/${sessions.size} completed`);
  } else if (textLower.includes('help')) {
    const helpText = `*AI Engineering Manager Commands:*
• \`start standup\` - Start the daily standup
• \`status\` - Check standup completion status
• \`leave <email> <start_date> <end_date> [reason]\` - Mark someone on leave
• \`help\` - Show this help message

During standup, just reply with your updates and I'll:
• Track your progress
• Ask for timelines on To-Do/In-Progress tasks
• Update JIRA tickets automatically
• Keep the conversation focused on status updates`;
    await say(helpText);
  } else if (textLower.includes('leave')) {
    // Parse leave command: leave email@example.com 2024-03-20 2024-03-22 vacation
    const parts = text.split(/\s+/);
    const leaveIndex = parts.findIndex(p => p.toLowerCase() === 'leave');
    
    if (parts.length >= leaveIndex + 4) {
      try {
        const email = parts[leaveIndex + 1];
        const startDate = parts[leaveIndex + 2];
        const endDate = parts[leaveIndex + 3];
        const reason = parts.slice(leaveIndex + 4).join(' ') || null;

        // Validate date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
          await say('❌ Invalid date format. Use: `leave email@example.com YYYY-MM-DD YYYY-MM-DD [reason]`');
          return;
        }

        standupWorkflow.markUserOnLeave(email, startDate, endDate, reason);
        await say(`✅ Marked ${email} on leave from ${startDate} to ${endDate}`);
      } catch (error) {
        await say('❌ Invalid format. Use: `leave email@example.com YYYY-MM-DD YYYY-MM-DD [reason]`');
      }
    } else {
      await say('❌ Invalid format. Use: `leave email@example.com YYYY-MM-DD YYYY-MM-DD [reason]`');
    }
  } else {
    await say("I didn't understand that command. Try `help` to see available commands.");
  }
}

/**
 * Schedule the daily standup
 */
function scheduleStandup() {
  const { hour, minute } = config.standup.time;
  const timezone = config.standup.timezone;

  // Create a cron-like schedule rule
  // node-schedule uses: second minute hour dayOfMonth month dayOfWeek
  const rule = new schedule.RecurrenceRule();
  rule.hour = hour;
  rule.minute = minute;
  rule.tz = timezone;

  // Schedule for weekdays only (Monday-Friday)
  rule.dayOfWeek = [1, 2, 3, 4, 5];

  const job = schedule.scheduleJob(rule, async () => {
    console.log(`⏰ Scheduled standup triggered at ${new Date().toISOString()}`);
    await standupWorkflow.startDailyStandup();
  });

  console.log(`📅 Standup scheduled for ${hour}:${minute.toString().padStart(2, '0')} ${timezone} (Mon-Fri)`);
  
  // Log next scheduled time
  if (job.nextInvocation()) {
    console.log(`   Next standup: ${job.nextInvocation().toISOString()}`);
  }
}

/**
 * Validate setup
 */
async function validateSetup() {
  console.log('\n🔍 Validating setup...');

  // Check configuration
  const errors = validateConfig();
  if (errors.length > 0) {
    console.error('\n❌ Configuration errors:');
    for (const error of errors) {
      console.error(`   - ${error}`);
    }
    return false;
  }
  console.log('   ✅ Configuration valid');

  // Check Ollama model availability
  const modelAvailable = await llmService.checkModelAvailable();
  if (!modelAvailable) {
    console.error(`\n❌ Ollama model '${config.ollama.model}' is not available`);
    console.log(`   Run: ollama pull ${config.ollama.model}`);
    return false;
  }
  console.log(`   ✅ Ollama model '${config.ollama.model}' available`);

  console.log('\n✅ Setup validation passed!\n');
  return true;
}

/**
 * Main entry point
 */
async function main() {
  try {
    // Validate setup
    const isValid = await validateSetup();
    if (!isValid) {
      console.error('\n❌ Setup validation failed. Please check configuration.');
      process.exit(1);
    }

    // Initialize Slack service
    slackService.initialize();

    // Set up message handlers
    setupMessageHandlers();

    // Schedule daily standup
    scheduleStandup();

    // Log configuration
    console.log('📋 Configuration:');
    console.log(`   Standup Channel: ${config.slack.standupChannel}`);
    console.log(`   Standup Time: ${config.standup.time.hour}:${config.standup.time.minute.toString().padStart(2, '0')} ${config.standup.timezone}`);
    console.log(`   LLM Model: ${config.ollama.model}`);
    console.log(`   JIRA Project: ${config.jira.projectKey}`);

    // Start Slack bot
    console.log('\n🚀 Starting Slack bot...');
    await slackService.start();

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down...');
  process.exit(0);
});

// Start the application
main();
