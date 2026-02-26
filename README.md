# AI Engineering Manager

An intelligent Slack-based standup automation tool designed to streamline daily engineering standups with JIRA integration and AI-powered conversation management.

## 🎯 Project Scope (Hackathon)

This project is built for a hackathon with the following focused scope:

### Core Features

#### 1. Text-Based Standup on Slack

- Automated daily standups conducted in a custom Slack channel: **#product-x-engineers**
- Full JIRA integration providing complete context on tasks assigned to each team member
- Seamless conversation flow managed by AI

#### 2. Leave Management

- Automatically handles employees who are on leave
- Skips standup prompts for absent team members
- Maintains accurate attendance tracking

#### 3. Focused Standup Conversations

- Keeps discussions strictly focused on status updates
- Actively discourages deviation into High-Level Design (HLD) discussions
- Redirects off-topic conversations back to standup format

#### 4. Timeline Tracking

- Proactively asks for timelines on tasks with statuses:
  - **To-Do**
  - **In-Progress**
- Ensures accountability and visibility on delivery expectations

#### 5. Automated JIRA Ticket Management

- Automatically moves JIRA tickets to appropriate statuses based on individual updates
- Reduces manual overhead for developers
- Keeps JIRA board synchronized with actual progress

#### 6. Blocker Identification

- Explicitly asks each team member about blockers
- Surfaces impediments early for quick resolution
- Facilitates proactive problem-solving

### Technology Stack

- **Runtime**: Node.js
- **AI/LLM**: Open-source Llama models via Ollama (recommended: `llama3.3:70b`)
- **Integrations**: Slack API, JIRA API

---

## 🚀 Getting Started

### Prerequisites

1. **Node.js 18+** installed
2. **Ollama** installed and running locally
3. **Slack App** created with proper permissions
4. **JIRA Cloud** account with API access

### Installation

1. **Clone the repository**

   ```bash
   cd ai-engineering-manager
   ```

2. **Install dependencies**

   ```bash
   cd src
   npm install
   ```

3. **Configure environment variables**

   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

4. **Pull the Ollama model**
   ```bash
   ollama pull llama3.3:70b
   # Or for faster but less capable: ollama pull llama3.1:8b
   ```

---

## ⚙️ Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# JIRA Configuration
JIRA_BASE_URL=https://your-company.atlassian.net
JIRA_EMAIL=your-email@company.com
JIRA_API_TOKEN=your-jira-api-token
JIRA_PROJECT_KEY=PROJ

# Slack Configuration
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_STANDUP_CHANNEL=#product-x-engineers

# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.3:70b
OLLAMA_TIMEOUT=120000

# ⏰ Standup Schedule (IST)
STANDUP_HOUR=9      # 9 AM
STANDUP_MINUTE=30   # 30 minutes past

# App Configuration
DATA_DIR=./data
DEBUG=false
```

### 🕐 Setting Standup Time

The standup automatically triggers at the configured IST time. To change it:

**Option 1: Environment Variables**

```bash
STANDUP_HOUR=10     # 10 AM IST
STANDUP_MINUTE=0    # On the hour
```

**Option 2: Direct in Code** ([`src/config/index.js`](src/config/index.js:35))

```javascript
standup: {
  time: {
    hour: 9,    // ⏰ Change this (0-23)
    minute: 30, // ⏰ Change this (0-59)
  },
  timezone: 'Asia/Kolkata',
},
```

The standup runs **Monday through Friday** only.

---

### JIRA Setup

1. Go to [Atlassian API Tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Create a new API token
3. Use your Atlassian email and the token in the configuration

### Slack App Setup

1. **Create a Slack App** at [api.slack.com/apps](https://api.slack.com/apps)

2. **Enable Socket Mode**
   - Go to "Socket Mode" in the sidebar
   - Enable Socket Mode
   - Generate an App-Level Token with `connections:write` scope
   - Save this as `SLACK_APP_TOKEN`

3. **Configure Bot Token Scopes** (OAuth & Permissions):

   ```
   channels:history
   channels:read
   chat:write
   commands
   groups:history
   groups:read
   im:history
   im:read
   im:write
   reactions:read
   reactions:write
   users:read
   users:read.email
   ```

4. **Enable Event Subscriptions**:
   - Subscribe to bot events:
     - `message.channels`
     - `message.groups`
     - `message.im`
     - `app_mention`

5. **Install the app** to your workspace and get the Bot Token (`SLACK_BOT_TOKEN`)

6. **Invite the bot** to your standup channel:
   ```
   /invite @YourBotName
   ```

### Ollama Setup

1. **Install Ollama** from [ollama.ai](https://ollama.ai)

2. **Pull the recommended model**:

   ```bash
   ollama pull llama3.3:70b
   ```

   Alternative models (faster but less capable):

   ```bash
   ollama pull llama3.1:8b
   ollama pull mixtral:8x7b
   ```

3. **Verify Ollama is running**:
   ```bash
   curl http://localhost:11434/api/tags
   ```

---

## 🏃 Running the Application

### Start the Bot

```bash
cd src
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

The bot will:

1. Validate all configuration
2. Check Ollama model availability
3. **Schedule daily standups at the configured IST time**
4. Start listening for Slack messages

### Manual Standup Trigger

Mention the bot in your standup channel:

```
@AIEngineeringManager start standup
```

### Available Commands

| Command                                                       | Description                        |
| ------------------------------------------------------------- | ---------------------------------- |
| `@bot start standup`                                          | Manually trigger the daily standup |
| `@bot status`                                                 | Check standup completion status    |
| `@bot leave email@example.com 2024-03-20 2024-03-25 vacation` | Mark someone on leave              |
| `@bot help`                                                   | Show available commands            |

---

## 📁 Project Structure

```
src/
├── config/
│   └── index.js              # Configuration with IST scheduling
├── services/
│   ├── jiraService.js        # JIRA API integration
│   ├── slackService.js       # Slack bot service
│   ├── llmService.js         # Ollama LLM integration
│   └── leaveService.js       # Leave management
├── workflows/
│   └── standupWorkflow.js    # Standup orchestration
├── data/
│   └── leave_records.json    # Leave data storage
├── index.js                  # Application entry point
├── package.json              # Dependencies
├── .env.example              # Environment template
└── .env                      # Your configuration (git-ignored)
```

---

## 🔄 Standup Flow

1. **Scheduled Trigger**: Bot initiates standup at configured IST time (Mon-Fri)
2. **Leave Check**: Identifies team members on leave
3. **Task Context**: Fetches each member's JIRA tasks
4. **Prompt**: Sends personalized standup prompts with task context
5. **Response Analysis**: LLM analyzes responses for:
   - Task updates
   - Status changes
   - Blockers
   - Timeline information
6. **Off-Topic Detection**: Redirects HLD/technical discussions
7. **Follow-up**: Asks for missing timelines on To-Do/In-Progress tasks
8. **JIRA Updates**: Automatically updates ticket statuses
9. **Summary**: Generates team standup summary with blockers highlighted

---

## 🧠 LLM Prompts

The AI is configured to:

- Keep standups focused on status updates
- Detect and redirect off-topic technical discussions
- Extract structured information from natural language
- Generate contextual follow-up questions
- Summarize team progress

---

## 📝 License

MIT

---

_Built with ❤️ for the hackathon_
