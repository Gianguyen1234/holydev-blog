---
title: "Challenge: Thundering Herd Problem"
description: "Reproduce and analyze cache stampede under high concurrency, then propose a solution with clear reasoning."
pubDate: 2026-04-07
category: "Concurrency"
image: "/images/concurrency/thundering-herd-challenge.png"
---
![Thundering Herd Challenge – Learn Concurrency & Win JetBrains IDE!](/images/concurrency/thundering-herd-challenge.png)
## Problem

In real-world backend systems, caching is often used to reduce database load and improve latency.

However, there’s a tricky situation:

When a cache key expires or is missing, **many requests can hit the same data simultaneously**.

Instead of being served from cache, all these requests hit the database at the same time.

👉 Consequences:
- Database receives a sudden spike of queries  
- Latency spikes dramatically  
- The system can easily become overloaded  

This phenomenon is known as:

> **Thundering Herd Problem (Cache Stampede)**

---

## Challenge Goal

In this challenge, you will:

- Reproduce the problem under high concurrency  
- Analyze why it happens  
- Propose your solution **with clear reasoning**  

👉 There is **no single correct answer**  
👉 What matters most is how well you **understand the problem and explain your approach**

---

## How to Participate

1. Fork the repository:  
   https://github.com/Gianguyen1234/thundering-herd-challenge

2. Implement your solution in your forked repo  

3. Submit a Pull Request to the main repo within the specified time window  

> **Note:** You can use **any programming language**. Concurrency concepts are the same across languages. JetBrains IDE licenses support multiple languages, so language choice should not limit participation.  

---

## Submission Requirements

Your repository should include:

### 1. Source Code

### 2. README (Clear Explanation)

Include:

- How to run your project  
- Technologies used (language, framework, storage, etc.)  
- Explanation of the problem (how the Thundering Herd occurs)  
- How you reproduced the issue  
- Your solution and reasoning (why it works, trade-offs)

### 3. Video

The video should show:

- The system under Thundering Herd with high concurrency  
- Evidence (logs / metrics / output)  
- Demo after applying your solution and comparison of results  

---

## Endpoints

### GET `/api/product/{id}`

- **Path params:**  
  - `id`: product ID

- **Behavior:**  
  - Check cache  
  - Cache miss → query database (simulate ~100ms delay)  
  - Return product data  

- **Failure responses:**  
  - 400 if `id` is invalid  
  - 404 if product does not exist (optional)

---

## Concurrency & Caching

- System should handle **100–1000+ concurrent requests**  
- Cache key: `product:{id}`  
- TTL: optional  

Suggested flow:

- Start **without any protection** → observe the problem  
- Then implement your solution to mitigate it  

---

## Storage

You can use any storage:

- In-memory  
- Database  
- Redis  
- Or any storage of your choice  

---

## Acceptance Criteria

Submissions will be evaluated based on:

- Did you reproduce the problem?  
- Clear evidence (logs / metrics / output)  
- Does your solution reduce the herd effectively?  
- Explanation quality:
  - How well do you understand the problem?  
  - Why did you choose your solution?  
  - What are the trade-offs?  

---

## Timeline

- **Start:** 07/04/2026 (GMT+7)  
- **Deadline:** 07/06/2026 (GMT+7)  
- **Submit PR:** 20:00 – 21:00 (GMT+7)

---

## Rules

- No restriction on programming language  
- No “single correct answer”  
- Open-ended challenge  

⚠️ Important:

- Code alone is not everything  
- What matters most:
  - How well you understand the problem  
  - How you analyze it  
  - How clearly you explain it  

---

## Reward

🎁 12 JetBrains IDE licenses  

- Max **1 license per participant**  
- Limited quantity  

> Not every submission receives a license  

Rewards go to those who:

- Understand the problem clearly  
- Analyze effectively  
- Explain convincingly  
- Actively engage and share their approach  

---

## Final Note

I created this challenge not just to code and win rewards, but to **share reasoning and thought process**.  

Every submission has value. The most **clear, insightful, or unique explanations** will be highlighted so that others can learn from them.

I hope that in the future, anyone learning about this problem can come here, read multiple approaches, understand the reasoning, and maybe even thank the contributors.

Top submissions will also be **recognized in the README** to acknowledge their contribution to the community.  

12 participants with the **best explanations** will receive a JetBrains IDE license 🥂  

