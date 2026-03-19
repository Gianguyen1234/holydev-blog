---
title: "Concurrency là gì? Hiểu đúng để tránh bug production"
description: "Giải thích concurrency, race condition, thread-safe, atomic và cách tránh các bug phổ biến trong backend khi xử lý nhiều request đồng thời."
pubDate: 2026-03-19
category: "Concurrency"
---

## 1. Vấn đề thực tế

Giả sử bạn có API:

```java
POST /buy
```

Với logic:

```java
if (stock > 0) {
    stock--;
}
```

Khi có nhiều request đồng thời:

*   nhiều request cùng đọc `stock = 1`
    
*   tất cả đều pass điều kiện
    

Kết quả: **oversell**

Đây là một lỗi phổ biến trong backend và là ví dụ điển hình của vấn đề **concurrency**.

* * *

## 2. Concurrency và Parallelism

**Concurrency (đồng thời)** là khả năng hệ thống xử lý nhiều task trong cùng một khoảng thời gian.

**Parallelism (song song)** là việc nhiều task thực sự chạy cùng lúc trên nhiều CPU core.

| Khái niệm         | Ý nghĩa                          |
|-------------------|----------------------------------|
| Concurrency       |   nhiều task được xử lý xen kẽ     |
| Parallelism       |   nhiều task chạy cùng lúc thật sự |

Ví dụ:

*   Một CPU xử lý nhiều request bằng cách chuyển qua lại → concurrency
    
*   Nhiều core xử lý nhiều request cùng lúc → parallelism
    

Trong backend, hai khái niệm này thường **cùng tồn tại**.

* * *

## 3. Race Condition

Race condition xảy ra khi nhiều thread cùng truy cập và thay đổi dữ liệu dùng chung, dẫn đến kết quả không xác định.

Ví dụ:

```java
int count = 0;

Thread A: count++;
Thread B: count++;
```

Kết quả có thể là:

*   1 (sai)
    
*   2 (đúng)
    

Nguyên nhân là vì `count++` không phải một thao tác đơn lẻ mà gồm nhiều bước (đọc → tính toán → ghi).

* * *

## 4. Atomic

**Atomic** nghĩa là một thao tác không thể bị chia nhỏ và không bị gián đoạn.

```java
AtomicInteger count = new AtomicInteger(0);
count.incrementAndGet();
```

Thao tác trên là atomic:

*   thực hiện như một bước duy nhất
    
*   không bị thread khác chen vào
    

Tuy nhiên, atomic chỉ đảm bảo tính đúng đắn ở mức **operation**, không đảm bảo logic nghiệp vụ.

* * *

## 5. Thread-safe

Một đoạn code được gọi là **thread-safe** khi:

> nhiều thread chạy đồng thời nhưng kết quả vẫn luôn đúng

### Ví dụ không thread-safe

```java
class Counter {
    int count = 0;

    void increment() {
        count++;
    }
}
```

Vấn đề:

*   `count++` gồm nhiều bước (đọc → tăng → ghi)
    
*   nhiều thread có thể chen vào giữa
    

→ dẫn đến race condition

### Ví dụ thread-safe (cách 1: dùng Atomic)

```java
class Counter {
    AtomicInteger count = new AtomicInteger(0);

    void increment() {
        count.incrementAndGet();
    }
}
```

Ở đây:

*   `incrementAndGet()` là **atomic operation**
    
*   nên không bị race condition
    

→ method trở thành thread-safe

### Ví dụ thread-safe (cách 2: dùng lock)

```java
class Counter {
    int count = 0;

    synchronized void increment() {
        count++;
    }
}
```

Ở đây:

*   `count++` vẫn **không atomic**
    
*   nhưng được bảo vệ bởi lock
    

→ không thread nào chen vào

→ vẫn thread-safe

### Cách đạt thread-safe

Có nhiều cách để đảm bảo thread-safe, nhưng phổ biến nhất là:

1.  **Atomic (lock-free)**  
    Sử dụng các operation atomic như `AtomicInteger`, phù hợp với logic đơn giản.
    
2.  **Lock (synchronized, Lock)**  
    Khóa một đoạn code để đảm bảo chỉ một thread truy cập tại một thời điểm.
    

Ngoài ra còn có các cách khác như:

*   sử dụng object bất biến (immutability)
    
*   cô lập dữ liệu theo từng thread (ThreadLocal)
    

### Tránh hiểu nhầm

*   Thread-safe **không đồng nghĩa** với atomic
    
*   Atomic chỉ là **một kỹ thuật** để đạt thread-safe
    

Note:

> “Atomic giải quyết một dòng code. Lock bảo vệ một đoạn code. Nhưng bug thực sự thường nằm ở nhiều đoạn code ghép lại với nhau.”

## 6. Concurrency-safe ở mức hệ thống

Một nhầm lẫn rất phổ biến là:

> **Thread-safe = hệ thống an toàn**

Thực tế không phải vậy.

### Ví dụ

Giả sử bạn có một method:

```java
public void decreaseStock() {
    stock.decrementAndGet(); // dùng AtomicInteger
}
```

Hoặc:

```java
public void decreaseStock() {
    synchronized (this) {
        stock--;
    }
}
```

Ở đây, method này là **thread-safe**:

*   không có race condition ở mức biến `stock`
    
*   mỗi lần gọi sẽ giảm đúng 1 đơn vị
    

### Nhưng vấn đề nằm ở logic nghiệp vụ

Giả sử API của bạn là:

```java
if (stock > 0) {
    decreaseStock();
}
```

Và hệ thống đang có:

*   `stock = 1`
    
*   2 hoặc 1000 request cùng lúc gọi API
    

### Điều gì xảy ra?

1.  Nhiều request cùng đọc `stock > 0` → đều thấy đúng
    
2.  Tất cả đều đi vào `decreaseStock()`
    
3.  `decreaseStock()` chạy thread-safe → mỗi request vẫn giảm 1 lần
    

👉 Kết quả:

```plaintext
stock = -999
```

👉 Oversell xảy ra

### Tại sao lại sai?

Vì:

*   **thread-safe chỉ bảo vệ từng operation riêng lẻ**
    
*   nhưng logic của bạn gồm nhiều bước:
    

```text
check (stock > 0)
→ then decrease
```

👉 Đây là **2 bước tách rời**, không atomic

* * *

### Kết luận

Trường hợp này là:

> code thread-safe nhưng **không concurrency-safe**

### Hiểu đơn giản

*   **Thread-safe** → từng dòng code chạy đúng khi nhiều thread cùng truy cập
    
*   **Concurrency-safe** → toàn bộ logic nghiệp vụ vẫn đúng khi có nhiều request cùng lúc
    

### Insight quan trọng

Phần lớn bug production không nằm ở chỗ:

*   bạn dùng sai `Atomic`
    
*   hay thiếu `synchronized`
    

Mà nằm ở chỗ:

> bạn không bảo vệ được **toàn bộ flow nghiệp vụ** dưới concurrency

## 7. Ba cấp độ của Concurrency

### 1. Memory level

Liên quan đến:

*   atomic
    
*   visibility
    
*   instruction reordering
    

Công cụ:

*   `volatile`
    
*   `Atomic`
    
*   `synchronized`
    

* * *

### 2. Thread level

Liên quan đến:

*   race condition
    
*   deadlock
    

Công cụ:

*   lock
    
*   thread pool
    

* * *

### 3. System level

Liên quan đến:

*   oversell
    
*   duplicate request
    
*   lost update
    

Công cụ:

*   transaction database
    
*   distributed lock
    
*   message queue
    

## 8. Các cách xử lý Concurrency

### Lock trong code

```java
synchronized void buy() {
    // critical section
}
```

Chỉ hiệu quả trong phạm vi một instance.

* * *

### Database (atomic update)

```sql
UPDATE product
SET stock = stock - 1
WHERE id = 1 AND stock > 0;
```

Đảm bảo:

*   không oversell
    
*   tính atomic ở mức database
    

* * *

### Distributed Lock

Sử dụng Redis hoặc hệ thống tương tự để:

*   khóa theo resource (ví dụ: productId)
    
*   đảm bảo chỉ một request xử lý tại một thời điểm
    

* * *

### Queue

Xử lý request theo thứ tự:

```plaintext
Request → Queue → Consumer
```

Phù hợp với hệ thống có tải cao và yêu cầu tính nhất quán cao.

## 9. Sai lầm phổ biến

*   Cho rằng `synchronized` là đủ
    
*   Nhầm lẫn thread-safe với đúng logic nghiệp vụ
    
*   Hiểu atomic là rollback hoặc transaction
    

## 10. Kết luận

Concurrency không chỉ là xử lý nhiều request cùng lúc, mà là đảm bảo hệ thống vẫn **đúng** trong điều kiện đó.

Một hệ thống backend tốt không chỉ chạy nhanh mà còn phải:

*   tránh race condition
    
*   đảm bảo tính nhất quán dữ liệu
    
*   xử lý đúng dưới tải cao
    

* * *

**Một nguyên tắc quan trọng:**

> Lỗi concurrency hiếm khi xuất hiện trong môi trường test, nhưng gần như chắc chắn sẽ xảy ra trong production.