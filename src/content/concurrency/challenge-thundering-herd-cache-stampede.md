---
title: "Challenge: Thundering Herd Problem"
description: "Reproduce and analyze cache stampede under high concurrency, then propose a solution with clear reasoning."
pubDate: 2026-04-06
category: "Concurrency"
---

## Problem

Trong các hệ thống backend thực tế, cache thường được sử dụng để giảm tải cho database và cải thiện latency.

Tuy nhiên, có một tình huống khá “đau đầu”:

Khi một key trong cache bị miss hoặc vừa hết hạn, nhiều request có thể đồng thời truy cập vào cùng một dữ liệu đó.

Thay vì được phục vụ từ cache, tất cả các request này sẽ cùng lúc đổ xuống database để lấy dữ liệu.

👉 Hệ quả:
- Database bị dội một lượng lớn query trong thời gian ngắn
- Latency tăng đột biến
- Hệ thống dễ rơi vào trạng thái quá tải

Hiện tượng này được gọi là:

> **Thundering Herd Problem (Cache Stampede)**

---

## Mục tiêu của challenge

Trong challenge này, bạn sẽ:

- Tái hiện lại vấn đề trong môi trường concurrency cao  
- Phân tích nguyên nhân tại sao nó xảy ra  
- Đưa ra giải pháp của bạn (kèm reasoning rõ ràng)

👉 Không có “đáp án đúng”  
👉 Quan trọng là bạn **hiểu vấn đề đến đâu và giải thích được gì**

---

## How to Participate

1. Fork repository:
   https://github.com/Gianguyen1234/thundering-herd-challenge

2. Implement solution trong repo của bạn

3. Submit Pull Request về repo gốc trong khung giờ quy định

---

## Yêu cầu bài nộp

Repository của bạn cần có:

### 1. Source code

---

### 2. README (trình bày rõ ràng)

Bao gồm:

- Cách chạy project  
- Công nghệ sử dụng (ngôn ngữ, framework, storage, v.v.)  
- Giải thích vấn đề (thundering herd xảy ra như thế nào)  
- Cách bạn tái hiện (reproduce) vấn đề  
- Giải pháp của bạn và reasoning (vì sao nó hoạt động, trade-offs)

---

### 3. Video 

Trong video, bạn cần:

- Demo hệ thống khi bị thundering herd dưới concurrency  
- Cho thấy **evidence** (log / metrics / output)  
- Demo sau khi fix và so sánh kết quả  

---

## Endpoints

### GET `/api/product/{id}`

- Path params:
  - `id`: product id

- Behavior:
  - Kiểm tra cache  
  - Cache miss → query database (giả lập delay ~100ms)  
  - Trả về dữ liệu product  

- Failure responses:
  - 400 nếu `id` không hợp lệ  
  - 404 nếu product không tồn tại (optional)

---

## Concurrency & Caching

- Hệ thống cần xử lý được nhiều request đồng thời (100–1000+)  
- Cache key: `product:{id}`  
- TTL: tuỳ chọn  

Flow gợi ý:

- Ban đầu: **không có protection** → để thấy vấn đề xảy ra  
- Sau đó: bạn tự thiết kế cách xử lý  

---

## Storage

Bạn có thể dùng bất kỳ loại storage nào:

- In-memory  
- Database  
- Redis  
- hoặc bất cứ thứ gì bạn muốn  

---

## Acceptance Criteria

Bài làm sẽ được đánh giá dựa trên:

- Bạn có tái hiện được vấn đề hay không  
- Có evidence rõ ràng (log / metrics / output)  
- Giải pháp có thực sự giảm được herd  
- Cách bạn giải thích:
  - Hiểu vấn đề như thế nào  
  - Vì sao chọn giải pháp đó  
  - Trade-offs là gì  

---

## Timeline

- Start: Tối hôm nay (GMT+7)  
- Deadline: Tối ngày **07/06** (GMT+7)  
- Submit PR: **20:00 – 21:00** (GMT+7)  

---

## Rules

- Không giới hạn ngôn ngữ  
- Không có “đáp án đúng”  
- Đây là đề mở  

⚠️ Quan trọng:

- Code không phải là tất cả  
- Điều được đánh giá cao là:
  - Cách bạn hiểu vấn đề  
  - Cách bạn phân tích  
  - Cách bạn giải thích  

---

## Reward

🎁 12 licenses JetBrains IDE  

- Mỗi người tối đa 1 license  
- Số lượng có hạn  

> Không phải cứ nộp là sẽ nhận thưởng.

Reward sẽ dành cho những người:

- Hiểu vấn đề rõ ràng  
- Phân tích tốt  
- Giải thích thuyết phục  
- Chủ động trao đổi  

---

## Final Note
Mình tạo ra sân chơi này không chỉ để mọi người tham gia challenge và nhận thưởng, mà còn là nơi các dev có thể chia sẻ cách suy nghĩ và lý giải của riêng mình. 

Mỗi bài giải đều có giá trị riêng. Những lời giải rõ ràng, dễ hiểu, hoặc có góc nhìn thú vị sẽ được ưu tiên highlight để người khác có thể học lại sau này.

Hy vọng rằng trong tương lai, khi ai đó tìm hiểu về bài toán này, họ có thể vào đây, đọc lại các lời giải, hiểu được cách tư duy, và thậm chí biết ơn những người đã chia sẻ trước đó.

Ngoài ra, những người có lời giải tốt nhất trong challenge sẽ được vinh danh trong README như một cách ghi nhận đóng góp của họ cho cộng đồng.