/**
 * Leave Management Service
 * Handles tracking of team members who are on leave
 */

import fs from 'fs';
import path from 'path';
import config from '../config/index.js';

class LeaveService {
  constructor() {
    this.storagePath = path.join(config.app.dataDir, 'leave_records.json');
    this.records = [];
    this._loadRecords();
  }

  /**
   * Load leave records from storage
   */
  _loadRecords() {
    try {
      if (fs.existsSync(this.storagePath)) {
        const data = fs.readFileSync(this.storagePath, 'utf8');
        this.records = JSON.parse(data);
        console.log(`Loaded ${this.records.length} leave records`);
      }
    } catch (error) {
      console.error('Failed to load leave records:', error.message);
      this.records = [];
    }
  }

  /**
   * Save leave records to storage
   */
  _saveRecords() {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.storagePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.storagePath, JSON.stringify(this.records, null, 2));
      console.log(`Saved ${this.records.length} leave records`);
    } catch (error) {
      console.error('Failed to save leave records:', error.message);
    }
  }

  /**
   * Add a leave record for a team member
   * @param {string} email - Team member's email
   * @param {string} startDate - Leave start date (YYYY-MM-DD)
   * @param {string} endDate - Leave end date (YYYY-MM-DD)
   * @param {string} reason - Optional reason for leave
   * @returns {Object} Created leave record
   */
  addLeave(email, startDate, endDate, reason = null) {
    const record = {
      email,
      startDate,
      endDate,
      reason,
      createdAt: new Date().toISOString(),
    };

    this.records.push(record);
    this._saveRecords();
    console.log(`Added leave for ${email}: ${startDate} to ${endDate}`);
    return record;
  }

  /**
   * Remove a leave record
   * @param {string} email - Team member's email
   * @param {string} startDate - Leave start date (used as identifier)
   * @returns {boolean} True if removed
   */
  removeLeave(email, startDate) {
    const index = this.records.findIndex(
      r => r.email === email && r.startDate === startDate
    );

    if (index !== -1) {
      this.records.splice(index, 1);
      this._saveRecords();
      console.log(`Removed leave for ${email} starting ${startDate}`);
      return true;
    }
    return false;
  }

  /**
   * Check if a team member is on leave
   * @param {string} email - Team member's email
   * @param {Date} checkDate - Date to check (defaults to today)
   * @returns {boolean} True if on leave
   */
  isOnLeave(email, checkDate = new Date()) {
    const checkDateStr = checkDate.toISOString().split('T')[0];

    for (const record of this.records) {
      if (record.email === email) {
        if (record.startDate <= checkDateStr && checkDateStr <= record.endDate) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Get the leave record for a team member if they're on leave
   * @param {string} email - Team member's email
   * @param {Date} checkDate - Date to check
   * @returns {Object|null} Leave record if on leave
   */
  getLeaveRecord(email, checkDate = new Date()) {
    const checkDateStr = checkDate.toISOString().split('T')[0];

    for (const record of this.records) {
      if (record.email === email) {
        if (record.startDate <= checkDateStr && checkDateStr <= record.endDate) {
          return record;
        }
      }
    }
    return null;
  }

  /**
   * Get all team members currently on leave
   * @param {Date} checkDate - Date to check
   * @returns {Array} List of leave records
   */
  getAllOnLeave(checkDate = new Date()) {
    const checkDateStr = checkDate.toISOString().split('T')[0];

    return this.records.filter(record => {
      return record.startDate <= checkDateStr && checkDateStr <= record.endDate;
    });
  }

  /**
   * Get leaves starting in the next N days
   * @param {number} daysAhead - Number of days to look ahead
   * @returns {Array} List of upcoming leave records
   */
  getUpcomingLeaves(daysAhead = 7) {
    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const todayStr = today.toISOString().split('T')[0];
    const futureDateStr = futureDate.toISOString().split('T')[0];

    return this.records
      .filter(record => {
        return record.startDate >= todayStr && record.startDate <= futureDateStr;
      })
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }

  /**
   * Remove leave records that ended more than N days ago
   * @param {number} daysOld - Number of days after which to remove records
   */
  cleanupOldRecords(daysOld = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    const originalCount = this.records.length;
    this.records = this.records.filter(record => record.endDate >= cutoffStr);

    const removed = originalCount - this.records.length;
    if (removed > 0) {
      this._saveRecords();
      console.log(`Cleaned up ${removed} old leave records`);
    }
  }
}

export default new LeaveService();
