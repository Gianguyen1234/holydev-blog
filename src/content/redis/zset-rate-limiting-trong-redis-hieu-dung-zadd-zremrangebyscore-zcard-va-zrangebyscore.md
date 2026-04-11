---
title: "ZSET Rate Limiting Trong Redis: Hiểu Đúng ZADD, ZREMRANGEBYSCORE, ZCARD Và ZRANGEBYSCORE"
description: "Hiểu cách sliding window rate limiting hoạt động với Redis ZSET thông qua bốn lệnh cốt lõi: ZADD, ZREMRANGEBYSCORE, ZCARD và ZRANGEBYSCORE."
pubDate: 2026-04-11
category: "Redis"
---

## 1. Bức tranh tổng thể

Khi dùng `ZSET` cho rate limit, bạn đang làm đúng 3 việc:

* lưu request bằng `ZADD`
* xoá request cũ bằng `ZREMRANGEBYSCORE`
* đếm request hiện tại bằng `ZCARD`

Ngoài ra còn một lệnh rất hữu ích để quan sát dữ liệu:

* xem lại request theo thời gian bằng `ZRANGEBYSCORE`

Phần quan trọng nhất để giữ cho dữ liệu đúng là bước **xoá request cũ**.

---

## 2. `ZREMRANGEBYSCORE` là gì?

`ZREMRANGEBYSCORE` là lệnh:

* xoá các phần tử trong `ZSET` theo khoảng `score`

Cú pháp:

```text
ZREMRANGEBYSCORE key min max
```

Nghĩa là:

* xoá tất cả phần tử có `score` nằm trong đoạn `[min, max]`

### Áp dụng vào rate limit

Trong Lua script:

```lua
redis.call("ZREMRANGEBYSCORE", key, 0, now - window)
```

Hiểu đơn giản:

* xoá tất cả request cũ hơn khoảng thời gian `window`

### Ví dụ

#### Hiểu đúng bản chất: `ZSET` đang lưu cái gì?

Giả sử `ZSET` đang có:

```text
("req1", 1000)
("req2", 2000)
("req3", 3000)
```

Đừng nghĩ nó là list.

Hãy nghĩ nó là:

* một danh sách request được gắn timestamp
* `req1` xảy ra lúc `1000`
* `req2` xảy ra lúc `2000`
* `req3` xảy ra lúc `3000`

#### `ZREMRANGEBYSCORE key 0 2000` nghĩa là gì?

Lệnh này dịch ra tiếng người là:

* xoá tất cả request có thời gian nằm trong khoảng từ `0` đến `2000`

#### Áp dụng vào dữ liệu

Ta xét từng phần tử:

```text
("req1", 1000)
```

* `1000` có nằm trong khoảng `[0, 2000]` không?
* có
* bị xoá

```text
("req2", 2000)
```

* `2000` có nằm trong khoảng `[0, 2000]` không?
* có, vì `2000` là biên trên và vẫn được tính
* bị xoá

```text
("req3", 3000)
```

* `3000` có nằm trong khoảng `[0, 2000]` không?
* không
* được giữ lại

#### Kết quả cuối cùng

Sau khi chạy:

```text
ZREMRANGEBYSCORE key 0 2000
```

`ZSET` còn lại:

```text
("req3", 3000)
```

#### Hình dung theo timeline

```text
0 ----- 1000 ----- 2000 ----- 3000
        req1      req2       req3
```

Bạn đang nói với Redis:

* xoá tất cả từ `0` đến `2000`

Tức là Redis sẽ cắt đoạn này:

```text
[0 ----------- 2000]
```

* `req1` và `req2` nằm trong vùng này nên bị xoá
* `req3` nằm ngoài nên được giữ lại

### Ý nghĩa trong rate limit

Đây chính là cách bạn tạo **sliding window**:

* giữ lại request trong khoảng thời gian gần nhất
* bỏ toàn bộ request cũ

---

## 3. `ZRANGEBYSCORE` là gì?

`ZRANGEBYSCORE` là lệnh:

* lấy các phần tử trong `ZSET` theo khoảng `score`

Cú pháp:

```text
ZRANGEBYSCORE key min max
```

### Ví dụ

```text
ZRANGEBYSCORE key 1000 3000
```

Redis sẽ trả về tất cả `member` có `score` nằm trong khoảng đó.

### Áp dụng vào rate limit

Lệnh này không phải phần bắt buộc của thuật toán, nhưng rất hữu ích để:

* debug
* xem hiện tại đang có những request nào
* kiểm tra pattern request
* phân tích hành vi của user

Ví dụ:

```text
ZRANGEBYSCORE key 1710000000000 1710000060000
```

Nghĩa là:

* lấy toàn bộ request trong 60 giây gần nhất

---

## 4. So sánh nhanh

| Lệnh | Làm gì |
| --- | --- |
| `ZREMRANGEBYSCORE` | xoá theo thời gian |
| `ZRANGEBYSCORE` | lấy ra theo thời gian |

---

## 5. Flow đầy đủ của rate limit

Ghép lại toàn bộ logic:

```lua
-- 1. xoá request cũ
ZREMRANGEBYSCORE key 0 (now - window)

-- 2. thêm request mới
ZADD key now member

-- 3. đếm
ZCARD key
```

Nếu muốn xem dữ liệu để debug:

```lua
ZRANGEBYSCORE key (now - window) now
```

---

## 6. Vai trò của từng lệnh

### `ZADD`

* thêm request mới vào `ZSET`
* `score` thường là timestamp
* `member` thường là request id hoặc một giá trị đủ để không bị đè nhau

### `ZREMRANGEBYSCORE`

* dọn request cũ ra khỏi cửa sổ thời gian hiện tại
* nếu không có bước này thì dữ liệu sẽ phình ra và số đếm sẽ sai

### `ZCARD`

* đếm số phần tử còn lại sau khi đã dọn cửa sổ
* đây chính là số request hiện tại trong window

### `ZRANGEBYSCORE`

* không dùng để enforce limit
* dùng để quan sát, debug, và kiểm tra dữ liệu trong cửa sổ thời gian

---

## 7. Insight quan trọng

Nếu bạn **không xoá request cũ**:

* `ZSET` sẽ lớn dần
* số đếm sẽ sai
* memory sẽ tăng

Nếu bạn **xoá sai range**:

* có thể xoá nhầm request mới
* rate limit sẽ sai

Nói ngắn gọn:

* `ZADD` thêm dữ liệu
* `ZREMRANGEBYSCORE` quyết định cửa sổ nào là hợp lệ
* `ZCARD` chỉ đếm trên phần dữ liệu còn lại đó

---

## 8. Một cách hiểu rất dễ nhớ

* `ZADD` -> thêm request
* `ZREMRANGEBYSCORE` -> dọn rác
* `ZCARD` -> đếm
* `ZRANGEBYSCORE` -> xem lại dữ liệu

---

## 9. Một câu chốt

Rate limit bằng `ZSET` thực chất là:

* giữ lại request trong một khoảng thời gian
* xoá phần còn lại
* rồi đếm
