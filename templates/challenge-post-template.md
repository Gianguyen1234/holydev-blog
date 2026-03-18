---
title: "Challenge: <Short Challenge Title>"
description: "<One-line technical summary of the challenge>"
pubDate: 2026-03-03
category: "Concurrency"
---

## Slug Naming Convention

- File name format: `challenge-<topic>-<core-constraint>.md`
- Use lowercase and hyphens only
- Keep it concise (3-6 words after `challenge-`)
- Good examples:
- `challenge-rate-limited-analytics-hot-key-cache.md`
- `challenge-ordering-idempotency-webhook-consumer.md`
- `challenge-bounded-worker-pool-backpressure.md`

## Problem

<Describe the engineering problem in 2-4 sentences.>

## Endpoints

### 1) <METHOD> `<PATH>`

- Body: `<JSON body or N/A>`
- Validation rules:
- Behavior:
- Failure responses:

### 2) <METHOD> `<PATH>`

- Query params:
- Behavior:
- Example response:

```json
{
  "example": "value"
}
```

## Concurrency & Caching

- Concurrency requirements:
- Cache key:
- TTL:
- Staleness policy:
- Thundering-herd policy:

## Storage

- <In-memory only / DB / mixed>

## Acceptance Criteria

- <Correctness criteria #1>
- <Correctness criteria #2>
- <Load/concurrency criteria>

## Stretch Goals

- <Stretch goal #1>
- <Stretch goal #2>

## Suggested Implementation Constraints (Optional)

- <Data structures, libraries, constraints>

## Expected Deliverables

- Source code
- README with design decisions
- Test evidence (unit + concurrency/load)
