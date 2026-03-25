---
title: "Sliding Window Rate Limiting (Log) từ cơ bản đến triển khai"
description: "Giải thích sliding window rate limiting từ góc nhìn thực tế: rate limiting là gì, cách hiểu '60 giây gần nhất', cách lưu timestamp theo từng user, và những vấn đề cần xử lý khi triển khai trong môi trường concurrent."
pubDate: 2026-03-23
category: "Concurrency"
---

## 1. Rate limiting là gì?

**Rate limiting** là kỹ thuật kiểm soát số lượng request mà một client có thể gửi đến hệ thống trong một khoảng thời gian nhất định.

👉 Ví dụ:

* `100 requests / phút / user`
* `10 requests / giây / IP`

### Mục tiêu

* Bảo vệ hệ thống khỏi overload
* Ngăn abuse (spam, brute-force, scraping)
* Đảm bảo fairness giữa các client

---

## 2. Rate limiter là gì?

Rate limiting là **policy**
Rate limiter là **cách implement policy đó**

Có nhiều cách implement:

* Fixed window
* Sliding window log  ← **bài này focus**
* Sliding window counter
* Token bucket

👉 Tất cả đều trả lời cùng một câu hỏi:

> “Request này có được phép đi qua hay không?”

---

## 3. Bài toán của chúng ta

Implement:

```text
100 requests / 60 seconds / user
```

Mỗi request đến, ta cần trả lời:

> **Trong 60 giây gần nhất, user này đã gửi bao nhiêu request?**

* Nếu số lượng < 100 → cho phép
* Nếu ≥ 100 → từ chối

---
## 4. Sliding Window Log

Sliding Window Log là một cách thực hiện rate limiting dựa trên ý tưởng:

> tại mọi thời điểm, chỉ xét các request nằm trong một khoảng thời gian gần nhất tính từ hiện tại

Khoảng thời gian này được gọi là window.

⚠️ Quan trọng: định nghĩa window

Trong phiên bản này, chúng ta dùng:
> (now - windowSize, now]

Ví dụ, với policy:

```text
100 requests / 60 seconds
````

thì tại mỗi thời điểm, hệ thống sẽ xét:

```text
60 giây gần nhất
```

Ví dụ:

```text
now = 10:00:30
→ window = (09:59:30, 10:00:30]
```

Nếu thời gian tăng lên:

```text
now = 10:00:31
→ window = (09:59:31, 10:00:31]
```

Có thể thấy window không cố định, mà dịch chuyển liên tục theo thời gian thực.

Điểm quan trọng:

* window luôn được xác định dựa trên thời điểm hiện tại
* không có khái niệm reset theo mốc thời gian cố định
* hệ thống luôn nhìn lại đúng khoảng thời gian vừa trôi qua

Từ đó, bài toán của rate limiter trở thành:

> tại thời điểm hiện tại, có bao nhiêu request nằm trong window?

Sliding Window Log là cách tiếp cận giải bài toán này bằng cách:

> lưu lại lịch sử request để có thể xác định chính xác những request nào còn nằm trong window

---

## 5. Cách implement trong bài này

Để biết trong 60 giây gần nhất có bao nhiêu request, cần lưu lại lịch sử request của từng user.

Một cách trực tiếp nhất là lưu timestamp của mỗi request.

Ta có thể biểu diễn như sau:

```text
userId → danh sách timestamp các request gần nhất
```

Ví dụ:

```text
u1 → [t1, t2, t3]
```

Danh sách này luôn được sắp theo thứ tự thời gian:

* phần tử đầu là request cũ nhất
* phần tử cuối là request mới nhất

Ý nghĩa của danh sách này:

> nó chứa toàn bộ các request của user còn nằm trong window hiện tại

Khi thời gian trôi đi, các request cũ sẽ dần nằm ngoài window và không còn được tính nữa.
Những request này cần được loại bỏ khỏi danh sách.

Ngược lại, mỗi request mới sẽ được thêm vào cuối danh sách.

Vì vậy, tại mọi thời điểm, danh sách này luôn phản ánh:

> các request xảy ra trong khoảng thời gian gần nhất

---

## 6. Tại sao dùng `ConcurrentHashMap<String, Deque<Long>>`?

Map này dùng để lưu:

```java
userId → Deque chứa timestamp request của user đó
```

👉 Mỗi user có một “state” riêng để tính rate limit độc lập

---

### Vấn đề

Trong thực tế:

* Nhiều request đến **cùng lúc (multi-thread)**
* Có thể:

  * nhiều thread cùng đọc/ghi vào map
  * nhiều thread cùng tạo state cho cùng 1 user

---

### Nếu dùng `HashMap`

```java
Map<String, Deque<Long>> requests = new HashMap<>();
```

👉 Không thread-safe:

* Có thể race condition khi:

  * tạo `Deque` cho user
  * update dữ liệu
* Dữ liệu có thể sai / bị overwrite / crash

---

### Vì sao dùng `ConcurrentHashMap`

```java
ConcurrentHashMap<String, Deque<Long>> requests;
```

Nó giải quyết 3 vấn đề chính:

---

**1. Thread-safe khi nhiều request chạy song song**

* Nhiều thread có thể đọc/ghi cùng lúc
* Không làm hỏng dữ liệu

---

**2. Đảm bảo tạo/lấy state đúng trong concurrent**

* Khi kết hợp với `computeIfAbsent`
* → chỉ 1 thread tạo `Deque` cho mỗi `userId`
* → các thread khác dùng chung

---

**3. Không lock toàn bộ map**

* Không chặn tất cả thread như `synchronized`
* Chỉ lock theo vùng dữ liệu (bucket / key)

👉 Nghĩa là:

* User A và User B có thể xử lý song song
* Scale tốt khi traffic tăng

---

## 7. Vì sao value là `Deque<Long>`?

Ta cần:

* Xóa request cũ nhất
* Thêm request mới nhất

👉 Pattern:

```text
[oldest ...... newest]
```

---

### Các thao tác cần:

* `peekFirst()` → xem cái cũ nhất
* `removeFirst()` → xóa cái cũ
* `addLast()` → thêm cái mới

👉 Tất cả đều O(1)

---

## 8. Vì sao dùng `computeIfAbsent()`?

Trong rate limiter, mỗi `userId` cần một `Deque` để lưu timestamp request.

Vấn đề là:
> Làm sao để **lấy ra Deque nếu đã có, hoặc tạo mới nếu chưa có** mà vẫn **thread-safe và không lãng phí tài nguyên**?

---

### Cách dễ nghĩ tới (nhưng sai trong concurrent)

```java
Deque<Long> deque = requests.get(userId);

if (deque == null) {
    deque = new ArrayDeque<>();
    requests.put(userId, deque);
}
```

* Không atomic → có thể race condition
* Nhiều thread có thể cùng tạo nhiều `Deque` khác nhau

---

### Cải tiến hơn với `putIfAbsent`

```java
requests.putIfAbsent(userId, new ArrayDeque<>());
Deque<Long> deque = requests.get(userId);
```

* Tránh overwrite value
* Nhưng `new ArrayDeque()` vẫn luôn được tạo ra trước
  → có thể tạo dư object khi nhiều thread cùng chạy

---

### Cách đúng: `computeIfAbsent`

```java
Deque<Long> deque =
    requests.computeIfAbsent(userId, k -> new ArrayDeque<>());
```

* Chỉ tạo `Deque` khi key chưa tồn tại
* Gộp check + create + get trong 1 operation
* Đảm bảo chỉ có 1 instance được tạo ra

---

## 9. Phần quan trọng nhất: `synchronized (deque)`

Đây là chỗ nhiều người hiểu sai.

### Sai lầm phổ biến:

> “Dùng ConcurrentHashMap là đủ thread-safe”

❌ Sai

---

### Vì logic của bạn không phải 1 operation:

```text
remove → check → add
```

---

### Race condition sẽ xảy ra:

```text
Thread A thấy size = 99
Thread B thấy size = 99

→ cả 2 đều add
→ thành 101
```

---

### Giải pháp:

```java
synchronized (deque)
```

👉 Lock theo từng user

---

### Ưu điểm:

* User A không block user B
* Chỉ block cùng 1 key
* Scale tốt hơn global lock

---

👉 Đây gọi là:

```text
fine-grained locking
```

---

## 10. Flow xử lý mỗi request

### Bước 1 — Xác định window

```text
cutoff = now - windowSize
```

### Bước 2 — Xóa request cũ

```text
Xóa tất cả timestamp <= cutoff
```

→ đảm bảo chỉ giữ lại request nằm trong:

```text
(now - windowSize, now]
```
---

### Bước 3 — Check limit

```text
if size >= LIMIT → reject
```

---

### Bước 4 — Nếu OK → thêm request mới

```text
add(now)
```

---

👉 Tóm lại:

```text
remove old → check → add new
```

---

## 11. Complexity

### Time

Mỗi request cần:

- loại bỏ các timestamp cũ khỏi đầu danh sách  
- kiểm tra size và thêm phần tử mới  

Trong thực tế:

- Average: gần O(1) (thường chỉ xóa rất ít phần tử)  
- Worst case: O(LIMIT)  

Vì số phần tử tối đa trong deque bị chặn bởi LIMIT:

```text
size ≤ LIMIT
```
→ upper bound là O(LIMIT)

### Space

Mỗi user giữ tối đa LIMIT timestamp:

> O(number of users × LIMIT)

---

## 12. Khi nào dùng Sliding Window Log?

Phù hợp khi:

* Cần độ chính xác cao
* Limit nhỏ (100–1000)
* Window ngắn

---

Không phù hợp khi:

* Limit lớn (10k+)
* Window dài (hours)
* Memory nhạy cảm

---


