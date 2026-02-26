# AI-EM PRD Workflow

> **From Product Requirements to Actionable Development Tasks**

[← Back to Main Documentation](./ABOUT_AI_EM.md) | [← Analytics & Dashboards](./ANALYTICS_DASHBOARDS.md)

---

## 📋 Table of Contents

1. [Workflow Overview](#workflow-overview)
2. [PRD Ingestion](#prd-ingestion)
3. [Requirement Analysis](#requirement-analysis)
4. [Developer Discussion](#developer-discussion)
5. [Feasibility Assessment](#feasibility-assessment)
6. [Task Decomposition](#task-decomposition)
7. [Smart Assignment](#smart-assignment)
8. [Sprint Planning Integration](#sprint-planning-integration)
9. [Requirement Traceability](#requirement-traceability)
10. [Continuous Refinement](#continuous-refinement)

---

## Workflow Overview

AI-EM transforms the traditional PRD-to-development handoff into an intelligent, collaborative process that ensures requirements are understood, feasible, and properly decomposed before development begins.

### End-to-End Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      PRD-TO-TASK WORKFLOW                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐             │
│  │   PRD   │    │ AI-EM   │    │  Dev    │    │Feasible │             │
│  │ Upload  │───▶│Analysis │───▶│ Review  │───▶│  Scope  │             │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘             │
│       │              │              │              │                    │
│       │              │              │              │                    │
│       ▼              ▼              ▼              ▼                    │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐             │
│  │ Parse & │    │ Extract │    │ Discuss │    │ Confirm │             │
│  │ Validate│    │ Require-│    │ & Clarify│    │ Commit- │             │
│  │         │    │ ments   │    │         │    │ ments   │             │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘             │
│                                                                          │
│       │              │              │              │                    │
│       └──────────────┴──────────────┴──────────────┘                    │
│                              │                                           │
│                              ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    TASK CREATION PHASE                           │   │
│  │                                                                   │   │
│  │  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐      │   │
│  │  │Decompose│───▶│Estimate │───▶│ Assign  │───▶│ Create  │      │   │
│  │  │ Tasks   │    │ Points  │    │ Owners  │    │ JIRA    │      │   │
│  │  └─────────┘    └─────────┘    └─────────┘    └─────────┘      │   │
│  │                                                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Benefits

| Benefit               | Description                                           |
| --------------------- | ----------------------------------------------------- |
| **Reduced Ambiguity** | AI identifies unclear requirements before development |
| **Faster Handoff**    | Automated analysis reduces PM-Dev back-and-forth      |
| **Better Estimates**  | Historical data improves estimation accuracy          |
| **Balanced Workload** | Smart assignment prevents developer overload          |
| **Full Traceability** | Every task links back to original requirements        |

---

## PRD Ingestion

### Supported Input Formats

AI-EM accepts PRDs in multiple formats:

| Format           | Support Level | Features                           |
| ---------------- | ------------- | ---------------------------------- |
| **Markdown**     | Full          | Native parsing, best results       |
| **Google Docs**  | Full          | Direct integration, real-time sync |
| **Confluence**   | Full          | Page import, attachment support    |
| **Notion**       | Full          | Database and page support          |
| **Word (.docx)** | Full          | Formatting preserved               |
| **PDF**          | Partial       | Text extraction, tables supported  |
| **Plain Text**   | Basic         | Structure inferred                 |

### PRD Template (Recommended)

```markdown
# Product Requirements Document

## Document Info

- **Feature Name:** [Feature Name]
- **PRD ID:** PRD-2024-XXX
- **Author:** [PM Name]
- **Date:** [Date]
- **Target Release:** [Version/Date]

## Executive Summary

[Brief description of the feature and its business value]

## Problem Statement

[What problem does this solve? Who experiences this problem?]

## Goals & Success Metrics

| Goal     | Metric   | Target   |
| -------- | -------- | -------- |
| [Goal 1] | [Metric] | [Target] |

## User Stories

### US-001: [Story Title]

**As a** [user type]
**I want** [capability]
**So that** [benefit]

**Acceptance Criteria:**

- [ ] Criterion 1
- [ ] Criterion 2

### US-002: [Story Title]

...

## Requirements

### Functional Requirements

| ID     | Requirement   | Priority    | Notes |
| ------ | ------------- | ----------- | ----- |
| FR-001 | [Requirement] | Must Have   |       |
| FR-002 | [Requirement] | Should Have |       |

### Non-Functional Requirements

| ID      | Requirement   | Priority  | Notes |
| ------- | ------------- | --------- | ----- |
| NFR-001 | [Requirement] | Must Have |       |

## Technical Considerations

[Any known technical constraints or considerations]

## Dependencies

[External dependencies, other teams, third-party services]

## Out of Scope

[Explicitly list what is NOT included]

## Open Questions

[Questions that need answers before development]

## Appendix

[Wireframes, mockups, additional context]
```

### Ingestion Process

```yaml
ingestion_pipeline:
  steps:
    - document_upload:
        actions:
          - Validate file format
          - Extract text content
          - Preserve structure
          - Store original document

    - preprocessing:
        actions:
          - Normalize formatting
          - Identify sections
          - Extract tables
          - Parse user stories

    - validation:
        checks:
          - Required sections present
          - User stories well-formed
          - Acceptance criteria defined
          - Priority levels assigned

    - enrichment:
        actions:
          - Link to existing epics
          - Identify related PRDs
          - Tag technical domains
          - Flag potential risks
```

### Upload Interface

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      PRD UPLOAD                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                                                                   │   │
│  │     📄 Drag and drop your PRD here                               │   │
│  │                                                                   │   │
│  │     or                                                            │   │
│  │                                                                   │   │
│  │     [Browse Files]  [Import from Confluence]  [Import from Notion]│   │
│  │                                                                   │   │
│  │     Supported: .md, .docx, .pdf, Google Docs link                │   │
│  │                                                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  Recent PRDs:                                                            │
│  ├─ PRD-2024-015: Payment Integration (Uploaded Mar 10)                │
│  ├─ PRD-2024-014: User Dashboard v2 (Uploaded Mar 5)                   │
│  └─ PRD-2024-013: Notification System (Uploaded Feb 28)                │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Requirement Analysis

### AI-Powered Analysis

Once a PRD is ingested, AI-EM performs comprehensive analysis:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PRD ANALYSIS REPORT                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PRD: Payment Integration (PRD-2024-015)                                │
│  Analysis Status: ✅ Complete                                           │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    REQUIREMENT SUMMARY                           │   │
│  │                                                                   │   │
│  │  Total Requirements: 24                                          │   │
│  │  ├─ Functional: 18                                               │   │
│  │  ├─ Non-Functional: 6                                            │   │
│  │  │                                                                │   │
│  │  Priority Breakdown:                                              │   │
│  │  ├─ Must Have: 12 (50%)                                          │   │
│  │  ├─ Should Have: 8 (33%)                                         │   │
│  │  └─ Nice to Have: 4 (17%)                                        │   │
│  │                                                                   │   │
│  │  User Stories: 8                                                  │   │
│  │  Acceptance Criteria: 32                                         │   │
│  │                                                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    CLARITY ASSESSMENT                            │   │
│  │                                                                   │   │
│  │  Overall Clarity Score: 78/100                                   │   │
│  │                                                                   │   │
│  │  ⚠️ Issues Found:                                                │   │
│  │                                                                   │   │
│  │  1. Ambiguous Requirement (FR-007):                              │   │
│  │     "System should handle high traffic"                          │   │
│  │     → Suggestion: Define specific throughput targets             │   │
│  │                                                                   │   │
│  │  2. Missing Acceptance Criteria (US-004):                        │   │
│  │     "User can view transaction history"                          │   │
│  │     → Suggestion: Define date range, pagination, filters         │   │
│  │                                                                   │   │
│  │  3. Undefined Edge Case (FR-012):                                │   │
│  │     "Handle payment failures"                                    │   │
│  │     → Suggestion: Specify retry logic, user notification         │   │
│  │                                                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    TECHNICAL ANALYSIS                            │   │
│  │                                                                   │   │
│  │  Identified Technical Domains:                                   │   │
│  │  ├─ Backend API (12 requirements)                                │   │
│  │  ├─ Frontend UI (8 requirements)                                 │   │
│  │  ├─ Database (4 requirements)                                    │   │
│  │  └─ External Integration (6 requirements)                        │   │
│  │                                                                   │   │
│  │  Potential Risks:                                                │   │
│  │  ├─ 🔴 External API dependency (Stripe)                         │   │
│  │  ├─ 🟡 PCI compliance requirements                               │   │
│  │  └─ 🟡 Performance requirements need clarification               │   │
│  │                                                                   │   │
│  │  Similar Past Projects:                                          │   │
│  │  ├─ Subscription Billing (Q3 2023) - 85% similarity             │   │
│  │  └─ Refund System (Q1 2023) - 60% similarity                    │   │
│  │                                                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  [Request Clarification]  [Proceed to Dev Discussion]  [Export Report] │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Automated Clarification Requests

```yaml
clarification_workflow:
  triggers:
    - ambiguous_requirement
    - missing_acceptance_criteria
    - undefined_edge_case
    - conflicting_requirements
    - missing_priority

  actions:
    - Generate clarification questions
    - Send to PM via Slack/Email
    - Track response status
    - Update PRD when clarified

  example_questions:
    - requirement: "System should be fast"
      question: "Could you specify the expected response time? (e.g., <200ms for API calls)"

    - requirement: "Support multiple currencies"
      question: "Which currencies should be supported at launch? Should exchange rates be real-time?"

    - requirement: "Handle errors gracefully"
      question: "What should happen when a payment fails? Retry? Notify user? Both?"
```

---

## Developer Discussion

### Facilitated Discussion Sessions

AI-EM facilitates structured discussions between PMs and developers:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PRD DISCUSSION SESSION                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PRD: Payment Integration | Participants: PM (Alice), Devs (Bob, Carol) │
│                                                                          │
│  AI-EM: "Let's review the Payment Integration PRD. I've identified      │
│          3 areas that need discussion. Let's start with the first one." │
│                                                                          │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  📌 Discussion Point 1: Transaction Volume Requirements                  │
│                                                                          │
│  AI-EM: "FR-007 states 'handle high traffic' but doesn't specify        │
│          numbers. Alice, what transaction volume are we expecting?"      │
│                                                                          │
│  Alice: "We're targeting 1000 transactions per minute at peak."         │
│                                                                          │
│  AI-EM: "Got it. Bob, Carol - is 1000 TPM achievable with our current  │
│          architecture?"                                                  │
│                                                                          │
│  Bob: "We'd need to add caching and possibly a queue system.            │
│        That's additional work not in the original scope."               │
│                                                                          │
│  AI-EM: "I'm noting this as a scope addition. Alice, should we:         │
│          A) Add caching/queue work to this PRD                          │
│          B) Reduce the target to what current architecture supports     │
│          C) Split into phases - MVP first, then scale"                  │
│                                                                          │
│  Alice: "Let's go with option C - phased approach."                     │
│                                                                          │
│  AI-EM: "Noted. I'll create two phases:                                 │
│          Phase 1: Core payment flow (100 TPM)                           │
│          Phase 2: Scaling infrastructure (1000 TPM)                     │
│          Moving to the next discussion point..."                        │
│                                                                          │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  📌 Discussion Point 2: Error Handling Strategy                          │
│  ...                                                                     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Discussion Outcomes

```yaml
discussion_outcomes:
  session_id: "PRD-2024-015-DISC-001"
  date: "2024-03-12"
  duration: "45 minutes"
  participants:
    - alice@company.com (PM)
    - bob@company.com (Backend Dev)
    - carol@company.com (Frontend Dev)

  decisions:
    - topic: "Transaction Volume"
      decision: "Phased approach - 100 TPM MVP, 1000 TPM Phase 2"
      rationale: "Reduces initial scope while maintaining scalability path"

    - topic: "Error Handling"
      decision: "3 retry attempts with exponential backoff, then user notification"
      rationale: "Balances user experience with system reliability"

    - topic: "Currency Support"
      decision: "USD, EUR, GBP at launch; others in Phase 2"
      rationale: "Covers 80% of target market"

  clarifications:
    - requirement: "FR-007"
      original: "Handle high traffic"
      clarified: "Support 100 TPM in Phase 1, 1000 TPM in Phase 2"

  new_requirements:
    - "Add transaction queue for peak load handling (Phase 2)"
    - "Implement circuit breaker for external API calls"

  deferred_items:
    - "Multi-currency exchange rate management"
    - "Advanced fraud detection"

  action_items:
    - owner: "Alice"
      action: "Update PRD with phased approach"
      due: "2024-03-13"

    - owner: "Bob"
      action: "Spike on queue implementation options"
      due: "2024-03-15"
```

---

## Feasibility Assessment

### Automated Feasibility Analysis

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    FEASIBILITY ASSESSMENT                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PRD: Payment Integration (Phase 1)                                     │
│  Target Timeline: 4 weeks (2 sprints)                                   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    EFFORT ESTIMATION                             │   │
│  │                                                                   │   │
│  │  Based on historical data and requirement analysis:              │   │
│  │                                                                   │   │
│  │  Estimated Total: 85-105 story points                           │   │
│  │  Team Capacity (4 weeks): 84 story points                       │   │
│  │                                                                   │   │
│  │  ⚠️ FEASIBILITY: AT RISK                                        │   │
│  │                                                                   │   │
│  │  Breakdown by Category:                                          │   │
│  │  ├─ Backend API: 35-45 pts                                       │   │
│  │  ├─ Frontend UI: 25-30 pts                                       │   │
│  │  ├─ Integration: 15-20 pts                                       │   │
│  │  └─ Testing: 10-15 pts                                           │   │
│  │                                                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    RISK FACTORS                                  │   │
│  │                                                                   │   │
│  │  🔴 High Risk:                                                   │   │
│  │  ├─ External API integration (Stripe) - 2 week lead time        │   │
│  │  └─ PCI compliance review required                               │   │
│  │                                                                   │   │
│  │  🟡 Medium Risk:                                                 │   │
│  │  ├─ New technology (payment SDK) - learning curve               │   │
│  │  └─ Design dependencies not yet finalized                        │   │
│  │                                                                   │   │
│  │  🟢 Low Risk:                                                    │   │
│  │  └─ Standard CRUD operations for transaction records            │   │
│  │                                                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    RECOMMENDATIONS                               │   │
│  │                                                                   │   │
│  │  Option A: Reduce Scope (Recommended)                            │   │
│  │  ├─ Remove: Advanced reporting (10 pts)                          │   │
│  │  ├─ Defer: Email receipts (8 pts)                                │   │
│  │  └─ New estimate: 67-87 pts ✅ Feasible                         │   │
│  │                                                                   │   │
│  │  Option B: Extend Timeline                                       │   │
│  │  ├─ Add 1 sprint (2 weeks)                                       │   │
│  │  └─ New capacity: 126 pts ✅ Comfortable buffer                 │   │
│  │                                                                   │   │
│  │  Option C: Add Resources                                         │   │
│  │  ├─ Add 1 developer                                              │   │
│  │  └─ New capacity: 105 pts ✅ Feasible (tight)                   │   │
│  │                                                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  [Accept Option A]  [Accept Option B]  [Accept Option C]  [Discuss]    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Scope Negotiation

```yaml
scope_negotiation:
  original_scope:
    must_have: 12 requirements (60 pts)
    should_have: 8 requirements (30 pts)
    nice_to_have: 4 requirements (15 pts)
    total: 105 pts

  capacity: 84 pts
  gap: 21 pts

  negotiation_options:
    option_1:
      name: "Core MVP"
      include:
        - all_must_have: 60 pts
        - selected_should_have: 20 pts
      defer:
        - remaining_should_have: 10 pts
        - all_nice_to_have: 15 pts
      total: 80 pts
      buffer: 4 pts (5%)

    option_2:
      name: "Feature Complete"
      include:
        - all_must_have: 60 pts
        - all_should_have: 30 pts
      defer:
        - all_nice_to_have: 15 pts
      total: 90 pts
      timeline_extension: 1 week

  final_agreement:
    selected: option_1
    committed_scope:
      - FR-001 through FR-012 (Must Have)
      - FR-013, FR-014, FR-016, FR-018 (Should Have)
    deferred_scope:
      - FR-015, FR-017, FR-019, FR-020 (Should Have)
      - FR-021 through FR-024 (Nice to Have)
    sign_off:
      - pm: "alice@company.com"
      - tech_lead: "bob@company.com"
      - date: "2024-03-13"
```

---

## Task Decomposition

### Intelligent Task Breakdown

AI-EM decomposes requirements into development tasks:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    TASK DECOMPOSITION                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Requirement: FR-001 - Process credit card payments                     │
│  Story Points: 8                                                         │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    GENERATED TASKS                               │   │
│  │                                                                   │   │
│  │  Epic: PAY - Payment Integration                                 │   │
│  │  └─ Story: PAY-101 - Credit Card Payment Processing              │   │
│  │      │                                                            │   │
│  │      ├─ Task: PAY-101-1 - Create payment API endpoint            │   │
│  │      │   Type: Backend | Points: 2 | Skills: Node.js, REST       │   │
│  │      │   Description: POST /api/v1/payments/charge               │   │
│  │      │   Acceptance: Returns transaction ID, handles validation  │   │
│  │      │                                                            │   │
│  │      ├─ Task: PAY-101-2 - Integrate Stripe SDK                   │   │
│  │      │   Type: Backend | Points: 3 | Skills: Stripe, Node.js     │   │
│  │      │   Description: Implement Stripe charge creation           │   │
│  │      │   Acceptance: Successful test transaction in sandbox      │   │
│  │      │                                                            │   │
│  │      ├─ Task: PAY-101-3 - Create payment form UI                 │   │
│  │      │   Type: Frontend | Points: 2 | Skills: React, Forms       │   │
│  │      │   Description: Card input with Stripe Elements            │   │
│  │      │   Acceptance: PCI-compliant form, validation feedback     │   │
│  │      │                                                            │   │
│  │      └─ Task: PAY-101-4 - Write integration tests                │   │
│  │          Type: QA | Points: 1 | Skills: Jest, Testing            │   │
│  │          Description: E2E tests for payment flow                 │   │
│  │          Acceptance: >80% coverage, all scenarios tested         │   │
│  │                                                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  [Edit Tasks]  [Approve & Create in JIRA]  [Request Review]            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Decomposition Rules

```yaml
decomposition_rules:
  task_sizing:
    max_story_points: 5
    ideal_story_points: 2-3
    split_threshold: 5 # Split tasks larger than this

  task_types:
    - backend
    - frontend
    - database
    - integration
    - testing
    - documentation
    - devops

  required_fields:
    - title
    - description
    - acceptance_criteria
    - story_points
    - required_skills
    - dependencies

  naming_convention:
    epic: "[PROJECT]-[Feature Name]"
    story: "[PROJECT]-[XXX] - [User Story Title]"
    task: "[PROJECT]-[XXX]-[N] - [Task Description]"

  dependency_detection:
    - Identify blocking relationships
    - Flag external dependencies
    - Suggest parallel work streams
```

### Task Templates

```yaml
task_templates:
  api_endpoint:
    title: "Create {method} {endpoint} endpoint"
    description: |
      Implement {method} endpoint at {endpoint}

      Request: {request_schema}
      Response: {response_schema}

      Error handling:
      - 400: Invalid request
      - 401: Unauthorized
      - 500: Server error
    acceptance_criteria:
      - "Endpoint responds with correct status codes"
      - "Request validation implemented"
      - "Response matches schema"
      - "Unit tests written"
    default_points: 2

  ui_component:
    title: "Create {component_name} component"
    description: |
      Implement {component_name} React component

      Props: {props}
      State: {state}

      Design: {figma_link}
    acceptance_criteria:
      - "Component matches design"
      - "Responsive on mobile/desktop"
      - "Accessibility requirements met"
      - "Unit tests written"
    default_points: 2

  integration:
    title: "Integrate with {service_name}"
    description: |
      Implement integration with {service_name}

      API Documentation: {api_docs}
      Authentication: {auth_method}
    acceptance_criteria:
      - "Successful connection in sandbox"
      - "Error handling implemented"
      - "Retry logic for transient failures"
      - "Integration tests passing"
    default_points: 3
```

---

## Smart Assignment

### Assignment Algorithm

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SMART ASSIGNMENT ENGINE                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    INPUT FACTORS                                 │   │
│  │                                                                   │   │
│  │  Task Requirements          Developer Profiles                   │   │
│  │  ├─ Required skills         ├─ Skill matrix                     │   │
│  │  ├─ Complexity level        ├─ Current workload                 │   │
│  │  ├─ Priority                ├─ Historical velocity              │   │
│  │  ├─ Dependencies            ├─ Availability                     │   │
│  │  └─ Deadline                └─ Growth goals                     │   │
│  │                                                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              │                                           │
│                              ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    MATCHING ALGORITHM                            │   │
│  │                                                                   │   │
│  │  For each task:                                                  │   │
│  │  1. Filter developers with required skills                       │   │
│  │  2. Score by skill proficiency (40%)                            │   │
│  │  3. Score by current capacity (30%)                             │   │
│  │  4. Score by growth opportunity (15%)                           │   │
│  │  5. Score by past performance on similar tasks (15%)            │   │
│  │  6. Apply constraints (PTO, dependencies)                       │   │
│  │  7. Optimize for team balance                                   │   │
│  │                                                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              │                                           │
│                              ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    ASSIGNMENT OUTPUT                             │   │
│  │                                                                   │   │
│  │  PAY-101-1 (API endpoint) → Bob                                 │   │
│  │  ├─ Skill match: 95% (Node.js expert)                           │   │
│  │  ├─ Capacity: 8/21 pts available                                │   │
│  │  └─ Confidence: High                                            │   │
│  │                                                                   │   │
│  │  PAY-101-2 (Stripe integration) → Bob                           │   │
│  │  ├─ Skill match: 85% (Payment experience)                       │   │
│  │  ├─ Capacity: 5/21 pts remaining                                │   │
│  │  └─ Confidence: High                                            │   │
│  │                                                                   │   │
│  │  PAY-101-3 (Payment form) → Carol                               │   │
│  │  ├─ Skill match: 90% (React specialist)                         │   │
│  │  ├─ Capacity: 12/18 pts available                               │   │
│  │  └─ Confidence: High                                            │   │
│  │                                                                   │   │
│  │  PAY-101-4 (Tests) → Dave                                       │   │
│  │  ├─ Skill match: 80% (Testing focus)                            │   │
│  │  ├─ Capacity: 15/15 pts available                               │   │
│  │  ├─ Growth: Aligns with testing skill goal                      │   │
│  │  └─ Confidence: Medium (stretch assignment)                     │   │
│  │                                                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Skill Matrix

```yaml
skill_matrix:
  developers:
    bob:
      skills:
        nodejs: 5 # Expert
        python: 3 # Intermediate
        react: 2 # Basic
        stripe: 4 # Advanced
        testing: 3 # Intermediate
      capacity_per_sprint: 21
      current_load: 13
      growth_goals:
        - "Improve React skills"

    carol:
      skills:
        nodejs: 3
        react: 5
        typescript: 4
        css: 5
        testing: 3
      capacity_per_sprint: 18
      current_load: 6
      growth_goals:
        - "Learn backend development"

    dave:
      skills:
        nodejs: 2
        react: 3
        testing: 4
        documentation: 4
      capacity_per_sprint: 15
      current_load: 0
      growth_goals:
        - "Become testing specialist"
        - "Learn CI/CD"
```

### Load Balancing

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    TEAM WORKLOAD DISTRIBUTION                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Sprint 25 - After Assignment                                           │
│                                                                          │
│  Bob     ████████████████████░  20/21 pts (95%)                        │
│  Carol   ████████████████░░░░░  16/18 pts (89%)                        │
│  Dave    ████████████░░░░░░░░░  12/15 pts (80%)                        │
│                                                                          │
│  Team Total: 48/54 pts (89%)                                            │
│                                                                          │
│  ⚠️ Warning: Bob is near capacity                                       │
│  💡 Suggestion: Consider moving PAY-102-3 to Carol                      │
│                                                                          │
│  [Rebalance]  [Accept Current]  [Manual Adjust]                        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Sprint Planning Integration

### Automated Sprint Population

```yaml
sprint_planning:
  sprint: "Sprint 25"
  dates: "2024-03-18 to 2024-03-29"

  auto_populated:
    from_prd: "PRD-2024-015"
    stories:
      - PAY-101: 8 pts (Bob, Carol)
      - PAY-102: 5 pts (Bob)
      - PAY-103: 3 pts (Carol)
      - PAY-104: 5 pts (Dave)
    total: 21 pts

  carryover:
    from_sprint: "Sprint 24"
    stories:
      - AUTH-125: 3 pts (incomplete)
    total: 3 pts

  bugs:
    - BUG-456: 2 pts (P1)
    - BUG-457: 1 pt (P2)
    total: 3 pts

  tech_debt:
    - TECH-089: 3 pts (refactoring)
    total: 3 pts

  buffer:
    percentage: 15%
    points: 8 pts

  sprint_summary:
    committed: 38 pts
    capacity: 54 pts
    utilization: 70%
    buffer_remaining: 16 pts
```

### Sprint Goal Generation

```markdown
## Sprint 25 Goal

**Primary Objective:** Complete core payment processing functionality

**Key Deliverables:**

1. ✅ Credit card payment flow (end-to-end)
2. ✅ Transaction recording and history
3. ✅ Basic error handling and user feedback

**Success Criteria:**

- Users can complete a test payment in staging
- Transaction history displays correctly
- Error states are handled gracefully

**Risks to Monitor:**

- Stripe API credential delivery (external dependency)
- PCI compliance review timeline

**Not in Scope:**

- Refunds (Sprint 26)
- Multi-currency (Phase 2)
```

---

## Requirement Traceability

### Traceability Matrix

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    REQUIREMENT TRACEABILITY                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PRD: Payment Integration (PRD-2024-015)                                │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Requirement    │ Stories      │ Tasks        │ Status          │   │
│  │─────────────────┼──────────────┼──────────────┼─────────────────│   │
│  │  FR-001         │ PAY-101      │ PAY-101-1    │ ✅ Done         │   │
│  │  Credit card    │              │ PAY-101-2    │ 🔄 In Progress  │   │
│  │  payments       │              │ PAY-101-3    │ 📋 To Do        │   │
│  │                 │              │ PAY-101-4    │ 📋 To Do        │   │
│  │─────────────────┼──────────────┼──────────────┼─────────────────│   │
│  │  FR-002         │ PAY-102      │ PAY-102-1    │ 📋 To Do        │   │
│  │  Transaction    │              │ PAY-102-2    │ 📋 To Do        │   │
│  │  history        │              │              │                 │   │
│  │─────────────────┼──────────────┼──────────────┼─────────────────│   │
│  │  FR-003         │ PAY-103      │ PAY-103-1    │ 📋 To Do        │   │
│  │  Error handling │              │ PAY-103-2    │ 📋 To Do        │   │
│  │─────────────────┼──────────────┼──────────────┼─────────────────│   │
│  │  ...            │ ...          │ ...          │ ...             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  Coverage Summary:                                                       │
│  ├─ Requirements with tasks: 12/12 (100%)                              │
│  ├─ Tasks completed: 4/32 (12.5%)                                      │
│  └─ Acceptance criteria verified: 8/64 (12.5%)                         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Impact Analysis

```yaml
impact_analysis:
  scenario: "FR-001 requirement change"
  change: "Add Apple Pay support"

  impact:
    stories_affected:
      - PAY-101: "Add Apple Pay button to payment form"
      - PAY-102: "Update transaction history for Apple Pay"

    tasks_affected:
      - PAY-101-2: "Extend Stripe integration for Apple Pay"
      - PAY-101-3: "Add Apple Pay button component"
      - NEW: "PAY-101-5: Apple Pay specific testing"

    effort_impact:
      additional_points: 8
      timeline_impact: "3-4 days"

    dependencies:
      - "Apple Developer account setup"
      - "Stripe Apple Pay configuration"

  recommendation: |
    Consider deferring to Phase 2 to maintain current timeline.
    If must-have, extend sprint by 1 week.
```

---

## Continuous Refinement

### Backlog Grooming Assistance

```yaml
grooming_assistance:
  automated_tasks:
    - Identify stale tickets (>30 days untouched)
    - Flag incomplete acceptance criteria
    - Suggest story point adjustments based on actuals
    - Detect duplicate or overlapping stories
    - Recommend story splitting for large items

  grooming_report:
    stale_items:
      - PAY-050: "Created 45 days ago, no updates"
      - PAY-051: "Blocked for 20 days"

    incomplete_items:
      - PAY-060: "Missing acceptance criteria"
      - PAY-061: "No story points assigned"

    estimation_adjustments:
      - PAY-055: "Similar to PAY-040 (actual: 5pts), suggest 5pts vs current 3pts"

    split_recommendations:
      - PAY-070: "13 points - recommend splitting into 2-3 stories"
```

### Retrospective Integration

```yaml
retrospective_learnings:
  sprint: "Sprint 24"

  estimation_accuracy:
    committed: 42 pts
    completed: 38 pts
    accuracy: 90%

  learnings_applied:
    - finding: "Stripe integration took 50% longer than estimated"
      action: "Increase estimates for external API integrations by 1.5x"
      applied_to: ["PAY-101-2", "PAY-105-1"]

    - finding: "Testing tasks consistently underestimated"
      action: "Add 1 point buffer to all testing tasks"
      applied_to: ["PAY-101-4", "PAY-102-3"]

  process_improvements:
    - "Add spike tasks for unfamiliar technologies"
    - "Include design review time in frontend estimates"
```

### PRD Version Control

```yaml
prd_versioning:
  prd_id: "PRD-2024-015"

  versions:
    - version: "1.0"
      date: "2024-03-10"
      author: "alice@company.com"
      changes: "Initial version"

    - version: "1.1"
      date: "2024-03-13"
      author: "alice@company.com"
      changes:
        - "Added phased approach for scalability"
        - "Clarified transaction volume requirements"
        - "Deferred multi-currency to Phase 2"
      affected_tasks:
        - PAY-101: "Updated acceptance criteria"
        - PAY-107: "Moved to Phase 2 backlog"

    - version: "1.2"
      date: "2024-03-20"
      author: "alice@company.com"
      changes:
        - "Added Apple Pay requirement"
      affected_tasks:
        - PAY-101: "Added Apple Pay tasks"
        - NEW: "PAY-110 created"
```

---

[← Back to Main Documentation](./ABOUT_AI_EM.md) | [Security & Compliance →](./SECURITY_COMPLIANCE.md)
