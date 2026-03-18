---
title: "CAP trong thực tế: lựa chọn khi hệ thống bị phân vùng"
description: "Diễn giải CAP từ góc nhìn vận hành: phân vùng, timeout, quorum và cách ra quyết định nhất quán dưới áp lực production."
pubDate: 2026-02-23
category: "Distributed Systems"
---

## CAP không phải “chọn 2 trong 3”

CAP là một phát biểu về hành vi bắt buộc **khi xảy ra partition**. Nó không nói bạn chỉ chọn hai thuộc tính cho mọi thời điểm. Nó nói rằng **khi mạng bị phân vùng**, bạn không thể vừa đảm bảo availability cho mọi request, vừa giữ được linearizability.

Điều này nghe trừu tượng, nhưng trong vận hành, partition không hiếm. Nó có thể là:

- Mất route giữa hai AZ.
- Packet loss kéo dài vài chục giây.
- Firewall hoặc misconfiguration khiến một vùng không nhìn thấy vùng khác.
- Latency tăng vượt timeout của client, khiến hệ thống tự coi như partition.

Vì vậy, CAP là câu hỏi về **chính sách trong điều kiện xấu nhất**, chứ không phải về trường hợp bình thường.

## Consistency trong CAP là linearizability

Consistency trong CAP là **single-copy consistency**: mọi thao tác đọc/ghi phải nhìn thấy một thứ tự duy nhất, giống như chỉ có một node.

Nó không phải eventual consistency, cũng không phải read-your-writes. Khi bạn nói “tôi chọn C”, bạn đang chọn linearizability, thứ buộc mọi write phải đi qua một đường xác nhận duy nhất.

## Availability trong CAP là “luôn trả lời”

Availability trong CAP nghĩa là:

- Mọi request đến một node không bị partition đều nhận được response.
- Response là thành công hay thất bại đều được, nhưng phải trả lời trong thời gian hữu hạn.

Nó không nói về latency thấp. Một hệ thống có thể “available” nhưng trả lời chậm. Trong thực tế, availability sẽ được diễn giải theo SLA, nhưng CAP dùng định nghĩa cứng hơn: **luôn có response**.

## Partition là ranh giới bắt buộc

Partition là trạng thái mà hai nhóm node không thể giao tiếp với nhau. Khi đó, bạn phải chọn:

```
Group A  ----X----  Group B
   |                   |
  Node 1              Node 2
```

Nếu cả hai nhóm vẫn chấp nhận ghi, bạn có availability nhưng mất consistency. Nếu bạn chặn ghi ở một nhóm, bạn giữ consistency nhưng giảm availability.

Không có lựa chọn thứ ba.

## Timeout là “cảm biến” partition trong thực tế

Trong production, partition hiếm khi rõ ràng. Thay vào đó:

- RTT tăng.
- Packet loss gây retry.
- GC pause trên một node làm nó “im lặng”.

Hệ thống sẽ dựa vào timeout để quyết định “node kia đã chết hay chỉ chậm”. Do đó, **timeout chính là failure detector** và là nơi quyết định CAP trong thực tế.

Timeout ngắn:

- Nhanh phát hiện lỗi.
- Dễ nhầm latency spike thành partition.
- Dễ chuyển sang chế độ AP.

Timeout dài:

- Chịu được latency.
- Nhưng tăng tail latency và ảnh hưởng SLA.

## Quorum là cách “bẻ cong” CAP

Nhiều hệ thống dùng quorum để cân bằng consistency và availability.

Ví dụ với 3 node:

- Write quorum = 2
- Read quorum = 2

Khi partition xảy ra, chỉ nhóm nào còn đủ 2 node mới chấp nhận ghi. Nhóm còn lại từ chối. Đây là cách giữ consistency bằng cách hy sinh availability của nhóm nhỏ.

Sơ đồ:

```
Node A --- Node B --- Node C
Partition: Node C tách khỏi A,B

Quorum = 2
=> A,B vẫn phục vụ, C từ chối
```

Quorum không phá CAP, nhưng nó làm **quyết định rõ ràng**: nhóm nào đủ đa số thì “sống”.

## CAP trong các hệ thống cụ thể

### etcd / ZooKeeper

etcd và ZooKeeper ưu tiên consistency. Khi mất quorum, cluster sẽ từ chối ghi. Điều này đảm bảo linearizability, nhưng availability bị giảm khi mất nhiều node.

Lý do: chúng thường là hệ thống điều phối (coordination). Một write sai có thể làm sập cả hệ thống khác. Vì vậy, chọn C là hợp lý.

### Cassandra / Dynamo-style

Các hệ thống kiểu Dynamo ưu tiên availability. Khi partition, mỗi vùng vẫn chấp nhận ghi, sau đó reconciliation. Điều này đảm bảo hệ thống tiếp tục hoạt động, nhưng consistency bị giảm.

Lý do: workload của họ thường chấp nhận eventual consistency và ưu tiên uptime.

### Redis (replication)

Redis replication cơ bản là AP: master vẫn phục vụ ghi, replica có thể lag hoặc bị partition. Consistency giữa replica và master không được đảm bảo tức thời.

Redis Sentinel có thể thực hiện failover, nhưng trong partition split-brain, một replica có thể bị “promote” sai nếu quorum fail. Đây là ví dụ CAP trực tiếp.

## CAP và hệ thống microservices

Trong microservices, CAP thường xuất hiện ở:

- Service discovery.
- Distributed lock.
- Metadata store.

Nếu discovery system chọn AP, có thể dẫn đến route sai. Nếu chọn CP, có thể chặn toàn bộ deployment khi mất quorum. Vì vậy, CAP là quyết định chiến lược: hệ thống nào cần tính đúng tuyệt đối, hệ thống nào chấp nhận sai tạm thời.

## Một sơ đồ quyết định thực tế

```
If partition detected:
  If system is coordination / config:
    reject writes (CP)
  Else if system is cache / logging / metrics:
    allow writes (AP)
  Else:
    use quorum and degrade minority
```

Đây không phải luật, nhưng là một nguyên tắc phổ biến: các hệ thống “định nghĩa sự thật” thường chọn consistency; hệ thống “phục vụ trải nghiệm” thường chọn availability.

## CAP và độ trễ: chi phí của consistency

Chọn consistency thường kéo theo:

- Write phải đi qua leader.
- Cross-AZ latency tăng.
- Tail latency cao.

Chọn availability thường kéo theo:

- Conflict resolution.
- Read có thể stale.
- Logic phía ứng dụng phải chịu trách nhiệm reconcile.

Trong thực tế, quyết định CAP là quyết định chi phí: bạn trả chi phí ở write path hay trả chi phí ở read path và reconciliation.

## CAP không đủ để mô tả mọi thứ

CAP không nói về:

- Latency.
- Throughput.
- Failure detector accuracy.

Nhiều hệ thống sử dụng PACELC: nếu không có partition (P), bạn chọn giữa latency (L) và consistency (C). Đây là góc nhìn thực hơn: ngay cả khi hệ thống không bị partition, vẫn có tradeoff giữa consistency mạnh và latency thấp.

## Kết luận: CAP là chính sách khi mọi thứ xấu nhất

CAP không phải một slogan. Nó là lời nhắc rằng khi hệ thống bị phân vùng, bạn bắt buộc phải ưu tiên một trong hai: availability hoặc consistency mạnh. Trong thiết kế, cần:

- Xác định hệ thống nào là nguồn sự thật.
- Xác định hệ thống nào có thể chấp nhận dữ liệu tạm thời sai.
- Thiết kế timeout và quorum phù hợp với mục tiêu vận hành.

Nhìn từ production, CAP là quyết định về **hành vi khi gặp lỗi**, chứ không phải về trạng thái bình thường. Hiểu điều đó giúp bạn tránh những hệ thống “đẹp trên giấy nhưng vỡ trong thực tế”.
