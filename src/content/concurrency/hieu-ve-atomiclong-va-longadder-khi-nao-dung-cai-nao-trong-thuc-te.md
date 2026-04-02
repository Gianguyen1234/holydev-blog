---
title: "Hiểu về AtomicLong và LongAdder: Khi nào dùng cái nào trong thực tế?"
description: "Giải thích sự khác nhau giữa AtomicLong và LongAdder trong Java concurrency, với trọng tâm là contention, performance và lựa chọn đúng theo bài toán."
pubDate: 2026-04-02
category: "Concurrency"
image: "/images/concurrency/atomiclong-longadder.png"
---
![AtomicLong vs LongAdder || When to use what](/images/concurrency/atomiclong-longadder.png)

Trong lập trình backend, đặc biệt là khi làm việc với hệ thống concurrent (đa luồng), bạn sẽ sớm gặp hai class rất quen thuộc trong Java:

* `AtomicLong`
* `LongAdder`

Cả hai đều dùng để **đếm số (counter) trong môi trường nhiều thread**, nhưng cách chúng hoạt động và use case lại hoàn toàn khác nhau.

Nếu dùng sai, hệ thống của bạn có thể:

* chạy chậm khi traffic cao
* hoặc tệ hơn: sai dữ liệu

Bài viết này sẽ giúp bạn hiểu rõ bản chất và biết khi nào nên dùng cái nào.

---

## 1. AtomicLong là gì?

`AtomicLong` là một biến kiểu `long` nhưng hỗ trợ các phép toán **atomic (nguyên tử)** như:

```java
AtomicLong counter = new AtomicLong(0);

counter.incrementAndGet();
```

### Ý nghĩa của “atomic”

Atomic nghĩa là:

> Một operation xảy ra trọn vẹn, không bị thread khác chen vào giữa operation đó.

Ví dụ:

* 100 thread cùng gọi `incrementAndGet()`
* kết quả vẫn luôn chính xác:

```text
1, 2, 3, 4, ..., 100
```

* không bị trùng
* không bị mất update

---

### Cách hoạt động

`AtomicLong` sử dụng cơ chế:

> **CAS (Compare-And-Swap)**

Pseudo:

```text
while (true):
    old = value
    new = old + 1
    if CAS(value, old, new):
        return new
```

Nếu có thread khác update trước, CAS sẽ fail và thread hiện tại phải retry.

Nhờ vậy, `AtomicLong` có thể thực hiện các operation như:

* `incrementAndGet()`
* `decrementAndGet()`
* `compareAndSet()`

mà không cần dùng `synchronized` theo kiểu khóa truyền thống.

---

### Vấn đề: Contention

Khi nhiều thread cùng update:

```java
counter.incrementAndGet();
```

tất cả đều “đập” vào **cùng 1 biến**

→ gây ra:

* retry liên tục
* CPU waste
* performance giảm

---

### Kết luận về AtomicLong

* chính xác tuyệt đối cho các atomic operation của nó
* thread-safe
* không scale tốt khi quá nhiều thread cùng update một điểm nóng

---

## 2. LongAdder là gì?

![LongAdder in Java](/images/concurrency/long-adder.png)

`LongAdder` được thiết kế để giải quyết vấn đề **contention của AtomicLong**.

```java
LongAdder counter = new LongAdder();

counter.increment();
```

---

### Ý tưởng cốt lõi

Thay vì:

```text
count = 0
```

`LongAdder` làm:

```text
base = 0
cells[] = nhiều ô nhớ
```

---

### Khi increment

Thay vì tất cả thread update 1 biến, `LongAdder` sẽ phân tán update ra nhiều cell bên trong.

Ví dụ:

```text
Thread A -> cell[1]
Thread B -> cell[3]
Thread C -> cell[1] (có thể trùng)
```

Mục tiêu là giảm va chạm (`contention`) khi nhiều thread cùng tăng counter.

---

### Khi đọc giá trị

```java
counter.sum();
```

sẽ thực hiện:

```text
total = base + sum(cells[])
```

---

### Điểm quan trọng

* số lượng cell **không cố định**
* không phải mỗi thread có đúng 1 cell riêng
* nó tự mở rộng theo mức độ cạnh tranh khi update

---

### Trade-off

`LongAdder` cho throughput rất tốt khi có nhiều thread cùng update.

Đổi lại:

```java
counter.sum();
```

không phù hợp cho các bài toán cần một giá trị kiểu sequence hoặc một decision point tuyệt đối chính xác tại từng thời điểm đọc.

Với các bài toán như:

* metrics
* analytics
* logging

thì điều này thường hoàn toàn chấp nhận được.

---

## 3. So sánh trực tiếp

|             | AtomicLong       | LongAdder          |
| ----------- | ---------------- | ------------------ |
| Cách lưu    | 1 biến           | nhiều cell         |
| Contention  | cao              | thấp               |
| Accuracy    | tuyệt đối cho atomic operation | phù hợp cho counter hiệu năng cao |
| Performance | kém khi load cao | rất tốt            |
| Use case    | ID, sequence, state cần chặt | metrics, analytics |

---

## 4. Ví dụ thực tế

### AtomicLong – tạo ID

```java
private final AtomicLong jobIdSequence = new AtomicLong(1000);

public long startJob() {
    return jobIdSequence.incrementAndGet();
}
```

Yêu cầu ở đây là:

* không trùng ID
* mỗi lần gọi nhận đúng một giá trị mới

→ dùng `AtomicLong` là hợp lý

---

### LongAdder – đếm event

```java
ConcurrentHashMap<Long, LongAdder> buckets = new ConcurrentHashMap<>();

buckets
    .computeIfAbsent(second, s -> new LongAdder())
    .increment();
```

Use case:

* đếm request
* analytics
* logging

→ cần performance hơn là một atomic value cho từng lần đọc

---

## 5. Khi nào dùng cái nào?

### Dùng AtomicLong khi:

* ID generator
* sequence number
* số dư tiền trong logic in-memory tạm thời
* logic cần giá trị chính xác cho từng operation

---

### Dùng LongAdder khi:

* metrics (`request`, `click`, `view`...)
* analytics
* logging system
* các hot counter bị nhiều thread update liên tục

---

## 6. Sai lầm phổ biến

### Dùng AtomicLong cho analytics

→ hệ thống dễ chậm khi traffic cao vì contention tăng mạnh

---

### Dùng LongAdder cho ID

→ sai mô hình bài toán

`LongAdder` không sinh ra một sequence atomic để cấp ID như `incrementAndGet()` của `AtomicLong`.

---

## 7. Insight quan trọng

Bạn có thể hình dung:

`AtomicLong`:

> “Mọi thread phải xếp hàng ghi vào cùng 1 chỗ”

`LongAdder`:

> “Nhiều thread ghi ra nhiều chỗ khác nhau, cuối cùng cộng lại”

---

## 8. Kết luận

* `AtomicLong` → đúng và rõ ràng cho atomic value, nhưng không scale tốt khi contention cao
* `LongAdder` → scale tốt hơn cho counter nóng, nhưng không dùng cho sequence semantics

Không có cái nào “tốt hơn” trong mọi trường hợp.

Chỉ có cái **phù hợp với bài toán hơn**.

---

## 9. Một câu đáng nhớ

> “AtomicLong phù hợp khi bạn cần correctness của một atomic value. LongAdder phù hợp khi bạn cần throughput của một counter.”

---

Nếu bạn đang xây dựng hệ thống backend:

* dùng sai → hệ thống chậm hoặc semantics không đúng
* dùng đúng → hệ thống scale mượt hơn và dễ giữ đúng logic hơn

Và đó chính là khác biệt giữa code chạy được và code production-ready.
