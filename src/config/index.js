/**
 * Configuration module for AI Engineering Manager
 * All settings are loaded from environment variables or defaults
 */

import dotenv from 'dotenv';
dotenv.config();

const config = {
  // ==================
  // JIRA Configuration
  // ==================
  jira: {
    baseUrl: process.env.JIRA_BASE_URL || '',
    email: process.env.JIRA_EMAIL || '',
    apiToken: process.env.JIRA_API_TOKEN || '',
    projectKey: process.env.JIRA_PROJECT_KEY || '',
  },

  // ===================
  // Slack Configuration
  // ===================
  slack: {
    botToken: process.env.SLACK_BOT_TOKEN || '',
    appToken: process.env.SLACK_APP_TOKEN || '',
    signingSecret: process.env.SLACK_SIGNING_SECRET || '',
    standupChannel: process.env.SLACK_STANDUP_CHANNEL || '#product-x-engineers',
  },

  // ====================
  // Ollama Configuration
  // ====================
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'llama3.3:70b',
    timeout: parseInt(process.env.OLLAMA_TIMEOUT || '120000', 10), // in milliseconds
  },

  // ======================
  // Standup Configuration
  // ======================
  standup: {
    // ⏰ SET YOUR STANDUP TIME HERE (IST - 24 hour format)
    // Format: { hour: HH, minute: MM }
    time: {
      hour: parseInt(process.env.STANDUP_HOUR || '9', 10),   // 9 AM IST
      minute: parseInt(process.env.STANDUP_MINUTE || '30', 10), // 30 minutes
    },
    // Timezone for scheduling (IST)
    timezone: 'Asia/Kolkata',
  },

  // ===================
  // App Configuration
  // ===================
  app: {
    debug: process.env.DEBUG === 'true',
    dataDir: process.env.DATA_DIR || './data',
  },
};

/**
 * Validate required configuration
 * @returns {string[]} Array of error messages for missing config
 */
export function validateConfig() {
  const errors = [];

  // JIRA validation
  if (!config.jira.baseUrl) errors.push('JIRA_BASE_URL is required');
  if (!config.jira.email) errors.push('JIRA_EMAIL is required');
  if (!config.jira.apiToken) errors.push('JIRA_API_TOKEN is required');
  if (!config.jira.projectKey) errors.push('JIRA_PROJECT_KEY is required');

  // Slack validation
  if (!config.slack.botToken) errors.push('SLACK_BOT_TOKEN is required');
  if (!config.slack.appToken) errors.push('SLACK_APP_TOKEN is required');
  if (!config.slack.signingSecret) errors.push('SLACK_SIGNING_SECRET is required');

  return errors;
}

export default config;
