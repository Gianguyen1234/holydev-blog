---
title: "Redis replication internals: nhìn từ lớp byte và dòng thời gian"
description: "Phân tích sâu cơ chế replication của Redis: offset, backlog, full resync, PSYNC và các điểm nghẽn ở mức hệ thống."
pubDate: 2026-02-20
category: "Redis"
---

## Bối cảnh: replication không chỉ là “copy dữ liệu”

Replication trong Redis thường được mô tả ngắn gọn là master đẩy dữ liệu sang replica. Mô tả đó đúng nhưng thiếu các chi tiết quyết định độ ổn định của hệ thống: cách Redis đánh dấu tiến độ, cơ chế đồng bộ khi kết nối bị đứt, và mức độ “nhạy cảm” với latency, backlog, hay việc fork cho RDB. Trong thực tế, replication là một giao thức tối ưu cho throughput cao với giả định: RAM là nguồn chân lý và tiến độ được đo theo byte log.

Trong bài này, tôi tập trung vào các khía cạnh:

- Dòng chảy dữ liệu từ master sang replica.
- Vai trò của replication offset và replication backlog.
- Tại sao full resync đắt và khi nào PSYNC giúp tránh nó.
- Các điểm giao giữa replication và RDB/AOF.
- Các failure mode thường gặp.

## Mô hình dữ liệu và log nội bộ

Redis vận hành như một state machine đơn luồng. Mọi command ghi được append vào một replication stream. Stream này vừa dùng để:

- Ghi vào AOF (nếu bật).
- Truyền sang replica.
- Lưu một phần vào replication backlog để phục vụ PSYNC.

Đây là điểm quan trọng: replication không đi theo mô hình “snapshot + diff” như một số hệ thống khác, mà bám theo **dòng lệnh**. Do đó, tiến độ replication là **offset trong replication stream** (tính theo byte).

```
Client Commands ---> Master Execution
                     |
                     +--> AOF (append)
                     |
                     +--> Replication Stream (bytes)
                                |
                                +--> Replicas
                                |
                                +--> Backlog (ring buffer)
```

Nhờ cơ chế này, master có thể trả lời “tôi đã gửi tới byte offset N”. Replica báo “tôi đã nhận tới byte offset M”. Sự chênh lệch N - M là độ trễ logic ở mức protocol, độc lập với network latency.

## Full resync: RDB là điểm khởi đầu

Khi replica lần đầu kết nối (hoặc mất đồng bộ), nó yêu cầu full resync. Quy trình:

1. Replica gửi `PSYNC ? -1` (hoặc `SYNC` trong phiên bản cũ).
2. Master fork để tạo RDB snapshot.
3. Master gửi RDB cho replica.
4. Trong lúc fork + gửi RDB, master tiếp tục nhận lệnh mới và ghi vào replication buffer.
5. Sau khi replica load xong RDB, master gửi phần buffer còn thiếu.

Đây là giai đoạn đắt nhất. Fork tạo RDB gây áp lực lên copy-on-write (COW), làm tăng memory và write amplification. Với dataset lớn, fork có thể khiến latency của master tăng rõ rệt.

Lưu ý rằng trong lúc gửi RDB, replication stream vẫn tiếp tục. Redis dùng một “replication buffer” cho mỗi replica để đảm bảo các lệnh trong thời gian tạo RDB không bị mất.

## Replication offset và backlog

Replication offset là byte offset toàn cục, tăng liên tục khi master append lệnh vào replication stream. Replica lưu offset cuối cùng đã xử lý. Hai loại offset:

- **Master replication offset**: trạng thái toàn cục của master.
- **Replica replication offset**: byte cuối cùng replica đã nhận và apply.

Backlog là một ring buffer giữ một đoạn gần nhất của replication stream. Mục đích: cho phép replica “bù lại” phần bị mất mà không cần full resync.

```
Replication Stream (growing)
        |
        +--> Backlog (fixed size ring)
                 ^---- offset window ----^

Replica offset must fall within this window to use PSYNC.
```

Nếu replica bị disconnect trong thời gian ngắn và offset của nó vẫn nằm trong window backlog, master sẽ trả lời PSYNC partial resync. Nếu offset nằm ngoài window, full resync là bắt buộc.

Backlog size trở thành một biến cấu hình chiến lược. Nhỏ quá -> dễ full resync. Lớn quá -> tốn RAM. Nhưng tác động thực sự phụ thuộc vào tốc độ ghi: backlog giữ được bao nhiêu thời gian = size / write throughput.

## PSYNC: thỏa thuận từ “history”

PSYNC là cải tiến lớn so với SYNC. Khi replica kết nối lại, nó gửi:

```
PSYNC <replication-id> <offset>
```

`replication-id` là một UUID (hoặc 40-byte runid) đại diện cho lịch sử replication của master. Khi master restart, replication-id thay đổi. Replica có thể lưu nhiều `replication-id` để hỗ trợ failover.

Nếu `replication-id` khớp và offset nằm trong backlog, master trả `+CONTINUE` và gửi delta. Nếu không, master trả `+FULLRESYNC <new-id> <offset>` và bắt đầu full resync.

Điểm tinh tế: replication-id không chỉ thay đổi khi restart, mà còn thay đổi trong các tình huống failover (Redis Sentinel/Cluster), nhằm đảm bảo replica không bù với history sai.

## Replication buffer và flow control

Mỗi replica có một replication buffer để chứa dữ liệu chưa gửi hoặc chưa ack. Nếu replica chậm, buffer phình to, gây áp lực RAM. Redis không có backpressure phức tạp; thay vào đó:

- Nếu buffer vượt ngưỡng, replica bị disconnect.
- Master không chặn nhận lệnh mới.

Điều này làm replication ưu tiên tính sẵn sàng của master hơn tính ổn định của replica. Một replica chậm không được phép kéo master xuống.

## Trễ và lag: network vs logical

Có ba lớp trễ cần phân biệt:

1. **Network latency**: RTT giữa master và replica.
2. **Apply latency**: thời gian replica xử lý lệnh.
3. **Replication lag**: chênh lệch offset.

Trong nhiều hệ thống, lag thường được đo bằng thời gian. Nhưng trong Redis, offset byte mới là chỉ báo trực tiếp. Một replica có lag 50MB nhưng write throughput thấp thì lag thời gian có thể rất lớn. Ngược lại, lag byte nhỏ nhưng RTT cao vẫn khiến read-after-write từ replica không an toàn.

## Replication và persistence: RDB/AOF

Replication stream là nguồn cho AOF. Khi AOF rewrite, Redis fork và tạo snapshot tương tự như khi tạo RDB. Như vậy, replication + AOF có thể tạo ra **hai điểm fork** trong cùng một khoảng thời gian, làm tăng áp lực COW.

Trong các deployment lớn, việc bật AOF + RDB + replication có thể khiến tổng RAM tăng đáng kể, đặc biệt nếu dữ liệu có nhiều key nhỏ nhưng cập nhật liên tục.

Một nguyên tắc thực tế: nếu yêu cầu durability cao, bật AOF và điều chỉnh `auto-aof-rewrite-percentage` để tránh rewrite quá thường xuyên, đồng thời tăng backlog để giảm full resync.

## Failure modes thường gặp

### 1) Full resync do backlog nhỏ

Khi replica disconnect lâu hơn khả năng giữ backlog, full resync xảy ra. Với dataset lớn, RDB fork + transfer tốn thời gian, kéo theo bão IO và network.

### 2) Out-of-memory do replica chậm

Replica chậm làm buffer phình to. Khi vượt ngưỡng, replica bị disconnect, dẫn đến full resync lặp lại. Vòng lặp này tạo ra “replication thrash”.

### 3) Copy-on-write bùng nổ

Fork RDB/AOF trong khi workload ghi cao khiến nhiều page bị dirty, COW bùng nổ. Master có thể đạt ngưỡng OOM dù dataset vẫn vừa trong RAM.

### 4) Replica CPU-bound

Replica apply lệnh đơn luồng. Nếu master có throughput quá cao hoặc lệnh nặng, replica không theo kịp. Cần xem xét tách workload hoặc tăng số replica và phân chia traffic đọc.

## Một sơ đồ dòng thời gian

```
Time ------------------------------------------------------------>
Master writes:  [W][W][W][W][W][W][W][W][W][W]
Offset:          1  2  3  4  5  6  7  8  9  10

Replica disconnects after offset 5
Backlog keeps offsets 3..10

Replica reconnects with PSYNC (offset 5)
=> Partial resync: send offsets 6..10
```

Nếu backlog chỉ giữ 7..10, replica offset 5 nằm ngoài window => full resync.

## Kết luận: replication là cơ chế stream, không phải snapshot

Điểm mạnh của Redis replication nằm ở sự đơn giản và throughput cao. Nhưng điều đó đi kèm các giả định: single-threaded execution, log-based replication, và dùng backlog như cơ chế “time machine” nhỏ. Khi thiết kế hệ thống, cần hiểu rằng:

- Replication là stream byte, không phải thời gian.
- Backlog size quyết định khả năng phục hồi nhanh.
- Fork cho RDB/AOF có thể là điểm nghẽn lớn nhất.
- Replica chậm sẽ bị loại bỏ, không làm master chậm lại.

Replication trong Redis không phải “ma thuật”. Nó là một pipeline được tối ưu cho tốc độ, và vì vậy hệ thống vận hành ổn định khi các tham số (backlog, fork, throughput) được cân chỉnh theo workload thực tế.
