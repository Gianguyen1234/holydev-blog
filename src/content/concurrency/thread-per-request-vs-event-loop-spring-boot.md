---
title: "Thread-per-request vs event loop trong Spring Boot: lựa chọn kiến trúc hay ngụy biện hiệu năng?"
description: "Phân tích sâu mô hình blocking thread-per-request và reactive event loop trong Spring Boot từ góc nhìn latency, throughput và vận hành."
pubDate: 2026-02-25
category: "Concurrency"
---

## Bối cảnh: Spring Boot đứng giữa hai thế giới

Spring Boot truyền thống dựa trên mô hình thread-per-request (Servlet). Với sự xuất hiện của WebFlux, nhiều đội ngũ mặc định coi event loop là “hiện đại và nhanh hơn”. Thực tế phức tạp hơn: performance không chỉ là số request/giây, mà là **phân phối latency**, **chi phí vận hành**, và **tính dự đoán được**.

Trong bài này, tôi không hướng dẫn cách dùng WebFlux hay Reactor. Tôi tập trung vào câu hỏi: **khi nào thread-per-request là đủ tốt**, và **khi nào event loop tạo lợi ích thực sự**.

## Thread-per-request: mô hình đơn giản, chi phí rõ ràng

Ở Servlet stack, mỗi request được xử lý bởi một thread. Block I/O đồng nghĩa với thread bị chặn cho đến khi có dữ liệu. Điều này tạo ra một mapping trực tiếp:

```
request -> thread -> blocking I/O -> response
```

Ưu điểm:

- Lập trình dễ hiểu.
- Stack trace rõ ràng.
- Context propagation tự nhiên.
- Debug và profiling đơn giản.

Nhược điểm:

- Mỗi kết nối cần thread.
- Khi I/O chậm, thread bị “đốt”.
- Thread stack tốn bộ nhớ.

Trong hệ thống có lượng kết nối lớn và thời gian chờ I/O dài, mô hình này có thể bị giới hạn bởi số thread khả dụng hoặc overhead context switch.

## Event loop: multiplex I/O, đẩy complexity lên cao

Event loop (reactive) dùng một số ít thread để xử lý nhiều kết nối bằng non-blocking I/O. Logic xử lý trở thành chuỗi callback hoặc reactive pipeline.

```
request -> event loop -> async I/O -> callback -> response
```

Ưu điểm:

- Sử dụng ít thread.
- Khi I/O chậm, thread không bị block.
- Tốt cho workload có nhiều kết nối chờ.

Nhược điểm:

- Debug phức tạp.
- Stack trace không tự nhiên.
- Mọi call phải “reactive-ready”.
- CPU-bound task có thể làm nghẽn event loop.

Event loop không miễn phí. Nó chuyển chi phí từ tài nguyên sang **complexity** và **discipline** trong codebase.

## Bottleneck thật sự nằm ở đâu?

Trong nhiều hệ thống backend, bottleneck không nằm ở I/O wait mà nằm ở:

- DB query nặng.
- Serialization/deserialization.
- Business logic CPU-bound.

Nếu phần lớn thời gian nằm ở CPU hoặc DB, event loop không giúp nhiều. Bạn chỉ “giảm số thread”, nhưng throughput vẫn bị giới hạn bởi CPU và DB.

Ngược lại, nếu workload là I/O-bound thuần túy, ví dụ gateway gọi nhiều dịch vụ với latency cao, event loop có thể tạo lợi ích rõ rệt.

## Latency distribution: p99 mới là vua

Thread-per-request thường có latency ổn định hơn khi load vừa phải. Khi load tăng cao, thread pool bắt đầu queue, p99 tăng nhanh. Đây là ngưỡng sụp đổ (meltdown).

Event loop thường có tail latency tốt hơn dưới load cao, miễn là:

- I/O non-blocking thật sự.
- Không có blocking call chui vào event loop.

Một blocking call trong event loop có thể làm toàn bộ pipeline bị nghẽn, gây ra latency spike lớn hơn thread-per-request.

## Chi phí vận hành và kỹ luật code

Reactive stack đòi hỏi discipline:

- Mọi API phải non-blocking.
- Không được gọi JDBC trực tiếp trong event loop.
- Phải dùng driver reactive (R2DBC, reactive Redis).

Trong thực tế, đây là rủi ro lớn: chỉ một thư viện blocking là đủ để phá vỡ lợi ích event loop. Vì vậy, tổ chức kỹ thuật cần kiểm soát chặt dependency.

Với thread-per-request, bạn có thể dùng bất kỳ thư viện nào. Điều này giảm rủi ro và tăng tốc độ phát triển.

## Sơ đồ so sánh đơn giản

```
Thread-per-request
  N requests -> N threads
  blocking IO -> thread idle
  cost: memory + context switch

Event loop
  N requests -> M threads (M << N)
  non-blocking IO -> callback
  cost: complexity + discipline
```

## Spring Boot trong thực tế

Trong nhiều hệ thống Spring Boot:

- DB là Postgres/MySQL (blocking JDBC).
- Redis sử dụng driver blocking.
- Kafka client blocking hoặc semi-blocking.

Khi đó, event loop không tạo được lợi ích vì phần lớn call vẫn blocking. Bạn phải chuyển toàn bộ stack sang reactive để có lợi ích đáng kể, và điều đó không hề rẻ.

Nếu hệ thống là gateway hoặc API aggregator, nơi phần lớn là network calls, event loop có thể giảm số thread đáng kể và cải thiện tail latency.

## Mô hình lai: blocking core + async edges

Một chiến lược phổ biến là:

- Core business logic và DB vẫn blocking.
- Async hoặc reactive chỉ dùng ở edge (gateway, fan-out).

Điều này tránh được chi phí migrate toàn bộ codebase. Tuy nhiên, nó yêu cầu ranh giới rõ ràng giữa các module, nếu không pipeline sẽ bị “nửa mùa”.

## So sánh dưới góc nhìn throughput

Throughput của thread-per-request phụ thuộc vào số thread và thời gian I/O. Nếu I/O chiếm 80% thời gian, throughput = threads / (tổng thời gian). Khi threads tăng, context switch tăng.

Event loop có throughput tốt hơn khi:

- I/O chiếm phần lớn.
- Latency của I/O cao và biến động.

Nhưng nếu CPU chiếm phần lớn, throughput bị giới hạn bởi CPU, và event loop không tạo lợi ích.

## Ảnh hưởng đến observability

Thread-per-request tạo ra trace tuyến tính. Reactive pipeline tạo ra trace phi tuyến, cần instrumentation tốt hơn. Nếu hệ thống chưa có observability đủ mạnh, event loop sẽ làm debugging khó khăn hơn nhiều.

## Khi nào nên chọn thread-per-request

- Workload không quá I/O-bound.
- DB và cache dùng driver blocking.
- Đội ngũ ưu tiên tốc độ phát triển và debugging.
- Latency requirement không quá khắt khe.

## Khi nào nên chọn event loop

- Gateway / API aggregator.
- Nhiều kết nối chờ lâu.
- Đội ngũ đủ khả năng vận hành reactive stack.
- Hạ tầng observability đủ mạnh.

## Kết luận: không có silver bullet

Thread-per-request không “lỗi thời”. Nó đơn giản, ổn định và dễ vận hành. Event loop không “tự nhiên nhanh hơn”. Nó đòi hỏi kỷ luật và chỉ hiệu quả khi workload phù hợp.

Trong Spring Boot, chọn mô hình nào phải dựa vào:

- Hồ sơ latency thực tế (p95/p99).
- Tỷ lệ thời gian ở I/O vs CPU.
- Khả năng vận hành và kỹ thuật của đội ngũ.

Nếu không có dữ liệu đo lường, chọn event loop chỉ là một ngụy biện hiệu năng. Và đó là sai lầm đắt giá nhất trong thiết kế hệ thống.
