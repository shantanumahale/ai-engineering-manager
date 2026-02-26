/**
 * LLM Service using Ollama
 * Handles all AI/LLM interactions for:
 * - Analyzing standup responses
 * - Extracting task updates
 * - Generating follow-up questions
 * - Keeping conversations focused
 */

import axios from 'axios';
import config from '../config/index.js';

const SYSTEM_PROMPT = `You are an AI Engineering Manager assistant facilitating daily standups.
Your role is to:
1. Keep the standup focused on status updates - NOT technical discussions or HLD
2. Extract task updates from developer responses
3. Ask for timelines on To-Do and In-Progress tasks
4. Identify blockers
5. Gently redirect off-topic conversations back to standup format

When a developer goes off-topic into technical discussions, politely redirect them:
"That's a great point for a separate discussion! For now, let's focus on your task status. We can schedule a technical discussion later."

Always be professional, supportive, and efficient. Keep responses concise.`;

const ANALYSIS_PROMPT = `Analyze the following standup response from a developer.

Developer's current tasks:
{tasksContext}

Developer's response:
{response}

Extract the following information and respond in JSON format ONLY (no other text):
{
    "taskUpdates": [
        {
            "ticketKey": "TICKET-123",
            "newStatus": "In Progress" or "Done" or "Blocked" or null,
            "progressNote": "Brief note about progress",
            "blocker": "Description of blocker if any" or null,
            "timeline": "Estimated completion time if mentioned" or null
        }
    ],
    "blockers": ["List of any blockers mentioned"],
    "isOffTopic": true/false,
    "offTopicReason": "Reason if off-topic (e.g., 'discussing HLD', 'unrelated topic')" or null,
    "followUpQuestions": ["Questions to ask for missing info like timelines"],
    "summary": "Brief summary of the update"
}

Rules:
- If developer discusses technical implementation details or HLD, mark as isOffTopic
- If no timeline given for To-Do or In-Progress tasks, add follow-up question
- Extract specific ticket updates when mentioned
- Keep summary concise (1-2 sentences)`;

class LLMService {
  constructor() {
    this.baseUrl = config.ollama.baseUrl.replace(/\/$/, '');
    this.model = config.ollama.model;
    this.timeout = config.ollama.timeout;
  }

  /**
   * Make a request to Ollama API
   * @param {string} prompt - The user prompt
   * @param {string} systemPrompt - Optional system prompt
   * @returns {Promise<string>} Generated response
   */
  async callOllama(prompt, systemPrompt = null) {
    const url = `${this.baseUrl}/api/generate`;

    const payload = {
      model: this.model,
      prompt,
      stream: false,
      options: {
        temperature: 0.7,
        top_p: 0.9,
      },
    };

    if (systemPrompt) {
      payload.system = systemPrompt;
    }

    try {
      console.log(`Calling Ollama with model ${this.model}...`);
      const response = await axios.post(url, payload, {
        timeout: this.timeout,
      });

      return response.data.response || '';
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        console.error('Ollama request timed out');
      } else {
        console.error('Ollama API error:', error.message);
      }
      throw error;
    }
  }

  /**
   * Analyze a developer's standup response
   * @param {string} response - The developer's message
   * @param {string} tasksContext - Context about their current tasks
   * @returns {Promise<Object>} Analysis result
   */
  async analyzeStandupResponse(response, tasksContext) {
    const prompt = ANALYSIS_PROMPT
      .replace('{tasksContext}', tasksContext)
      .replace('{response}', response);

    try {
      const result = await this.callOllama(prompt, SYSTEM_PROMPT);

      // Parse JSON from response
      const jsonStart = result.indexOf('{');
      const jsonEnd = result.lastIndexOf('}') + 1;

      if (jsonStart !== -1 && jsonEnd > jsonStart) {
        const jsonStr = result.substring(jsonStart, jsonEnd);
        const data = JSON.parse(jsonStr);

        return {
          taskUpdates: data.taskUpdates || [],
          blockers: data.blockers || [],
          isOffTopic: data.isOffTopic || false,
          offTopicReason: data.offTopicReason || null,
          followUpQuestions: data.followUpQuestions || [],
          summary: data.summary || 'Update received.',
        };
      }

      console.warn('Could not find JSON in LLM response, using defaults');
      return {
        taskUpdates: [],
        blockers: [],
        isOffTopic: false,
        offTopicReason: null,
        followUpQuestions: [],
        summary: 'Update received.',
      };
    } catch (error) {
      console.error('Error analyzing standup response:', error.message);
      return {
        taskUpdates: [],
        blockers: [],
        isOffTopic: false,
        offTopicReason: null,
        followUpQuestions: [],
        summary: 'Update received.',
      };
    }
  }

  /**
   * Generate a message to redirect off-topic conversation
   * @param {string} reason - Why the message is off-topic
   * @param {string} originalMessage - The original off-topic message
   * @returns {Promise<string>} Redirect message
   */
  async generateRedirectMessage(reason, originalMessage) {
    const prompt = `The developer has gone off-topic during standup. Generate a polite redirect message.

Off-topic reason: ${reason}
Original message: ${originalMessage.substring(0, 500)}

Generate a brief, friendly message that:
1. Acknowledges their point
2. Suggests discussing it separately
3. Redirects back to standup status updates

Keep it under 2 sentences.`;

    try {
      return await this.callOllama(prompt, SYSTEM_PROMPT);
    } catch (error) {
      console.error('Error generating redirect message:', error.message);
      return "That's a great point! Let's discuss that separately. For now, could you share your task status updates?";
    }
  }

  /**
   * Generate a follow-up question
   * @param {string} developerName - Name of the developer
   * @param {string} missingInfo - What information is missing
   * @param {string} tasks - Context about their tasks
   * @returns {Promise<string>} Follow-up question
   */
  async generateFollowUp(developerName, missingInfo, tasks) {
    const prompt = `Generate a follow-up question for the standup.

Context:
- Developer: ${developerName}
- Missing information: ${missingInfo}
- Current tasks: ${tasks}

Generate a brief, friendly question to get the missing information.
Keep it conversational and under 1-2 sentences.`;

    try {
      return await this.callOllama(prompt, SYSTEM_PROMPT);
    } catch (error) {
      console.error('Error generating follow-up:', error.message);
      return `Could you also share ${missingInfo}?`;
    }
  }

  /**
   * Generate a summary of all standup updates
   * @param {Array} allUpdates - List of all developer updates
   * @returns {Promise<string>} Summary message
   */
  async generateStandupSummary(allUpdates) {
    const prompt = `Generate a brief standup summary for the team.

Updates received:
${JSON.stringify(allUpdates, null, 2)}

Create a concise summary that includes:
1. Overall team progress
2. Key blockers that need attention
3. Any items needing follow-up

Keep it under 5 bullet points.`;

    try {
      return await this.callOllama(prompt, SYSTEM_PROMPT);
    } catch (error) {
      console.error('Error generating summary:', error.message);
      return 'Standup complete. Please review individual updates above.';
    }
  }

  /**
   * Check if the configured Ollama model is available
   * @returns {Promise<boolean>} True if model is available
   */
  async checkModelAvailable() {
    try {
      const url = `${this.baseUrl}/api/tags`;
      const response = await axios.get(url, { timeout: 10000 });

      const models = response.data.models || [];
      const modelNames = models.map(m => m.name || '');

      // Check if our model is in the list
      for (const name of modelNames) {
        if (this.model.includes(name) || name.includes(this.model)) {
          console.log(`Model ${this.model} is available`);
          return true;
        }
      }

      console.warn(`Model ${this.model} not found. Available: ${modelNames.join(', ')}`);
      return false;
    } catch (error) {
      console.error('Failed to check model availability:', error.message);
      return false;
    }
  }
}

export default new LLMService();
