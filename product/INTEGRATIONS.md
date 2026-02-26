# AI-EM Integrations Guide

> **Seamless Connectivity with Your Engineering Ecosystem**

[← Back to Main Documentation](./ABOUT_AI_EM.md)

---

## 📋 Table of Contents

1. [Integration Overview](#integration-overview)
2. [JIRA Integration](#jira-integration)
3. [Slack Integration](#slack-integration)
4. [Gmail Integration](#gmail-integration)
5. [Google Calendar Integration](#google-calendar-integration)
6. [GitHub Integration](#github-integration)
7. [Additional Integrations](#additional-integrations)
8. [Custom Integrations](#custom-integrations)
9. [Troubleshooting](#troubleshooting)

---

## Integration Overview

AI-EM's power lies in its ability to seamlessly connect with your existing tools, creating a unified engineering management experience without disrupting established workflows.

### Integration Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        AI-EM INTEGRATION HUB                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐               │
│    │   OAuth 2.0 │    │   Webhooks  │    │   REST API  │               │
│    │   Gateway   │    │   Handler   │    │   Gateway   │               │
│    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘               │
│           │                  │                  │                        │
│           └──────────────────┼──────────────────┘                        │
│                              │                                           │
│                    ┌─────────▼─────────┐                                │
│                    │  Event Processor  │                                │
│                    │  & Router         │                                │
│                    └─────────┬─────────┘                                │
│                              │                                           │
│    ┌─────────────────────────┼─────────────────────────┐               │
│    │                         │                         │                │
│    ▼                         ▼                         ▼                │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐       │
│ │ JIRA │ │Slack │ │Gmail │ │ GCal │ │GitHub│ │Notion│ │Custom│       │
│ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Supported Integration Tiers

| Tier           | Integrations                        | Features                                  |
| -------------- | ----------------------------------- | ----------------------------------------- |
| **Core**       | JIRA, Slack, Gmail, Google Calendar | Full bidirectional sync, real-time events |
| **Extended**   | GitHub, GitLab, Confluence, Notion  | Read/write with selective sync            |
| **Enterprise** | Custom APIs, On-premise systems     | Dedicated connectors, VPN support         |

---

## JIRA Integration

### Overview

The JIRA integration is the backbone of AI-EM's task management capabilities, enabling seamless project tracking, sprint management, and automated task creation.

### Capabilities

#### 📥 Inbound (JIRA → AI-EM)

| Feature                | Description                                                                     |
| ---------------------- | ------------------------------------------------------------------------------- |
| **Issue Sync**         | Real-time synchronization of all issue types (Epic, Story, Task, Bug, Sub-task) |
| **Sprint Data**        | Active sprint information, velocity history, burndown data                      |
| **User Mapping**       | Automatic mapping of JIRA users to AI-EM profiles                               |
| **Custom Fields**      | Support for custom fields and workflows                                         |
| **Comments & History** | Full comment thread and change history import                                   |
| **Attachments**        | Reference to attachments (stored in JIRA)                                       |

#### 📤 Outbound (AI-EM → JIRA)

| Feature               | Description                                             |
| --------------------- | ------------------------------------------------------- |
| **Issue Creation**    | Create issues from PRD decomposition or voice commands  |
| **Status Updates**    | Automatic status transitions based on developer updates |
| **Assignment**        | Smart assignment based on skills and workload           |
| **Time Logging**      | Automatic work log entries from standup updates         |
| **Sprint Management** | Add/remove issues from sprints                          |
| **Bulk Operations**   | Batch updates for efficiency                            |

### Setup Instructions

#### Prerequisites

- JIRA Cloud or JIRA Server (v8.0+)
- Admin access to JIRA instance
- AI-EM Enterprise account

#### Step 1: Create JIRA API Token

```bash
# For JIRA Cloud
1. Navigate to: https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Name: "AI-EM Integration"
4. Copy the generated token (you won't see it again)
```

#### Step 2: Configure OAuth App (Recommended)

```bash
# For enhanced security, use OAuth 2.0
1. Go to: https://developer.atlassian.com/console/myapps/
2. Create new app → "AI-EM Connector"
3. Add permissions:
   - read:jira-work
   - write:jira-work
   - read:jira-user
   - manage:jira-project
4. Configure callback URL: https://app.ai-em.io/integrations/jira/callback
5. Note the Client ID and Secret
```

#### Step 3: Connect in AI-EM

```yaml
# AI-EM Integration Settings
integration:
  type: jira
  auth_method: oauth2 # or api_token
  instance_url: https://your-company.atlassian.net
  project_keys:
    - PROJ1
    - PROJ2
  sync_options:
    issues: true
    sprints: true
    users: true
    custom_fields: true
  webhook_events:
    - issue_created
    - issue_updated
    - sprint_started
    - sprint_closed
```

### JIRA Workflow Automation

AI-EM can automate common JIRA workflows:

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTOMATED JIRA WORKFLOWS                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐ │
│  │   PRD    │───▶│  AI-EM   │───▶│  Tasks   │───▶│  Sprint  │ │
│  │ Uploaded │    │ Analysis │    │ Created  │    │ Assigned │ │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘ │
│                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐ │
│  │ Standup  │───▶│  Status  │───▶│  Blocker │───▶│  Alert   │ │
│  │  Update  │    │  Change  │    │ Detected │    │   Sent   │ │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘ │
│                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐ │
│  │  Sprint  │───▶│ Velocity │───▶│ Capacity │───▶│  Report  │ │
│  │  Closed  │    │  Calc    │    │ Planning │    │Generated │ │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Custom Field Mapping

```json
{
  "custom_field_mapping": {
    "story_points": "customfield_10016",
    "sprint": "customfield_10020",
    "epic_link": "customfield_10014",
    "team": "customfield_10001",
    "skill_required": "customfield_10050",
    "complexity": "customfield_10051"
  }
}
```

---

## Slack Integration

### Overview

Slack serves as the primary communication interface for AI-EM, enabling real-time interactions, notifications, and asynchronous updates.

### Capabilities

#### 💬 Communication Features

| Feature                 | Description                                          |
| ----------------------- | ---------------------------------------------------- |
| **AI-EM Bot**           | Dedicated bot for commands and interactions          |
| **Channel Integration** | Monitor and participate in team channels             |
| **Direct Messages**     | Private 1:1 communication with developers            |
| **Thread Support**      | Contextual conversations within threads              |
| **Reactions**           | Use reactions for quick feedback and acknowledgments |
| **Slash Commands**      | Quick actions via `/ai-em` commands                  |

#### 🔔 Notification Types

| Notification          | Trigger                           | Channel                               |
| --------------------- | --------------------------------- | ------------------------------------- |
| **Standup Reminder**  | 15 min before scheduled standup   | Team channel                          |
| **Blocker Alert**     | Developer reports blocker         | Team channel + DM to relevant parties |
| **Sprint Update**     | Daily at configured time          | Team channel                          |
| **PR Review Request** | New PR needs review               | Reviewer DM                           |
| **Meeting Summary**   | After each AI-facilitated meeting | Team channel                          |
| **Deadline Warning**  | 24/48/72 hours before due date    | Assignee DM                           |

### Slash Commands

```bash
# Available Slash Commands

/ai-em status
# Returns: Current sprint status, blockers, and today's priorities

/ai-em standup
# Initiates: Async standup collection for the user

/ai-em schedule [meeting-type] [participants] [duration]
# Example: /ai-em schedule 1:1 @john 30min
# Creates: Calendar event and sends invites

/ai-em task [description]
# Example: /ai-em task Fix login bug on mobile
# Creates: JIRA ticket with AI-suggested details

/ai-em report [type] [timeframe]
# Example: /ai-em report velocity last-sprint
# Returns: Requested report in thread

/ai-em help
# Returns: Full command reference
```

### Interactive Components

AI-EM uses Slack's Block Kit for rich interactions:

```json
{
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "🎯 *Daily Standup Summary - March 15, 2024*"
      }
    },
    {
      "type": "divider"
    },
    {
      "type": "section",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "*✅ Completed Yesterday:*\n• AUTH-123: OAuth implementation\n• AUTH-124: Token refresh logic"
        },
        {
          "type": "mrkdwn",
          "text": "*📋 Today's Focus:*\n• AUTH-125: SSO integration\n• AUTH-126: Session management"
        }
      ]
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*🚧 Blockers:*\n• Waiting for security team approval on SSO provider"
      }
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": { "type": "plain_text", "text": "View in JIRA" },
          "url": "https://company.atlassian.net/browse/AUTH-125"
        },
        {
          "type": "button",
          "text": { "type": "plain_text", "text": "Escalate Blocker" },
          "style": "danger",
          "action_id": "escalate_blocker"
        }
      ]
    }
  ]
}
```

### Setup Instructions

#### Step 1: Create Slack App

```bash
1. Visit: https://api.slack.com/apps
2. Click "Create New App" → "From scratch"
3. App Name: "AI Engineering Manager"
4. Select your workspace
```

#### Step 2: Configure Permissions

```yaml
# Required OAuth Scopes (Bot Token)
oauth_scopes:
  - channels:history # Read channel messages
  - channels:read # View channel info
  - chat:write # Send messages
  - commands # Slash commands
  - groups:history # Private channel messages
  - groups:read # Private channel info
  - im:history # DM history
  - im:read # DM info
  - im:write # Send DMs
  - reactions:read # Read reactions
  - reactions:write # Add reactions
  - users:read # User info
  - users:read.email # User emails
  - files:read # Read shared files
```

#### Step 3: Configure Event Subscriptions

```yaml
# Event Subscriptions
request_url: https://api.ai-em.io/webhooks/slack/events

subscribed_events:
  - message.channels
  - message.groups
  - message.im
  - app_mention
  - reaction_added
  - member_joined_channel
```

#### Step 4: Install to Workspace

```bash
1. Navigate to "Install App" in Slack App settings
2. Click "Install to Workspace"
3. Authorize the requested permissions
4. Copy the Bot User OAuth Token
5. Enter token in AI-EM integration settings
```

### Channel Configuration

```yaml
# AI-EM Slack Configuration
slack:
  workspace_id: T0123456789
  channels:
    team_channel: C0123456789 # Main team channel
    standup_channel: C0123456790 # Dedicated standup channel
    alerts_channel: C0123456791 # Critical alerts
  bot_settings:
    name: "AI-EM"
    icon_emoji: ":robot_face:"
    default_response_time: 2s
  notification_preferences:
    standup_reminder: true
    blocker_alerts: true
    sprint_updates: true
    meeting_summaries: true
```

---

## Gmail Integration

### Overview

Gmail integration enables AI-EM to send automated reports, stakeholder updates, and manage email-based communications with external parties.

### Capabilities

| Feature                    | Description                                    |
| -------------------------- | ---------------------------------------------- |
| **Automated Reports**      | Scheduled email reports to stakeholders        |
| **Meeting Summaries**      | Post-meeting summaries to participants         |
| **External Communication** | Draft and send emails to external stakeholders |
| **Email Parsing**          | Extract action items from incoming emails      |
| **Template Management**    | Customizable email templates                   |
| **Attachment Handling**    | Include reports and documents                  |

### Email Templates

#### Weekly Status Report

```html
Subject: [AI-EM] Weekly Engineering Status - {{team_name}} - Week
{{week_number}} Dear {{stakeholder_name}}, Please find below the weekly
engineering status for {{team_name}}. ## Sprint Progress - Sprint:
{{sprint_name}} - Progress: {{completion_percentage}}% - Days Remaining:
{{days_remaining}} ## Key Accomplishments {{#each accomplishments}} - {{this}}
{{/each}} ## Upcoming Milestones {{#each milestones}} - {{this.name}} - Due:
{{this.date}} {{/each}} ## Risks & Blockers {{#each blockers}} -
{{this.description}} (Impact: {{this.impact}}) {{/each}} ## Team Velocity -
Current Sprint: {{current_velocity}} story points - Average (Last 4 Sprints):
{{average_velocity}} story points Best regards, AI Engineering Manager --- This
is an automated report generated by AI-EM. Dashboard: {{dashboard_url}}
```

### Setup Instructions

#### Step 1: Enable Gmail API

```bash
1. Go to: https://console.cloud.google.com/
2. Create or select a project
3. Enable Gmail API
4. Configure OAuth consent screen
5. Create OAuth 2.0 credentials
```

#### Step 2: Configure Scopes

```yaml
# Required Gmail API Scopes
gmail_scopes:
  - https://www.googleapis.com/auth/gmail.send
  - https://www.googleapis.com/auth/gmail.compose
  - https://www.googleapis.com/auth/gmail.readonly
```

#### Step 3: Connect in AI-EM

```yaml
gmail:
  service_account: ai-em@company.iam.gserviceaccount.com
  delegated_user: engineering@company.com
  templates_path: /templates/email/
  sending_limits:
    daily_max: 500
    rate_limit: 10/minute
  default_settings:
    from_name: "AI Engineering Manager"
    reply_to: engineering-team@company.com
    signature: true
```

---

## Google Calendar Integration

### Overview

Google Calendar integration powers AI-EM's meeting management capabilities, enabling intelligent scheduling, agenda management, and automated meeting facilitation.

### Capabilities

| Feature                | Description                                      |
| ---------------------- | ------------------------------------------------ |
| **Smart Scheduling**   | Find optimal meeting times based on availability |
| **Recurring Meetings** | Manage standups, 1:1s, and team meetings         |
| **Agenda Management**  | Auto-generate and attach meeting agendas         |
| **Meeting Rooms**      | Book conference rooms and video links            |
| **Conflict Detection** | Identify and resolve scheduling conflicts        |
| **Time Zone Support**  | Handle distributed team scheduling               |

### Meeting Types

```yaml
meeting_types:
  daily_standup:
    duration: 15
    recurrence: "RRULE:FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR"
    participants: team_members
    agenda_template: standup_agenda
    video_link: auto_generate

  one_on_one:
    duration: 30
    recurrence: "RRULE:FREQ=WEEKLY"
    participants: [manager, report]
    agenda_template: one_on_one_agenda
    private: true

  sprint_planning:
    duration: 120
    recurrence: "RRULE:FREQ=WEEKLY;INTERVAL=2"
    participants: team_members + product_owner
    agenda_template: sprint_planning_agenda
    room_required: true

  retrospective:
    duration: 60
    recurrence: "RRULE:FREQ=WEEKLY;INTERVAL=2"
    participants: team_members
    agenda_template: retro_agenda
    anonymous_feedback: true
```

### Smart Scheduling Algorithm

```
┌─────────────────────────────────────────────────────────────────┐
│                  SMART SCHEDULING FLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐                                               │
│  │ Meeting      │                                               │
│  │ Request      │                                               │
│  └──────┬───────┘                                               │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────┐    ┌──────────────┐                          │
│  │ Fetch All    │───▶│ Apply        │                          │
│  │ Calendars    │    │ Constraints  │                          │
│  └──────────────┘    └──────┬───────┘                          │
│                             │                                    │
│         ┌───────────────────┼───────────────────┐               │
│         │                   │                   │                │
│         ▼                   ▼                   ▼                │
│  ┌────────────┐     ┌────────────┐     ┌────────────┐          │
│  │ Working    │     │ Time Zone  │     │ Preference │          │
│  │ Hours      │     │ Overlap    │     │ Weights    │          │
│  └────────────┘     └────────────┘     └────────────┘          │
│         │                   │                   │                │
│         └───────────────────┼───────────────────┘               │
│                             │                                    │
│                             ▼                                    │
│                    ┌──────────────┐                             │
│                    │ Rank         │                             │
│                    │ Time Slots   │                             │
│                    └──────┬───────┘                             │
│                           │                                      │
│                           ▼                                      │
│                    ┌──────────────┐                             │
│                    │ Propose Top  │                             │
│                    │ 3 Options    │                             │
│                    └──────────────┘                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Setup Instructions

#### Step 1: Enable Calendar API

```bash
1. Go to: https://console.cloud.google.com/
2. Enable Google Calendar API
3. Use same OAuth credentials as Gmail (or create new)
```

#### Step 2: Configure Scopes

```yaml
# Required Calendar API Scopes
calendar_scopes:
  - https://www.googleapis.com/auth/calendar
  - https://www.googleapis.com/auth/calendar.events
  - https://www.googleapis.com/auth/calendar.readonly
```

#### Step 3: Configure in AI-EM

```yaml
google_calendar:
  service_account: ai-em@company.iam.gserviceaccount.com
  team_calendar_id: team@group.calendar.google.com
  scheduling_preferences:
    working_hours:
      start: "09:00"
      end: "18:00"
    preferred_meeting_times:
      - "10:00-12:00"
      - "14:00-16:00"
    buffer_between_meetings: 15 # minutes
    max_meetings_per_day: 6
  video_conferencing:
    provider: google_meet # or zoom
    auto_add_link: true
```

---

## GitHub Integration

### Overview

GitHub integration provides visibility into code-level activities, enabling AI-EM to correlate development work with project management.

### Capabilities

| Feature                 | Description                             |
| ----------------------- | --------------------------------------- |
| **PR Tracking**         | Monitor pull request status and reviews |
| **Commit Analysis**     | Link commits to JIRA tickets            |
| **Code Review Metrics** | Track review turnaround times           |
| **CI/CD Status**        | Monitor build and deployment status     |
| **Branch Management**   | Track feature branch lifecycle          |
| **Release Notes**       | Auto-generate release documentation     |

### Setup Instructions

```yaml
github:
  organization: your-org
  repositories:
    - repo-1
    - repo-2
  webhook_events:
    - push
    - pull_request
    - pull_request_review
    - check_run
    - deployment
  branch_patterns:
    feature: "feature/*"
    bugfix: "bugfix/*"
    release: "release/*"
  jira_linking:
    enabled: true
    pattern: "[A-Z]+-[0-9]+" # Matches PROJ-123
```

---

## Additional Integrations

### Confluence

```yaml
confluence:
  base_url: https://company.atlassian.net/wiki
  spaces:
    - ENG
    - PRODUCT
  sync_types:
    - meeting_notes
    - technical_docs
    - runbooks
```

### Notion

```yaml
notion:
  workspace_id: workspace-id
  databases:
    roadmap: database-id-1
    okrs: database-id-2
  sync_direction: bidirectional
```

### PagerDuty

```yaml
pagerduty:
  api_key: ${PAGERDUTY_API_KEY}
  service_ids:
    - SERVICE1
    - SERVICE2
  incident_correlation: true
  on_call_visibility: true
```

### Zoom

```yaml
zoom:
  account_id: account-id
  client_id: client-id
  client_secret: ${ZOOM_CLIENT_SECRET}
  auto_recording: cloud
  meeting_settings:
    waiting_room: false
    join_before_host: true
```

---

## Custom Integrations

### REST API

AI-EM provides a comprehensive REST API for custom integrations:

```bash
# Base URL
https://api.ai-em.io/v1

# Authentication
Authorization: Bearer <api_token>

# Example: Create a task
POST /api/v1/tasks
Content-Type: application/json

{
  "title": "Implement feature X",
  "description": "As a user, I want...",
  "assignee": "user@company.com",
  "priority": "high",
  "story_points": 5,
  "sprint_id": "sprint-123"
}
```

### Webhooks

```yaml
# Outbound Webhooks Configuration
webhooks:
  endpoints:
    - url: https://your-service.com/ai-em-events
      events:
        - task.created
        - task.completed
        - meeting.scheduled
        - blocker.reported
      secret: ${WEBHOOK_SECRET}
      retry_policy:
        max_attempts: 3
        backoff: exponential
```

### SDK Support

```bash
# Available SDKs
- Python: pip install ai-em-sdk
- Node.js: npm install @ai-em/sdk
- Go: go get github.com/ai-em/sdk-go
- Java: Maven/Gradle dependency available
```

---

## Troubleshooting

### Common Issues

#### JIRA Connection Failed

```bash
# Check API token validity
curl -u email@company.com:API_TOKEN \
  https://company.atlassian.net/rest/api/3/myself

# Verify permissions
- Ensure token has project access
- Check IP allowlist settings
```

#### Slack Bot Not Responding

```bash
# Verify bot is in channel
/invite @AI-EM

# Check event subscriptions
- Verify Request URL is accessible
- Check for SSL certificate issues
- Review Slack app event logs
```

#### Calendar Sync Issues

```bash
# Verify service account delegation
- Check domain-wide delegation settings
- Ensure correct scopes are authorized
- Verify calendar sharing permissions
```

### Support Resources

- **Integration Status**: [status.ai-em.io](https://status.ai-em.io)
- **API Documentation**: [api.ai-em.io/docs](https://api.ai-em.io/docs)
- **Support Portal**: [support.ai-em.io](https://support.ai-em.io)

---

[← Back to Main Documentation](./ABOUT_AI_EM.md) | [Voice Capabilities →](./VOICE_CAPABILITIES.md)
