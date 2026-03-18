---
title: "Epoch second: vì sao mốc thời gian lại bắt đầu từ năm 1970?"
description: "Giải thích nguồn gốc Unix epoch, lý do chọn 1970, cách dùng trong Java, và Year 2038 problem."
pubDate: 2026-03-04
category: "Concurrency"
---
## 1) Nguồn gốc của mốc 1970

Khoảng **1969-1970**, đội ngũ tại Bell Labs xây dựng Unix. Khi thiết kế hệ thống thời gian, họ cần một mốc chuẩn để:

- lưu trữ metadata thời gian trong file system
- so sánh thời điểm trước/sau
- cộng trừ thời gian một cách nhất quán

Mốc được chọn là:

```text
1970-01-01 00:00:00 UTC
```

Và từ đó:

```text
Unix time = số giây kể từ mốc 1970-01-01 00:00:00 UTC
```

## 2) Vì sao lại chọn 1970?

Không có lý do "thiêng liêng". Chủ yếu là quyết định kỹ thuật thực dụng tại thời điểm đó.

### a) Unix được viết đúng giai đoạn 1969-1970

Chọn đầu năm 1970 là hợp logic theo timeline phát triển hệ điều hành.

### b) Dễ tính toán hơn định dạng lịch thông thường

Thay vì xử lý trực tiếp một chuỗi thời gian phức tạp như:

```text
2026-03-04 14:22:18
```

hệ thống chỉ cần một số nguyên:

```text
1741098138
```

Nhờ vậy rất dễ:

- so sánh (`>`, `<`)
- cộng/trừ khoảng thời gian
- lưu vào database và index

### c) Tách biệt timezone khỏi lưu trữ

Unix time luôn tính theo:

```text
UTC
```

Timezone chỉ dùng ở lớp hiển thị (UI, log formatter, report). Cách tách này giúp giảm lỗi khi hệ thống chạy đa vùng.

## 3) Ví dụ trực quan

```text
1970-01-01 00:00:00 UTC -> 0
1970-01-01 00:00:01 UTC -> 1
1970-01-01 00:01:00 UTC -> 60
```

Tới năm 2026, epoch second nằm quanh:

```text
~ 1,740,000,000
```

## 4) Epoch second trong Java

Java có hai cách phổ biến:

```java
long millis = System.currentTimeMillis(); // milliseconds since Unix epoch
long seconds = millis / 1000;             // epoch second
```

Với Java time API hiện đại:

```java
import java.time.Instant;

long epochSecond = Instant.now().getEpochSecond();
```

Nếu chỉ cần độ chính xác theo giây để bucket, rate limit hoặc key thời gian, `epochSecond` thường đủ và gọn.

## 5) Fun fact quan trọng: Year 2038 problem

Nhiều hệ thống cũ dùng Unix time bằng **signed 32-bit integer**. Giá trị tối đa là:

```text
2,147,483,647
```

Tương ứng thời điểm:

```text
2038-01-19 03:14:07 UTC
```

Sau đó sẽ overflow nếu vẫn giữ 32-bit.

Đa số hệ thống hiện đại đã chuyển sang 64-bit, nhưng các hệ thống embedded/legacy vẫn cần kiểm tra kỹ.

## 6) Tóm tắt ngắn

- Epoch = mốc thời gian chuẩn
- Unix chọn mốc `1970-01-01 00:00:00 UTC`
- Epoch second = số giây kể từ mốc đó
- Lợi ích chính: đơn giản cho tính toán, lưu trữ, so sánh, và xử lý phân tán

