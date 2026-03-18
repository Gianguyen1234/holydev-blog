---
title: "Challenge: Rate-Limited Analytics API with Hot-Key Cache (Spring Boot)"
description: "Build an in-memory analytics API with per-user rate limiting, time-window stats, and hot-key cache protection under concurrency."
pubDate: 2026-03-03
category: "Concurrency"
---

## Problem

Build an analytics API in Spring Boot, in-memory only, and keep correctness under parallel load.

## Endpoints

### 1) POST `/events`

- Body: `{ "userId": "u1", "type": "click" }`
- Validate `type` in `click|view|purchase`
- Store event
- Rate limit: `100 requests/minute` per `userId`
- Return `429` if exceeded

### 2) GET `/stats?type=click&window=60`

- Return the count of events of `type` in the last `window` seconds
- Example response:

```json
{ "type": "click", "window": 60, "count": 123 }
```

## Concurrency & Caching

- Must be concurrency-safe under parallel requests
- Add an in-memory cache for hot stats queries
- Cache key: `type + window`
- TTL: `5 seconds`
- Must not return stale data past TTL
- Avoid thundering herd:
- Only one recompute per key at a time
- Other requests should either wait or serve old value (you decide, document it)

## Storage

- In-memory only (no DB)

## Acceptance Criteria

- Correct rate limiting under concurrent requests
- `GET /stats` is accurate for the requested window
- Cache works and is concurrency-safe
- Under parallel load, only rate-limited requests fail

## Stretch Goals

- Sliding window counter instead of storing all events
- `GET /health`
- Basic metrics: total events, cache hits/misses

## Expected Deliverables

- Source code
- A short README explaining:
- Chosen data structures
- Cache invalidation and TTL strategy
- Herd-control strategy
- Concurrency/load test evidence


