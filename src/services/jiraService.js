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
    this.baseUrl = config.jira.baseUrl.replace(/\/$/, '');
    this.auth = Buffer.from(`${config.jira.email}:${config.jira.apiToken}`).toString('base64');
    this.projectKey = config.jira.projectKey;
  }

  /**
   * Make an authenticated request to JIRA API
   */
  async request(method, endpoint, data = null) {
    const url = `${this.baseUrl}/rest/api/3/${endpoint}`;
    
    try {
      const response = await axios({
        method,
        url,
        headers: {
          'Authorization': `Basic ${this.auth}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        data,
      });
      return response.data;
    } catch (error) {
      console.error(`JIRA API Error [${method} ${endpoint}]:`, error.response?.data || error.message);
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
      const result = await this.request('GET', `search?jql=${encodeURIComponent(jql)}&fields=summary,description,status,assignee,priority,issuetype,customfield_10016,duedate&maxResults=50`);

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
   * @returns {Promise<boolean>} True if successful
   */
  async updateTicketStatus(ticketKey, newStatus) {
    try {
      // First, get available transitions
      const transitionsResult = await this.request('GET', `issue/${ticketKey}/transitions`);
      
      // Find the transition that matches the desired status
      const transition = (transitionsResult.transitions || []).find(
        t => t.to?.name?.toLowerCase() === newStatus.toLowerCase()
      );

      if (!transition) {
        console.warn(`No transition found for status '${newStatus}' on ticket ${ticketKey}`);
        return false;
      }

      // Perform the transition
      await this.request('POST', `issue/${ticketKey}/transitions`, {
        transition: { id: transition.id }
      });

      console.log(`Successfully updated ${ticketKey} to status '${newStatus}'`);
      return true;
    } catch (error) {
      console.error(`Failed to update ticket ${ticketKey}:`, error.message);
      return false;
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
      console.log(`Added comment to ${ticketKey}`);
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
      const result = await this.request('GET', `search?jql=${encodeURIComponent(jql)}&fields=assignee&maxResults=100`);

      // Extract unique assignees
      const seenEmails = new Set();
      const members = [];

      for (const issue of result.issues || []) {
        const assignee = issue.fields?.assignee;
        if (assignee?.emailAddress && !seenEmails.has(assignee.emailAddress)) {
          seenEmails.add(assignee.emailAddress);
          members.push({
            name: assignee.displayName || 'Unknown',
            email: assignee.emailAddress,
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
}

export default new JiraService();
