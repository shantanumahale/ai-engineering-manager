/**
 * JIRA Integration Service
 * Handles all JIRA API interactions including:
 * - Fetching assigned tasks for team members
 * - Updating ticket statuses
 * - Getting sprint information
 */

import axios from 'axios';
import config from '../config/index.js';

class JiraService {
  constructor() {
    // Clean up the base URL - remove trailing slashes and any /jira/ suffix
    let baseUrl = config.jira.baseUrl || '';
    baseUrl = baseUrl.replace(/\/+$/, ''); // Remove trailing slashes
    baseUrl = baseUrl.replace(/\/jira\/?$/i, ''); // Remove /jira suffix if present
    
    this.baseUrl = baseUrl;
    this.auth = Buffer.from(`${config.jira.email}:${config.jira.apiToken}`).toString('base64');
    this.projectKey = config.jira.projectKey;
    
    // Create axios instance with proper configuration
    this.client = axios.create({
      baseURL: `${this.baseUrl}/rest/api/3`,
      headers: {
        'Authorization': `Basic ${this.auth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'AI-Engineering-Manager/1.0',
      },
      timeout: 30000, // 30 second timeout
    });
  }

  /**
   * Make an authenticated request to JIRA API
   * @param {string} method - HTTP method (GET, POST, PUT, DELETE)
   * @param {string} endpoint - API endpoint path (e.g., 'search', 'myself', 'issue/PROJ-123')
   * @param {object} data - Request body for POST/PUT requests
   * @param {object} params - Query parameters (will be properly encoded by axios)
   */
  /**
   * Sleep for a specified number of milliseconds
   * @param {number} ms - Milliseconds to sleep
   */
  async _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Make an authenticated request to JIRA API with retry logic
   * @param {string} method - HTTP method (GET, POST, PUT, DELETE)
   * @param {string} endpoint - API endpoint path (e.g., 'search', 'myself', 'issue/PROJ-123')
   * @param {object} data - Request body for POST/PUT requests
   * @param {object} params - Query parameters (will be properly encoded by axios)
   * @param {number} retries - Number of retries remaining (default: 3)
   * @param {number} retryDelay - Initial delay between retries in ms (default: 2000)
   */
  async request(method, endpoint, data = null, params = null) {
    // Remove leading slash if present to avoid double slashes
    const cleanEndpoint = endpoint.replace(/^\/+/, '');
    
    try {
      const response = await this.client({
        method,
        url: cleanEndpoint,
        data,
        params,
      });
      return response.data;
    } catch (error) {
      const statusCode = error.response?.status;
      const errorData = error.response?.data;
      const fullUrl = `${this.baseUrl}/rest/api/3/${cleanEndpoint}`;
      
      // Check if response is HTML (CloudFront/WAF error)
      const isCloudFrontBlock = typeof errorData === 'string' && errorData.includes('<!DOCTYPE');
      
      // Log the error but don't retry - if it fails once, move on
      if (isCloudFrontBlock) {
        console.error(`JIRA API Error [${method} ${cleanEndpoint}]: CloudFront/WAF blocked the request (Status: ${statusCode})`);
        console.error(`  Full URL attempted: ${fullUrl}`);
        console.error('This may be due to:');
        console.error('  1. Invalid or expired API token');
        console.error('  2. Incorrect JIRA base URL (should be like https://yourcompany.atlassian.net)');
        console.error('  3. IP being rate-limited or blocked');
        console.error('  4. Network/firewall issues');
        throw new Error(`JIRA request blocked by CloudFront (${statusCode}). Check your JIRA_BASE_URL and JIRA_API_TOKEN.`);
      }
      
      // Handle specific JIRA error codes
      if (statusCode === 401) {
        console.error(`JIRA API Error [${method} ${cleanEndpoint}]: Authentication failed - check JIRA_EMAIL and JIRA_API_TOKEN`);
      } else if (statusCode === 403) {
        console.error(`JIRA API Error [${method} ${cleanEndpoint}]: Access forbidden - check permissions for the API token`);
      } else if (statusCode === 404) {
        console.error(`JIRA API Error [${method} ${cleanEndpoint}]: Resource not found - check JIRA_PROJECT_KEY`);
      } else {
        console.error(`JIRA API Error [${method} ${cleanEndpoint}]:`, errorData || error.message);
      }
      throw error;
    }
  }

  /**
   * Get all tasks assigned to a user
   * @param {string} email - User's email address
   * @param {string[]} statuses - Optional list of statuses to filter by
   * @returns {Promise<Array>} List of tickets
   */
  async getUserTasks(email, statuses = null) {
    const jqlParts = [
      `project = "${this.projectKey}"`,
      `assignee = "${email}"`,
      // Exclude subtasks - only get Tasks, Bugs, Stories (main issue types)
      `issuetype NOT IN (Sub-task, "Sub-task")`,
    ];

    if (statuses && statuses.length > 0) {
      const statusStr = statuses.map(s => `"${s}"`).join(', ');
      jqlParts.push(`status IN (${statusStr})`);
    } else {
      // Default: exclude Done tickets
      jqlParts.push('status != "Done"');
    }

    const jql = jqlParts.join(' AND ') + ' ORDER BY priority DESC, updated DESC';

    console.log(`Fetching JIRA tasks for ${email}`);

    try {
      // Use the new /search/jql endpoint (POST) - the old /search endpoint has been deprecated
      // See: https://developer.atlassian.com/changelog/#CHANGE-2046
      const result = await this.request('POST', 'search/jql', {
        jql,
        fields: ['summary', 'description', 'status', 'assignee', 'priority', 'issuetype', 'customfield_10016', 'duedate'],
        maxResults: 50,
      });

      const tickets = (result.issues || []).map(issue => {
        const fields = issue.fields || {};
        const assignee = fields.assignee || {};
        
        // Extract description text
        let description = null;
        if (fields.description?.content?.[0]?.content?.[0]?.text) {
          description = fields.description.content[0].content[0].text;
        }

        return {
          key: issue.key,
          summary: fields.summary || '',
          description,
          status: fields.status?.name || 'Unknown',
          assignee: assignee.displayName || null,
          assigneeEmail: assignee.emailAddress || null,
          storyPoints: fields.customfield_10016 || null,
          priority: fields.priority?.name || 'Medium',
          issueType: fields.issuetype?.name || 'Task',
          dueDate: fields.duedate || null,
        };
      });

      console.log(`Found ${tickets.length} tickets for ${email}`);
      return tickets;
    } catch (error) {
      console.error(`Failed to fetch tasks for ${email}:`, error.message);
      return [];
    }
  }

  /**
   * Update the status of a JIRA ticket
   * @param {string} ticketKey - The ticket key (e.g., "PROJ-123")
   * @param {string} newStatus - The new status name
   * @returns {Promise<{success: boolean, message: string}>} Result object
   */
  async updateTicketStatus(ticketKey, newStatus) {
    try {
      console.log(`Attempting to update ${ticketKey} to status '${newStatus}'...`);
      
      // First, check the current status of the issue
      let currentStatus = null;
      try {
        const issueData = await this.request('GET', `issue/${ticketKey}`, null, { fields: 'status' });
        currentStatus = issueData?.fields?.status?.name;
        console.log(`  Current status: ${currentStatus}`);
        
        // Check if already in the target status
        if (currentStatus && currentStatus.toLowerCase() === newStatus.toLowerCase()) {
          console.log(`  ℹ ${ticketKey} is already in status '${newStatus}' - no transition needed`);
          return {
            success: true,
            message: `${ticketKey} is already in status '${newStatus}'`,
            alreadyInStatus: true
          };
        }
      } catch (statusError) {
        console.warn(`  Could not fetch current status: ${statusError.message}`);
        // Continue anyway - we'll try to get transitions
      }
      
      // Add a small delay before making the request to avoid rate limiting
      await this._sleep(500);
      
      // Get available transitions
      console.log(`  Fetching available transitions for ${ticketKey}...`);
      let transitionsResult;
      try {
        transitionsResult = await this.request('GET', `issue/${ticketKey}/transitions`);
      } catch (transitionError) {
        // Enhanced error handling for transitions endpoint
        const statusCode = transitionError.response?.status;
        const errorData = transitionError.response?.data;
        
        if (statusCode === 403) {
          // Check if it's a CloudFront/WAF block
          const isCloudFrontBlock = typeof errorData === 'string' && errorData.includes('<!DOCTYPE');
          
          if (isCloudFrontBlock) {
            console.error(`  ❌ CloudFront/WAF blocked the transitions request for ${ticketKey}`);
            console.error('  This may be an org-level restriction on the /transitions endpoint.');
            console.error('  Troubleshooting steps:');
            console.error('    1. Test with curl: curl -u "email:token" https://cleartaxtech.atlassian.net/rest/api/3/issue/PRODUCTX-1992/transitions');
            console.error('    2. Check if your IP is allowed in Jira admin settings');
            console.error('    3. Verify the API token has "Transition issues" permission');
            return {
              success: false,
              message: `CloudFront/WAF blocked transitions request for ${ticketKey}. This may be an org-level restriction.`,
              errorType: 'cloudfront_block'
            };
          } else {
            console.error(`  ❌ 403 Forbidden when fetching transitions for ${ticketKey}`);
            console.error('  Your API token may not have permission to transition this issue.');
            return {
              success: false,
              message: `Permission denied to transition ${ticketKey}. Check API token permissions.`,
              errorType: 'permission_denied'
            };
          }
        }
        
        // Re-throw for other errors
        throw transitionError;
      }
      
      const transitions = transitionsResult.transitions || [];
      console.log(`  Found ${transitions.length} available transitions`);
      
      // Find the transition that matches the desired status
      const transition = transitions.find(
        t => t.to?.name?.toLowerCase() === newStatus.toLowerCase()
      );

      if (!transition) {
        // Log available transitions for debugging
        const availableTransitions = transitions
          .map(t => `"${t.name}" -> "${t.to?.name}"`)
          .join(', ');
        
        console.warn(`  ⚠ No transition found to status '${newStatus}' on ticket ${ticketKey}`);
        console.warn(`  Current status: ${currentStatus || 'unknown'}`);
        console.warn(`  Available transitions: ${availableTransitions || 'none'}`);
        
        // Provide helpful message
        let message = `Cannot transition ${ticketKey} to '${newStatus}'.`;
        if (currentStatus) {
          message += ` Current status is '${currentStatus}'.`;
        }
        if (transitions.length > 0) {
          const targetStatuses = transitions.map(t => t.to?.name).filter(Boolean);
          message += ` Available target statuses: ${targetStatuses.join(', ')}.`;
        } else {
          message += ' No transitions available from current status.';
        }
        
        return { success: false, message, errorType: 'no_valid_transition' };
      }

      // Add a small delay between GET and POST to avoid rate limiting
      await this._sleep(300);

      // Perform the transition
      console.log(`  Executing transition: "${transition.name}" (ID: ${transition.id}) -> "${transition.to.name}"`);
      await this.request('POST', `issue/${ticketKey}/transitions`, {
        transition: { id: transition.id }
      });

      console.log(`  ✓ Successfully updated ${ticketKey} to status '${newStatus}'`);
      return { success: true, message: `${ticketKey} transitioned to '${newStatus}'` };
    } catch (error) {
      console.error(`Failed to update ticket ${ticketKey}:`, error.message);
      return {
        success: false,
        message: `Failed to update ${ticketKey}: ${error.message}`,
        errorType: 'exception'
      };
    }
  }

  /**
   * Add a comment to a JIRA ticket
   * @param {string} ticketKey - The ticket key
   * @param {string} comment - The comment text
   * @returns {Promise<boolean>} True if successful
   */
  async addComment(ticketKey, comment) {
    try {
      // Add a small delay before making the request to avoid rate limiting
      await this._sleep(300);
      
      // JIRA API v3 uses Atlassian Document Format
      const body = {
        body: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: comment,
                }
              ]
            }
          ]
        }
      };

      await this.request('POST', `issue/${ticketKey}/comment`, body);
      console.log(`✓ Added comment to ${ticketKey}`);
      return true;
    } catch (error) {
      console.error(`Failed to add comment to ${ticketKey}:`, error.message);
      return false;
    }
  }

  /**
   * Get all team members who have tasks in the project
   * @returns {Promise<Array>} List of user objects with name and email
   */
  async getTeamMembers() {
    try {
      const jql = `project = "${this.projectKey}" AND assignee IS NOT EMPTY`;
      
      // Use the new /search/jql endpoint (POST) - the old /search endpoint has been deprecated
      // See: https://developer.atlassian.com/changelog/#CHANGE-2046
      const result = await this.request('POST', 'search/jql', {
        jql,
        fields: ['assignee'],
        maxResults: 100,
      });

      // Extract unique assignees
      const seenEmails = new Set();
      const seenAccountIds = new Set();
      const members = [];

      for (const issue of result.issues || []) {
        const assignee = issue.fields?.assignee;
        if (!assignee) continue;
        
        // Use accountId as primary identifier (email may be hidden due to privacy settings)
        const identifier = assignee.emailAddress || assignee.accountId;
        if (identifier && !seenAccountIds.has(assignee.accountId)) {
          seenAccountIds.add(assignee.accountId);
          if (assignee.emailAddress) {
            seenEmails.add(assignee.emailAddress);
          }
          members.push({
            name: assignee.displayName || 'Unknown',
            email: assignee.emailAddress || null, // May be null due to privacy settings
            accountId: assignee.accountId,
          });
        }
      }

      console.log(`Found ${members.length} team members in project`);
      return members;
    } catch (error) {
      console.error('Failed to get team members:', error.message);
      return [];
    }
  }

  /**
   * Format a ticket for display in context
   * @param {Object} ticket - Ticket object
   * @returns {string} Formatted string
   */
  formatTicketContext(ticket) {
    const parts = [
      `[${ticket.key}] ${ticket.summary}`,
      `  Status: ${ticket.status}`,
      `  Type: ${ticket.issueType}`,
      `  Priority: ${ticket.priority}`,
    ];

    if (ticket.storyPoints) {
      parts.push(`  Story Points: ${ticket.storyPoints}`);
    }
    if (ticket.dueDate) {
      parts.push(`  Due Date: ${ticket.dueDate}`);
    }
    if (ticket.description) {
      const desc = ticket.description.length > 200 
        ? ticket.description.substring(0, 200) + '...' 
        : ticket.description;
      parts.push(`  Description: ${desc}`);
    }

    return parts.join('\n');
  }

  /**
   * Test the JIRA connection and credentials
   * @returns {Promise<{success: boolean, message: string, details?: object}>}
   */
  async testConnection() {
    console.log('Testing JIRA connection...');
    console.log(`  Configured Base URL: ${config.jira.baseUrl}`);
    console.log(`  Cleaned Base URL: ${this.baseUrl}`);
    console.log(`  Full API URL: ${this.baseUrl}/rest/api/3`);
    console.log(`  Email: ${config.jira.email}`);
    console.log(`  Project Key: ${this.projectKey}`);
    console.log(`  API Token: ${config.jira.apiToken ? '***' + config.jira.apiToken.slice(-4) : '(not set)'}`);
    
    // Check if configuration is present
    if (!this.baseUrl) {
      return { success: false, message: 'JIRA_BASE_URL is not configured' };
    }
    if (!config.jira.email) {
      return { success: false, message: 'JIRA_EMAIL is not configured' };
    }
    if (!config.jira.apiToken) {
      return { success: false, message: 'JIRA_API_TOKEN is not configured' };
    }
    if (!this.projectKey) {
      return { success: false, message: 'JIRA_PROJECT_KEY is not configured' };
    }

    // Validate base URL format
    if (!this.baseUrl.startsWith('https://') || !this.baseUrl.includes('.atlassian.net')) {
      console.warn('  ⚠ Warning: JIRA_BASE_URL should be like https://yourcompany.atlassian.net');
    }

    try {
      // Test 1: Check if we can reach the JIRA server (get current user)
      console.log('  Testing authentication...');
      const myself = await this.request('GET', 'myself');
      console.log(`  ✓ Authenticated as: ${myself.displayName} (${myself.emailAddress})`);

      // Test 2: Check if the project exists and is accessible
      console.log(`  Testing project access (${this.projectKey})...`);
      const project = await this.request('GET', `project/${this.projectKey}`);
      console.log(`  ✓ Project found: ${project.name} (${project.key})`);

      return {
        success: true,
        message: 'JIRA connection successful',
        details: {
          user: myself.displayName,
          email: myself.emailAddress,
          project: project.name,
          projectKey: project.key,
        }
      };
    } catch (error) {
      const statusCode = error.response?.status;
      let message = error.message;

      if (statusCode === 401) {
        message = 'Authentication failed. Check your JIRA_EMAIL and JIRA_API_TOKEN.';
      } else if (statusCode === 403) {
        message = 'Access forbidden. Your API token may not have the required permissions, or the base URL is incorrect.';
      } else if (statusCode === 404) {
        message = `Project '${this.projectKey}' not found. Check your JIRA_PROJECT_KEY.`;
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        message = `Cannot reach JIRA server at ${this.baseUrl}. Check your JIRA_BASE_URL.`;
      }

      return { success: false, message };
    }
  }
}

export default new JiraService();
