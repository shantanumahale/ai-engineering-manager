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
  // LLM Configuration
  // ====================
  // Provider: 'openai', 'anthropic', or 'ollama'
  llm: {
    provider: process.env.LLM_PROVIDER || 'anthropic', // Default to Anthropic for org setup
  },

  // ====================
  // Anthropic Configuration
  // ====================
  anthropic: {
    baseUrl: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com', // Custom base URL for org proxies
    apiKey: process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY || '',
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514', // Default model
    timeout: parseInt(process.env.ANTHROPIC_TIMEOUT || '60000', 10), // 60 seconds
  },

  // ====================
  // OpenAI Configuration
  // ====================
  openai: {
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1', // Custom base URL for org proxies
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini', // Cost-effective and capable
    timeout: parseInt(process.env.OPENAI_TIMEOUT || '60000', 10), // 60 seconds
  },

  // ====================
  // Ollama Configuration (for local models)
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
    // Maximum back-and-forth conversations per developer before offering 1-1 follow-up
    maxConversations: parseInt(process.env.STANDUP_MAX_CONVERSATIONS || '3', 10),
    // Team members to exclude from standup (non-developers like EM, PM)
    // Comma-separated list of names or emails
    excludedMembers: (process.env.STANDUP_EXCLUDED_MEMBERS || 'Keshav,Sushma').split(',').map(s => s.trim().toLowerCase()),
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
