/**
 * LLM Service - Supports OpenAI and Ollama
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
    "needsClarification": true/false,
    "followUpQuestions": ["Questions to ask for missing info like timelines"],
    "summary": "Brief summary of the update"
}

Rules:
- If developer discusses technical implementation details or HLD, mark as isOffTopic
- If no timeline given for To-Do or In-Progress tasks, add follow-up question
- Set needsClarification to true if the response is vague, incomplete, or doesn't provide actionable info
- Extract specific ticket updates when mentioned
- Keep summary concise (1-2 sentences)`;

class LLMService {
  constructor() {
    this.provider = config.llm.provider;
    
    if (this.provider === 'anthropic') {
      this.apiKey = config.anthropic.apiKey;
      this.model = config.anthropic.model;
      this.timeout = config.anthropic.timeout;
      this.baseUrl = config.anthropic.baseUrl.replace(/\/$/, '');
    } else if (this.provider === 'openai') {
      this.apiKey = config.openai.apiKey;
      this.model = config.openai.model;
      this.timeout = config.openai.timeout;
      this.baseUrl = config.openai.baseUrl || 'https://api.openai.com/v1';
    } else {
      // Ollama (local)
      this.baseUrl = config.ollama.baseUrl.replace(/\/$/, '');
      this.model = config.ollama.model;
      this.timeout = config.ollama.timeout;
    }
    
    console.log(`LLM Service initialized with provider: ${this.provider}, model: ${this.model}`);
  }

  /**
   * Make a request to the configured LLM provider
   * @param {string} prompt - The user prompt
   * @param {string} systemPrompt - Optional system prompt
   * @returns {Promise<string>} Generated response
   */
  async callLLM(prompt, systemPrompt = null) {
    if (this.provider === 'anthropic') {
      return this.callAnthropic(prompt, systemPrompt);
    } else if (this.provider === 'openai') {
      return this.callOpenAI(prompt, systemPrompt);
    } else {
      return this.callOllama(prompt, systemPrompt);
    }
  }

  /**
   * Make a request to Anthropic API (Claude)
   * @param {string} prompt - The user prompt
   * @param {string} systemPrompt - Optional system prompt
   * @returns {Promise<string>} Generated response
   */
  async callAnthropic(prompt, systemPrompt = null) {
    const url = `${this.baseUrl}/v1/messages`;

    const payload = {
      model: this.model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    };

    if (systemPrompt) {
      payload.system = systemPrompt;
    }

    try {
      console.log(`Calling Anthropic with model ${this.model}...`);
      const response = await axios.post(url, payload, {
        timeout: this.timeout,
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
      });

      // Anthropic returns content as an array of content blocks
      const content = response.data.content;
      if (content && content.length > 0) {
        return content.map(block => block.text || '').join('');
      }
      return '';
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        console.error('Anthropic request timed out');
      } else if (error.response) {
        console.error('Anthropic API error:', error.response.status, error.response.data?.error?.message || error.message);
      } else {
        console.error('Anthropic API error:', error.message);
      }
      throw error;
    }
  }

  /**
   * Make a request to OpenAI API
   * @param {string} prompt - The user prompt
   * @param {string} systemPrompt - Optional system prompt
   * @returns {Promise<string>} Generated response
   */
  async callOpenAI(prompt, systemPrompt = null) {
    const url = `${this.baseUrl}/chat/completions`;

    const messages = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const payload = {
      model: this.model,
      messages,
      temperature: 0.7,
      top_p: 0.9,
    };

    try {
      console.log(`Calling OpenAI with model ${this.model}...`);
      const response = await axios.post(url, payload, {
        timeout: this.timeout,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      return response.data.choices[0]?.message?.content || '';
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        console.error('OpenAI request timed out');
      } else if (error.response) {
        console.error('OpenAI API error:', error.response.status, error.response.data?.error?.message || error.message);
      } else {
        console.error('OpenAI API error:', error.message);
      }
      throw error;
    }
  }

  /**
   * Make a request to Ollama API (local)
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
      const result = await this.callLLM(prompt, SYSTEM_PROMPT);

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
          needsClarification: data.needsClarification || false,
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
        needsClarification: false,
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
        needsClarification: false,
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
      return await this.callLLM(prompt, SYSTEM_PROMPT);
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
      return await this.callLLM(prompt, SYSTEM_PROMPT);
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
      return await this.callLLM(prompt, SYSTEM_PROMPT);
    } catch (error) {
      console.error('Error generating summary:', error.message);
      return 'Standup complete. Please review individual updates above.';
    }
  }

  /**
   * Check if the configured LLM is available
   * @returns {Promise<boolean>} True if LLM is available
   */
  async checkModelAvailable() {
    if (this.provider === 'anthropic') {
      return this.checkAnthropicAvailable();
    } else if (this.provider === 'openai') {
      return this.checkOpenAIAvailable();
    } else {
      return this.checkOllamaModelAvailable();
    }
  }

  /**
   * Check if Anthropic API is accessible
   * @returns {Promise<boolean>} True if API is accessible
   */
  async checkAnthropicAvailable() {
    try {
      if (!this.apiKey) {
        console.error('Anthropic API key not configured. Set ANTHROPIC_AUTH_TOKEN or ANTHROPIC_API_KEY in .env');
        return false;
      }

      // Anthropic doesn't have a models endpoint, so we do a simple test call
      const url = `${this.baseUrl}/v1/messages`;
      const response = await axios.post(url, {
        model: this.model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }],
      }, {
        timeout: 15000,
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 200) {
        console.log(`Anthropic model ${this.model} is available`);
        return true;
      }
      return false;
    } catch (error) {
      if (error.response?.status === 401) {
        console.error('Invalid Anthropic API key. Please check your ANTHROPIC_AUTH_TOKEN');
        return false;
      } else if (error.response?.status === 400 || error.response?.status === 404) {
        console.error(`Anthropic model '${this.model}' may not be available:`, error.response?.data?.error?.message || error.message);
        return false;
      } else {
        console.error('Failed to check Anthropic availability:', error.message);
        return false;
      }
    }
  }

  /**
   * Check if OpenAI API is accessible
   * @returns {Promise<boolean>} True if API is accessible
   */
  async checkOpenAIAvailable() {
    try {
      if (!this.apiKey) {
        console.error('OpenAI API key not configured. Set OPENAI_API_KEY in .env');
        return false;
      }

      const url = `${this.baseUrl}/models`;
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      const models = response.data.data || [];
      const modelIds = models.map(m => m.id);
      
      if (modelIds.includes(this.model)) {
        console.log(`OpenAI model ${this.model} is available`);
        return true;
      }

      // Check for partial match (e.g., gpt-4o-mini might be listed differently)
      const hasModel = modelIds.some(id => id.includes(this.model) || this.model.includes(id));
      if (hasModel) {
        console.log(`OpenAI model ${this.model} is available`);
        return true;
      }

      console.warn(`Model ${this.model} not found in available models`);
      return true; // Still return true as the API is accessible
    } catch (error) {
      if (error.response?.status === 401) {
        console.error('Invalid OpenAI API key. Please check your OPENAI_API_KEY');
      } else {
        console.error('Failed to check OpenAI availability:', error.message);
      }
      return false;
    }
  }

  /**
   * Check if the configured Ollama model is available
   * @returns {Promise<boolean>} True if model is available
   */
  async checkOllamaModelAvailable() {
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
