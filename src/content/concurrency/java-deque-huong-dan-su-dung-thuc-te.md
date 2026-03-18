---
title: "Java Deque: cách dùng thực tế trong backend"
description: "Tổng hợp cách dùng Deque trong Java với ví dụ thực tế: FIFO, LIFO, sliding window và lưu ý concurrency."
pubDate: 2026-03-04
category: "Concurrency"
---

Bài này tóm tắt cách dùng `Deque` trong Java theo góc nhìn backend: dùng gì, khi nào dùng, và tránh lỗi gì khi có concurrent requests.

## 1) Deque là gì?

`Deque` là viết tắt của double-ended queue, cho phép thêm/xóa ở cả hai đầu.

Nó hỗ trợ hai kiểu dùng chính:

- Queue (FIFO): vào trước ra trước
- Stack (LIFO): vào sau ra trước

Interface:

```java
Deque<E>
```

Implementations thường dùng:

- `ArrayDeque` (khuyên dùng mặc định)
- `LinkedList` (ít khi là lựa chọn tối ưu cho hot path)

## 2) Dùng Deque như Queue (FIFO)

```java
import java.util.ArrayDeque;
import java.util.Deque;

public class FifoExample {
  public static void main(String[] args) {
    Deque<String> q = new ArrayDeque<>();

    q.offerLast("task-1");
    q.offerLast("task-2");
    q.offerLast("task-3");

    System.out.println(q.pollFirst()); // task-1
    System.out.println(q.pollFirst()); // task-2
    System.out.println(q.pollFirst()); // task-3
  }
}
```

Pattern này phù hợp cho các hàng đợi in-memory đơn giản.

## 3) Dùng Deque như Stack (LIFO)

```java
import java.util.ArrayDeque;
import java.util.Deque;

public class LifoExample {
  public static void main(String[] args) {
    Deque<String> stack = new ArrayDeque<>();

    stack.push("A");
    stack.push("B");
    stack.push("C");

    System.out.println(stack.pop()); // C
    System.out.println(stack.pop()); // B
    System.out.println(stack.pop()); // A
  }
}
```

Nếu bạn đang dùng `Stack`, có thể chuyển sang `Deque` cho sạch và hiện đại hơn.

## 4) API cần nhớ nhanh

- Thêm đầu: `offerFirst`, `addFirst`
- Thêm cuối: `offerLast`, `addLast`
- Lấy/xóa đầu: `pollFirst`, `removeFirst`
- Lấy/xóa cuối: `pollLast`, `removeLast`
- Peek đầu/cuối: `peekFirst`, `peekLast`

Quy ước quan trọng:

- `poll/peek` trả `null` khi rỗng
- `remove/get` ném exception khi rỗng

Trong backend, `poll/peek` thường an toàn hơn để tránh exception không cần thiết.

## 5) Ví dụ thực tế: sliding window bằng Deque

Một bài toán phổ biến là max trong cửa sổ trượt kích thước `k`.

```java
import java.util.ArrayDeque;
import java.util.Deque;

public class SlidingWindowMax {
  public int[] maxWindow(int[] nums, int k) {
    if (nums == null || nums.length == 0 || k <= 0) return new int[0];

    Deque<Integer> dq = new ArrayDeque<>(); // lưu index
    int[] out = new int[nums.length - k + 1];
    int oi = 0;

    for (int i = 0; i < nums.length; i++) {
      while (!dq.isEmpty() && dq.peekFirst() <= i - k) {
        dq.pollFirst();
      }

      while (!dq.isEmpty() && nums[dq.peekLast()] <= nums[i]) {
        dq.pollLast();
      }

      dq.offerLast(i);

      if (i >= k - 1) {
        out[oi++] = nums[dq.peekFirst()];
      }
    }

    return out;
  }
}
```

Pattern này xuất hiện nhiều trong analytics và stream processing.

## 6) Concurrency: điểm cần tránh

`ArrayDeque` và `LinkedList` **không thread-safe**.

Nếu nhiều thread cùng đọc/ghi:

- dùng `ConcurrentLinkedDeque` cho non-blocking access, hoặc
- đồng bộ bên ngoài bằng lock, hoặc
- chuyển qua queue chuyên dụng (`BlockingQueue`) nếu cần producer-consumer rõ ràng

Đừng chia sẻ `ArrayDeque` trực tiếp giữa nhiều thread nếu không có cơ chế bảo vệ.

## 7) Kết luận

`Deque` là một cấu trúc dữ liệu nhỏ nhưng rất hữu ích trong backend Java.

Nếu cần một lựa chọn mặc định:

- bắt đầu với `ArrayDeque`
- dùng `poll/offer/peek` để code ổn định hơn
- tách rõ bài toán FIFO hay LIFO
- kiểm tra concurrency trước khi đưa vào môi trường đa luồng

Phần quan trọng khi vào production là bạn chọn đúng implementation và đúng policy concurrency.
