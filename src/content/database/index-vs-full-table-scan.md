---
title: "Index vs Full Table Scan: Vì sao query chậm?"
description: "Hiểu rõ sự khác biệt giữa Index Scan và Full Table Scan trong database và cách tối ưu query thực tế."
pubDate: 2026-03-18
category: "Database Internals"
---

# Index vs Full Table Scan: Vì sao query chậm?

Khi bạn viết một query SQL đơn giản:

```sql
SELECT * FROM users WHERE email = 'test@gmail.com';