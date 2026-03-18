---
title: "Java Deque trong thực tế: cấu trúc dữ liệu nhỏ nhưng ảnh hưởng lớn đến latency"
description: "Phân tích Java Deque từ góc nhìn backend: semantics FIFO/LIFO, lựa chọn ArrayDeque vs LinkedList, và các pattern code thực chiến."
pubDate: 2026-03-03
category: "Concurrency"
---

## Vì sao Deque đáng quan tâm trong backend

`Deque` (double-ended queue) là interface nhỏ trong Java Collections, nhưng xuất hiện trong rất nhiều thành phần quan trọng:

- Buffer in-memory cho job scheduling.
- Sliding window cho rate limiting.
- BFS/DFS trong graph traversal.
- Monotonic queue cho stream analytics.

Nhiều hệ thống backend có latency xấu không phải vì thuật toán lớn, mà vì cấu trúc dữ liệu dùng sai trong vòng lặp nóng. `Deque` là một ví dụ điển hình.

## Deque semantics: một API, hai mô hình hàng đợi

`Deque` hỗ trợ thao tác ở cả đầu và cuối:

- FIFO queue: `offerLast`, `pollFirst`
- LIFO stack: `push`, `pop` (tương đương thêm/xóa ở đầu)

Điểm quan trọng là tính rõ nghĩa của method:

- Nhóm `add/remove/get` có thể ném exception.
- Nhóm `offer/poll/peek` trả về trạng thái hoặc `null`.

Trong backend service, nhóm `offer/poll/peek` thường an toàn hơn khi xử lý luồng dữ liệu có thể rỗng.

## Lựa chọn implementation: ArrayDeque vs LinkedList

Trong đa số trường hợp production, `ArrayDeque` là lựa chọn tốt hơn:

- locality tốt hơn (mảng liên tục).
- ít allocation object.
- throughput cao hơn cho thao tác đầu/cuối.

`LinkedList` chỉ nên dùng khi có lý do rõ ràng, vì:

- mỗi node là object riêng (tốn RAM, cache-unfriendly).
- GC pressure cao hơn dưới tải lớn.

Một nguyên tắc thực dụng: nếu không có constraint đặc biệt, mặc định chọn `ArrayDeque`.

## Code mẫu 1: queue FIFO cho xử lý tác vụ

```java
import java.util.ArrayDeque;
import java.util.Deque;

public class TaskQueue {
  private final Deque<String> queue = new ArrayDeque<>();

  public void submit(String taskId) {
    queue.offerLast(taskId);
  }

  public String next() {
    return queue.pollFirst(); // null if empty
  }

  public int size() {
    return queue.size();
  }
}
```

Mẫu này phù hợp cho single-threaded loop hoặc khi đã có cơ chế đồng bộ bên ngoài.

## Code mẫu 2: dùng Deque như stack cho DFS

```java
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;

public class DfsTraversal {
  public void dfs(int start, List<List<Integer>> graph, boolean[] visited) {
    Deque<Integer> stack = new ArrayDeque<>();
    stack.push(start);

    while (!stack.isEmpty()) {
      int node = stack.pop();
      if (visited[node]) continue;

      visited[node] = true;
      for (int neighbor : graph.get(node)) {
        if (!visited[neighbor]) {
          stack.push(neighbor);
        }
      }
    }
  }
}
```

Ở đây `Deque` thay thế `Stack` cũ. `Stack` kế thừa từ `Vector`, thường không còn là lựa chọn tối ưu.

## Code mẫu 3: monotonic deque cho sliding window maximum

Pattern này xuất hiện nhiều trong analytics realtime và monitoring pipeline.

```java
import java.util.ArrayDeque;
import java.util.Deque;

public class SlidingWindowMax {
  public int[] maxInWindow(int[] nums, int k) {
    if (k <= 0 || nums.length == 0) return new int[0];

    Deque<Integer> dq = new ArrayDeque<>(); // store indices
    int[] result = new int[nums.length - k + 1];
    int ri = 0;

    for (int i = 0; i < nums.length; i++) {
      while (!dq.isEmpty() && dq.peekFirst() <= i - k) {
        dq.pollFirst();
      }

      while (!dq.isEmpty() && nums[dq.peekLast()] <= nums[i]) {
        dq.pollLast();
      }

      dq.offerLast(i);

      if (i >= k - 1) {
        result[ri++] = nums[dq.peekFirst()];
      }
    }

    return result;
  }
}
```

Đây là ví dụ `Deque` giúp từ O(n*k) xuống O(n), đồng thời giữ memory tuyến tính.

## Concurrency note: Deque không tự thread-safe

`ArrayDeque` và `LinkedList` đều không thread-safe. Nếu nhiều thread cùng truy cập, có vài hướng:

- Dùng đồng bộ ngoài (`synchronized`/`Lock`).
- Hoặc dùng implementation concurrent phù hợp như `ConcurrentLinkedDeque`.
- Hoặc chuyển sang `BlockingQueue` nếu bạn cần coordination producer-consumer.

Code mẫu tối thiểu với lock:

```java
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.locks.ReentrantLock;

public class LockedDeque {
  private final Deque<String> dq = new ArrayDeque<>();
  private final ReentrantLock lock = new ReentrantLock();

  public void add(String value) {
    lock.lock();
    try {
      dq.offerLast(value);
    } finally {
      lock.unlock();
    }
  }

  public String poll() {
    lock.lock();
    try {
      return dq.pollFirst();
    } finally {
      lock.unlock();
    }
  }
}
```

Nếu workload contention cao, lock thủ công có thể trở thành bottleneck. Khi đó nên xem lại mô hình queue tổng thể.

## Một số sai lầm thường gặp

1. Dùng `LinkedList` theo thói quen thay vì đo đạc.
2. Trộn semantics queue/stack trong cùng class khiến logic khó đọc.
3. Dùng `null` làm giá trị hợp lệ với API `poll/peek`, dẫn đến ambiguity.
4. Bỏ qua giới hạn kích thước queue, gây memory growth không kiểm soát.

## Kết luận

`Deque` là cấu trúc dữ liệu đơn giản, nhưng ảnh hưởng trực tiếp đến latency và GC behavior trong backend Java.

Nếu bạn cần một lựa chọn mặc định an toàn:

- Chọn `ArrayDeque`.
- Dùng rõ semantics FIFO hoặc LIFO.
- Đặt giới hạn và quan sát queue depth.
- Chỉ thêm concurrency control khi có yêu cầu rõ.

Với các hệ thống chạy lâu và chịu tải liên tục, những quyết định “nhỏ” ở lớp dữ liệu như `Deque` thường tạo ra khác biệt lớn nhất.
