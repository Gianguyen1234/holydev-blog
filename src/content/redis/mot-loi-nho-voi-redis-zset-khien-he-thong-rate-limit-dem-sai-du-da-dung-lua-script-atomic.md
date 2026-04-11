---
title: "Một Lỗi Nhỏ Với Redis ZSET Khiến Hệ Thống Rate Limit Đếm Sai Dù Đã Dùng Lua Script Atomic"
description: "Một lỗi logic nhỏ khi dùng ZADD với timestamp làm member có thể khiến Redis ZSET đếm sai request trong sliding window rate limiting, dù Lua script vẫn chạy atomic."
pubDate: 2026-04-11
category: "Redis"
relatedCategories:
  - "Concurrency"
---

## 1. Vấn đề

Khi làm rate limit bằng Redis, đặc biệt là kiểu sliding window với `ZSET`, có một tình huống rất dễ gây hoang mang:

* hệ thống vẫn nhận request đều
* Lua script vẫn chạy atomic
* nhưng số lượng request lại không tăng như mong đợi

Bạn log ra và thấy:

```text
count = 1, 1, 1, 1...
```

Trong khi thực tế đang có nhiều request liên tiếp được gửi đến.

Phản xạ đầu tiên thường là nghi ngờ:

* concurrency
* race condition
* hoặc Redis có vấn đề

Nhưng nếu nhìn kỹ hơn, nguyên nhân lại nằm ở một chi tiết rất nhỏ trong cách mình dùng `ZSET`.

---

## 2. Lua script nhìn qua thì không sai

Giả sử bạn có Lua script như sau để đếm request trong một khoảng thời gian:

```lua
-- rate_limit.lua

local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])

-- remove old entries
redis.call("ZREMRANGEBYSCORE", key, 0, now - window)

-- add current request
redis.call("ZADD", key, now, now)

-- count
local count = redis.call("ZCARD", key)

-- set expire (optional safety)
redis.call("EXPIRE", key, window)

return count
```

Nếu chỉ đọc flow, đoạn này hoàn toàn hợp lý:

* xoá dữ liệu cũ
* thêm request mới
* đếm lại số phần tử trong `ZSET`

Và vì tất cả chạy trong Lua script, nên về mặt concurrency là an toàn.

Vấn đề không nằm ở flow xử lý.

Nó nằm ở đúng một chỗ:

```lua
redis.call("ZADD", key, now, now)
```

---

## 3. Hiểu đúng cách Redis ZSET lưu dữ liệu

`ZSET` trong Redis không phải list.

Nó là một tập hợp có sắp xếp. Mỗi phần tử có dạng:

```text
(member, score)
```

Trong đó:

* `score` dùng để sắp xếp
* `member` dùng để định danh phần tử

### Rule quan trọng nhất

`member` phải là duy nhất.

Nếu bạn thêm một phần tử có `member` đã tồn tại:

* Redis không tạo phần tử mới
* Redis chỉ cập nhật lại phần tử cũ

---

## 4. Điều gì thực sự đang xảy ra?

Khi bạn viết:

```lua
ZADD key now now
```

thì bạn đang làm điều này:

```text
member = now
score = now
```

Tức là bạn đang dùng timestamp làm ID của request.

Nghe thì hợp lý.

Nhưng vấn đề là timestamp bạn lấy từ Java:

```java
long now = System.currentTimeMillis();
```

chỉ chính xác đến millisecond.

Điều này dẫn đến một tình huống rất dễ xảy ra:

* nhiều request đến trong cùng một millisecond

Ví dụ:

| Request | Timestamp |
| --- | --- |
| R1 | 1710000000000 |
| R2 | 1710000000000 |

Hai request khác nhau, nhưng lại có cùng `now`.

---

## 5. Redis nhìn thấy gì?

Từ phía Redis, nó nhận được:

```lua
ZADD key 1710000000000 "1710000000000"
ZADD key 1710000000000 "1710000000000"
```

Với Redis, đây không phải hai request.

Đây là cùng một `member` được thêm lại.

Kết quả là:

* không có phần tử mới được tạo
* phần tử cũ bị ghi đè

Nên dù bạn gửi 5, 10 hay 20 request trong cùng một millisecond, `ZSET` vẫn chỉ có 1 phần tử.

Đó là lý do vì sao bạn thấy `count` không tăng.

---

## 6. Vì sao Lua script atomic vẫn không cứu được?

Lua script đảm bảo một điều rất quan trọng:

* tất cả lệnh bên trong được thực thi liền mạch
* không bị chen ngang bởi request khác

Nhưng nó không đảm bảo rằng dữ liệu bạn đưa vào là đúng.

Trong trường hợp này:

* không có race condition
* không có conflict giữa các thread
* mọi thứ chạy đúng thứ tự

Nhưng dữ liệu đầu vào bị đụng nhau, nên kết quả vẫn sai.

Đây là lỗi logic, không phải lỗi concurrency.

---

## 7. Cách sửa đúng

Giải pháp không nằm ở việc thay đổi flow, mà nằm ở cách bạn tạo `member`.

Nguyên tắc rất đơn giản:

* `score` dùng timestamp để sort -> giữ nguyên
* `member` phải unique -> không dùng mỗi timestamp

Sửa lại như sau:

```lua
local key = KEYS[1]
local now = tonumber(ARGV[1])      -- current timestamp (ms)
local window = tonumber(ARGV[2])   -- time window (ms)

-- remove requests outside the window
redis.call("ZREMRANGEBYSCORE", key, 0, now - window)

-- unique member to avoid collision
local member = now .. "-" .. math.random()

-- add current request
redis.call("ZADD", key, now, member)

-- count requests in window
local count = redis.call("ZCARD", key)

-- set ttl to auto cleanup
redis.call("EXPIRE", key, window)

return count
```

Lúc này, mỗi request sẽ có một `member` khác nhau, dù timestamp giống nhau.

Ví dụ:

```text
1710000000000-0.123
1710000000000-0.987
1710000000000-0.456
```

Redis sẽ giữ lại toàn bộ các phần tử này, và `ZCARD` sẽ trả về đúng số lượng.

---

## 8. Bản chất của vấn đề

Điều đáng chú ý ở đây là:

* Redis không sai
* Lua script không sai
* concurrency cũng không sai

Sai ở chỗ giả định rằng:

> timestamp là đủ để phân biệt request

Điều này chỉ đúng khi traffic thấp.

Khi request đến dày đặc, millisecond không còn đủ để làm ID.

---

## 9. Kết luận

Một dòng code tưởng như vô hại:

```lua
ZADD key now now
```

có thể khiến toàn bộ hệ thống rate limit đếm sai.

Không phải vì thiếu atomic, mà vì dữ liệu không đủ để phân biệt các request.

Có một điều rất đáng nhớ trong case này:

> Atomic giúp bạn tránh race condition, nhưng không đảm bảo bạn đang làm đúng logic.

Khi làm việc với các data structure như `ZSET`, hiểu rõ cách nó lưu dữ liệu quan trọng không kém gì việc viết đúng code.
