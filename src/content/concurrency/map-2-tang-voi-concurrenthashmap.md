---
title: "Map 2 tầng với ConcurrentHashMap: pattern nhỏ nhưng rất thực dụng trong backend"
description: "Phân tích cách tổ chức dữ liệu dạng two-level map bằng ConcurrentHashMap, kèm code mẫu cập nhật counter an toàn dưới concurrent load."
pubDate: 2026-03-04
category: "Concurrency"
---

Trong backend, có một pattern rất hay gặp: key chính và key con.

Ví dụ:

- `tenantId -> (eventType -> count)`
- `userId -> (endpoint -> rate-limit state)`
- `service -> (statusCode -> metrics)`

Nếu xử lý song song, dùng `HashMap` lồng nhau sẽ rất dễ dính race condition. Cách đúng trong Java thường là **map 2 tầng với `ConcurrentHashMap`**.

## 1) Mô hình dữ liệu

Ta biểu diễn:

```text
outerKey -> innerMap
innerKey -> value
```

Với Java:

```java
ConcurrentHashMap<K1, ConcurrentHashMap<K2, V>>
```

Quan trọng là khởi tạo `innerMap` theo cách thread-safe.

## 2) Code mẫu cơ bản

Ví dụ đếm số event theo `userId` và `type`.

```java
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.LongAdder;

public class TwoLevelCounter {
  private final ConcurrentHashMap<String, ConcurrentHashMap<String, LongAdder>> data =
      new ConcurrentHashMap<>();

  public void increment(String userId, String type) {
    data.computeIfAbsent(userId, ignored -> new ConcurrentHashMap<>())
        .computeIfAbsent(type, ignored -> new LongAdder())
        .increment();
  }

  public long get(String userId, String type) {
    ConcurrentHashMap<String, LongAdder> inner = data.get(userId);
    if (inner == null) return 0L;
    LongAdder adder = inner.get(type);
    return adder == null ? 0L : adder.sum();
  }
}
```

Điểm chính:

- `computeIfAbsent` giúp tạo map con/counter đúng một lần theo key.
- `LongAdder` thường tốt hơn `AtomicLong` khi contention cao.

## 3) Vì sao không `synchronized` cả map?

Bạn có thể lock toàn cục, nhưng throughput sẽ giảm mạnh khi nhiều request.

`ConcurrentHashMap` cho phép nhiều thread thao tác trên các key khác nhau song song. Với map 2 tầng, lợi ích này rõ ràng hơn vì contention thường tập trung theo một vài key nóng.

## 4) Lưu ý với `computeIfAbsent`

Hàm mapping có thể được gọi nhiều lần trong điều kiện cạnh tranh, nhưng chỉ một kết quả được gắn vào map. Vì vậy:

- mapping function nên thuần (không side-effect quan trọng),
- không gọi I/O nặng trong mapping function.

## 5) Dọn dữ liệu và tránh phình memory

Map 2 tầng dễ phình khi outer key tăng liên tục (user mới, tenant mới).

Một số chiến lược:

- Xóa outer key nếu inner map rỗng.
- Giới hạn cardinality theo business rule.
- Dùng TTL/eviction ở tầng cao hơn (nếu dùng cache layer).

Ví dụ xóa an toàn:

```java
public void removeType(String userId, String type) {
  data.computeIfPresent(userId, (u, inner) -> {
    inner.remove(type);
    return inner.isEmpty() ? null : inner; // null => remove outer key
  });
}
```

## 6) Pattern này dùng tốt ở đâu?

- In-memory metrics aggregator
- Rate limiter theo nhiều chiều key
- Thống kê thời gian thực trước khi flush ra storage

Không phù hợp khi:

- Dữ liệu cần persistence mạnh
- Cardinality quá lớn và không có eviction
- Cần truy vấn phức tạp (grouping/filter) mà in-memory map không đáp ứng tốt

## 7) Kết luận

Map 2 tầng với `ConcurrentHashMap` là pattern nhỏ nhưng cực kỳ thực dụng:

- Code ngắn, dễ reason
- An toàn dưới concurrent load
- Hiệu năng tốt nếu key phân tán hợp lý

Nếu cần đếm/cập nhật trạng thái theo hai chiều key trong memory, đây thường là điểm khởi đầu đúng trước khi đẩy sang kiến trúc phức tạp hơn.
