---
title: "PSYNC trong Redis: cơ chế thật sự phía sau partial resync"
description: "Mổ xẻ PSYNC: replication-id, offset, backlog window và các tình huống khiến Redis quay lại full resync."
pubDate: 2026-02-26
category: "Redis"
---

## PSYNC không chỉ là một command

Trong Redis, PSYNC thường được nhắc như “lệnh đồng bộ incremental”. Nhưng thực chất nó là một **giao thức đàm phán** giữa replica và master về lịch sử replication. Giao thức này dựa trên hai biến: **replication-id** và **replication offset**. Nếu một trong hai không khớp, Redis quay về full resync ngay lập tức.

Điều này làm PSYNC trở thành điểm giao quan trọng giữa độ ổn định, tốc độ phục hồi, và chi phí tài nguyên.

## Replication-id: lịch sử, không phải instance

Redis gán một `replication-id` cho master. Mỗi khi master restart hoặc thay đổi vai trò (failover), `replication-id` thay đổi. Nó đại diện cho **lịch sử của replication stream**, không phải danh tính vật lý.

Trong một số trường hợp, một master có thể giữ **hai replication-id**:

- `master_replid`: lịch sử hiện tại.
- `master_replid2`: lịch sử trước đó, dùng để hỗ trợ replica trong quá trình failover.

Điều này cho phép replica đang theo lịch sử cũ vẫn có thể partial resync nếu offset còn trong backlog.

## Replication offset: byte, không phải thời gian

Replication offset tăng theo byte trong stream. Mỗi lệnh append vào stream sẽ làm offset tăng. Replica báo offset cuối cùng đã xử lý.

Ở đây có một điểm dễ nhầm:

- Offset không đo thời gian.
- Offset không đo số lệnh.
- Offset chỉ đo byte.

Vì vậy, một lệnh `SET big_value` có thể làm offset nhảy rất lớn, khiến backlog tiêu hao nhanh hơn dự kiến.

## Backlog window: cánh cửa duy nhất cho partial resync

Backlog là ring buffer giữ một đoạn gần nhất của replication stream. Nó có một cửa sổ offset:

```
backlog_start < offset < backlog_end
```

Replica chỉ được partial resync nếu offset nằm trong cửa sổ đó và replication-id khớp. Chỉ một trong hai điều kiện fail, full resync diễn ra.

Sơ đồ:

```
Replication stream (growing)
         |-------------------> offset
         |    backlog window
         |   [start .... end]
Replica offset must land here
```

Một hệ quả: **backlog size hiệu dụng phụ thuộc vào throughput**. Ví dụ:

- Backlog = 64MB
- Throughput = 32MB/s

Replica chỉ có khoảng 2 giây để reconnect trước khi offset bị “đẩy ra ngoài cửa sổ”.

## Handshake PSYNC: dòng chảy thực tế

Khi replica reconnect:

```
Replica -> Master: PSYNC <replication-id> <offset>

Master:
  - Nếu replication-id khớp AND offset trong backlog:
      +CONTINUE
      gửi dữ liệu từ offset+1 tới backlog_end
  - Ngược lại:
      +FULLRESYNC <new-id> <offset>
      gửi RDB
```

Đáng chú ý: nếu master không giữ backlog (hoặc backlog size = 0), PSYNC luôn rơi về full resync. Điều này thường bị bỏ qua trong môi trường test nhỏ.

## Tại sao PSYNC quan trọng với hệ thống lớn

Trong hệ thống lớn, full resync không chỉ là “tốn thời gian”. Nó còn tạo ra:

- Fork RDB: tăng RAM do COW.
- Network spike: truyền toàn bộ dataset.
- Replica pause: không thể phục vụ đọc.

Một full resync trong giờ cao điểm có thể kéo theo cascade: replica mất, failover kích hoạt, master mới phải phục vụ load tăng đột ngột.

PSYNC là cơ chế giảm tần suất full resync. Nhưng nó chỉ hiệu quả khi backlog đủ lớn và network ổn định.

## Điều kiện làm PSYNC thất bại

### 1) Backlog quá nhỏ

Như đã phân tích, backlog window phụ thuộc throughput. Với workload ghi cao, backlog 1GB vẫn có thể bị “đốt” trong vài giây.

### 2) Replication-id thay đổi

Master restart, hoặc failover trong Sentinel/Cluster khiến replication-id đổi. Replica có offset đúng nhưng lịch sử sai -> full resync.

### 3) Replica lag quá lâu

Nếu replica bị GC pause, CPU throttle hoặc network partition dài, offset rơi khỏi backlog.

### 4) Master bị đổi vai trò

Khi replica trở thành master rồi lại bị hạ xuống, lịch sử replication không còn liên tục. Redis cố giữ `master_replid2` để cứu partial resync, nhưng không phải lúc nào cũng đủ.

## Quan hệ giữa PSYNC và replication buffer

Replication buffer dành cho từng replica, không phải backlog. Backlog phục vụ PSYNC; buffer phục vụ truyền dữ liệu ngay khi replica đang online.

Khi replica chậm, buffer phình to và có thể bị disconnect. Nếu bị disconnect, replica quay lại PSYNC. Nếu backlog không đủ, full resync xảy ra. Đây là vòng lặp thường gặp:

```
Replica slow -> buffer grows -> disconnect
 -> PSYNC -> backlog insufficient -> FULLRESYNC
 -> heavy load -> replica slow again
```

Chiến lược ở đây là:

- Theo dõi `repl_backlog_size` và `repl_backlog_histlen`.
- Giảm độ nặng của lệnh write.
- Thêm replica để chia tải đọc thay vì dùng một replica duy nhất.

## PSYNC trong môi trường failover

Với Sentinel hoặc Cluster, failover tạo master mới. Replica cũ trở thành replica của master mới. `replication-id` thay đổi, nhưng Redis giữ lịch sử cũ trong `master_replid2` để replica có thể partial resync.

Điểm quan trọng: `master_replid2` chỉ giữ **một lịch sử trước đó**. Nếu chuỗi failover dài hoặc nhiều bước, khả năng partial resync giảm mạnh.

Trong thiết kế hệ thống, điều này ảnh hưởng đến:

- Thời gian phục hồi sau failover.
- Sức chịu của network khi nhiều replica full resync cùng lúc.
- Chiến lược đưa replica vào lại hệ thống sau sự cố.

## Đo lường PSYNC hiệu quả

Chỉ nhìn `connected_slaves` là chưa đủ. Các chỉ số quan trọng:

- `master_repl_offset` vs `slave_repl_offset`.
- `repl_backlog_histlen` (độ dài lịch sử thực tế).
- `repl_backlog_active` (backlog có bật không).
- `master_replid` và `master_replid2`.

Khi `repl_backlog_histlen` gần với `repl_backlog_size`, backlog “đầy” và đang ổn. Nếu nó thường xuyên thấp hơn nhiều, nghĩa là backlog bị reset hoặc master restart.

## Một ví dụ trực quan

```
Backlog size: 64MB
Write rate:   16MB/s
Time window:  ~4s

Replica disconnect 2s -> offset vẫn trong window -> PSYNC OK
Replica disconnect 6s -> offset ra ngoài -> FULLRESYNC
```

Sự khác biệt 2s và 6s có thể đến từ GC pause, packet loss, hoặc tắc nghẽn trên đường truyền. Vì vậy, backlog thường nên được cấu hình dựa trên **p99 network + p99 pause** của hệ thống thực tế, không phải dựa trên lý thuyết.

## Kết luận: PSYNC là cơ chế “phục hồi nhanh”

PSYNC giúp Redis phục hồi nhanh sau disconnect ngắn, nhưng không phải là phép màu. Nó phụ thuộc chặt vào:

- Backlog đủ lớn so với write throughput.
- Replication-id ổn định trong khoảng thời gian cần thiết.
- Replica không bị disconnect quá lâu.

Trong môi trường production, việc quan sát PSYNC thành công hay thất bại là một tín hiệu mạnh về sức khỏe của hệ thống. Nếu full resync xảy ra thường xuyên, đó không chỉ là vấn đề network mà còn là vấn đề thiết kế: backlog quá nhỏ, write spike quá lớn, hoặc failover quá nhiều.
