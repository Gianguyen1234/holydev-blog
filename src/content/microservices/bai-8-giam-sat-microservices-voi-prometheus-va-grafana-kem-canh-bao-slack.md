---
title: "Bài 8: Giám sát microservices với Prometheus và Grafana (kèm cảnh báo Slack)"
description: "Hướng dẫn cấu hình Prometheus và Grafana để giám sát microservices, tạo alert HTTP 5xx và gửi cảnh báo qua Slack."
pubDate: 2025-07-28
category: "Microservices"
image: "/images/microservices/bai-8.png"
---
![Giám sát microservices với Prometheus và Grafana](/images/microservices/bai-8.png)

Trong bài viết này, bạn sẽ học cách cấu hình Prometheus và Grafana để theo dõi và gửi cảnh báo lỗi trong hệ thống microservices, đặc biệt là khi service gặp HTTP 5xx giống như tình huống `user-service` không hoạt động.

---

## 1. Tại sao cần giám sát microservices?

Microservices linh hoạt, nhưng cũng đi kèm nhiều rủi ro:

* dễ phát sinh lỗi giữa các service mà không ai phát hiện
* khó xác định nguyên nhân khi hệ thống chậm hoặc lỗi
* cần một hệ thống cảnh báo tự động để phản ứng kịp thời

Bộ đôi **Prometheus + Grafana** giúp bạn:

* thu thập metric từ từng service
* tạo dashboard trực quan
* gửi cảnh báo qua Slack, Email hoặc Telegram

---

## 2. Cài đặt Prometheus và Grafana bằng Docker Compose

### Tạo file `docker-compose.yml`

```yaml
services:
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    restart: unless-stopped

  grafana:
    image: grafana/grafana
    ports:
      - "3000:3000"
    restart: unless-stopped
```

### Tạo file `prometheus.yml`

```yaml
global:
  scrape_interval: 10s

scrape_configs:
  - job_name: 'user-service'
    metrics_path: '/actuator/prometheus'
    static_configs:
      - targets: ['host.docker.internal:8081']

  - job_name: 'order-service'
    metrics_path: '/actuator/prometheus'
    static_configs:
      - targets: ['host.docker.internal:8082']

  - job_name: 'notification-service'
    metrics_path: '/actuator/prometheus'
    static_configs:
      - targets: ['host.docker.internal:8083']
```

---

## 3. Cấu hình Spring Boot export metric

### Thêm dependency trong `build.gradle`

```plaintext
implementation 'org.springframework.boot:spring-boot-starter-actuator'
implementation 'io.micrometer:micrometer-registry-prometheus'
```

### Cấu hình `application.yml`

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,info,prometheus
  prometheus:
    metrics:
      export:
        enabled: true
```

Sau khi khởi động, kiểm tra tại:

```text
http://localhost:8082/actuator/prometheus
```

---

## 4. Kết nối Grafana với Prometheus

* truy cập `http://localhost:3000`
* tài khoản mặc định: `admin/admin`
* add data source: `Prometheus`
  * URL: `http://prometheus:9090`
* import dashboard:
  * JVM (ID: `4701`)
  * hoặc tự tạo dashboard riêng cho HTTP request

### Tại sao có dữ liệu dù không gửi request?

Có thể do:

* app hoặc framework đang có request nội bộ như health check, actuator
* có tool monitoring khác đang quét endpoint
* trình duyệt gửi `OPTIONS`, hoặc `GET /actuator/prometheus`

### Cách kiểm tra

```promql
sum(rate(http_server_requests_seconds_count[1m])) by (method, uri)
```

Biểu thức này cho biết method và URI nào đang được gọi.

---

## 5. Tạo Alert HTTP 5xx và gửi qua Slack

### a. Viết Alert Rule

* vào `Alerting -> Alert Rules -> New Alert Rule`
* chọn panel chứa metric `http_server_requests_seconds_count`
* query:

```promql
sum(rate(http_server_requests_seconds_count{status=~"5..", instance="host.docker.internal:8082"}[1m])) > 0
```

* condition: `WHEN > 0`
* evaluation every `1m`, pending `30s`
* folder: `HTTP-5xx-Monitoring`

### Configure notification message

**Summary**

```text
[Order-Service] HTTP 5xx Error Detected
```

**Description**

```text
Tỷ lệ lỗi HTTP 5xx trên order-service vượt ngưỡng > 0 trong vòng 1 phút. Hệ thống có thể đang gặp sự cố.
```

### b. Thêm Contact Point Slack

* vào `Alerting -> Contact Points -> Add contact point`
* loại: **Slack**
* nhập Slack Webhook URL

#### Bước 1: Tạo Slack App và lấy Webhook

1. truy cập: `https://api.slack.com/apps`
2. nhấn **Create New App**
3. chọn **From scratch**
4. đặt tên app, chọn workspace
5. vào mục **Incoming Webhooks**
6. bật **Activate Incoming Webhooks**
7. nhấn **Add New Webhook to Workspace**
8. chọn kênh muốn nhận cảnh báo
9. copy webhook URL

#### Bước 2: Cấu hình Contact Point trong Grafana

1. vào `Alerting -> Contact points`
2. click **New contact point**
3. đặt tên, ví dụ: `Slack-alert-order`
4. **Integration**: chọn `Slack`
5. dán webhook URL
6. nhấn **Test**
7. nhấn **Save contact point**

### c. Notification Policy

* vào `Alerting -> Notification Policies`
* set default contact point là Slack
* group by: `grafana_folder`, `alertname`

### Lưu ý về SecurityConfig

Trước khi Prometheus scrape được `/actuator/prometheus`, bạn cần mở endpoint này trong `user-service`:

```java
@Bean
public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http
            .authorizeHttpRequests(auth -> auth
                    .requestMatchers("/actuator/prometheus").permitAll()
                    .requestMatchers("/actuator/**").permitAll()
                    .anyRequest().authenticated()
            )
            .oauth2ResourceServer(resource -> resource
                    .jwt(Customizer.withDefaults())
            )
            .csrf(AbstractHttpConfigurer::disable);

    return http.build();
}
```

---

## 6. Mô phỏng lỗi thực tế và nhận cảnh báo

### a. Gửi request lỗi

Tạm tắt `user-service`, sau đó gọi API order:

```bash
curl -X POST http://localhost:8082/api/orders \
  -H "Authorization: Bearer API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
        "product": "Macbook Pro",
        "price": 2500.0,
        "total": 2500.0
      }'
```

### b. Slack sẽ nhận cảnh báo sau khoảng 30 giây

```text
[FIRING:1] Errors HTTP-5xx-Monitoring
Firing
Value: A=0.1638, C=1
summary = [Order-Service] HTTP 5xx Error Detected
```

* `A`: giá trị của biểu thức PromQL
* `C`: số lượng alert đang active

---

## 7. Best Practices

* gắn label `application`, `instance`, `status` vào metric
* tạo folder riêng theo nhóm cảnh báo
* export dashboard và alert rule ra JSON để version control
* dùng Alertmanager riêng nếu cần gửi SMS hoặc email

---

## 8. Giải thích biểu đồ, đơn vị và cảnh báo

### a. `ops/s` là gì?

`ops/s` là viết tắt của **operations per second** — số lượng request được xử lý mỗi giây.

Ví dụ:

```promql
rate(http_server_requests_seconds_count[1m])
```

### b. Spike là gì?

* spike là sự tăng vọt đột ngột trong dữ liệu
* spike HTTP 5xx nghĩa là số lượng lỗi tăng mạnh trong thời gian ngắn
* để tránh false positive, alert rule nên dùng thêm `for: 30s` hoặc `for: 1m`

### c. Peak `0.02 ops/s` là gì?

Peak là điểm cao nhất.

Ví dụ `0.02 ops/s` nghĩa là tại đỉnh, hệ thống xử lý khoảng:

```text
1 lỗi mỗi 50 giây
```

### d. Làm sao biết tham số nào an toàn?

* `Heap Used < 80%`: thường an toàn
* `Non-Heap < 70%`: thường bình thường
* `Errors = 0`: lý tưởng
* `Duration < 100ms`: thường tốt

Nếu kéo dài quá ngưỡng, cần điều tra nguyên nhân.

### e. So sánh Alertmanager và Grafana Alerting

* **Alertmanager**: đi kèm Prometheus, route alert tới Slack, Email, Telegram
* **Grafana Alerting**: trực quan hơn, dễ dùng nếu bạn đã dùng Grafana làm trung tâm dashboard

Nếu bạn đã dùng Grafana làm trung tâm, thì chưa bắt buộc phải dùng Alertmanager.

---

## 9. Kết luận

Với Prometheus và Grafana, bạn không chỉ hiển thị dashboard mà còn có thể chủ động cảnh báo ngay khi service gặp sự cố.

Bài viết này đi từ setup cơ bản đến gửi alert lên Slack — một bước quan trọng khi bắt đầu giám sát production.

Bạn có thể mở rộng thêm bằng cách tích hợp:

* Alertmanager
* Email
* Loki
* Tempo

---

## 10. Các biểu thức PromQL hữu ích

### 1. JVM - Memory (Heap / Non-Heap / GC)

### Heap Usage %

```promql
(sum(jvm_memory_used_bytes{area="heap"}) / sum(jvm_memory_max_bytes{area="heap"})) * 100
```

### Non-Heap Usage %

```promql
(sum(jvm_memory_used_bytes{area="nonheap"}) / sum(jvm_memory_max_bytes{area="nonheap"})) * 100
```

### GC Count

```promql
sum(increase(jvm_gc_collection_seconds_count[5m])) by (gc)
```

### GC Time

```promql
sum(increase(jvm_gc_collection_seconds_sum[5m])) by (gc)
```

### 2. CPU

### CPU Usage ở mức process

```promql
rate(process_cpu_seconds_total[1m])
```

### CPU Usage % ở mức node

```promql
100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[1m])) * 100)
```

### 3. Thread

### Live Threads

```promql
jvm_threads_live_threads
```

### Daemon Threads

```promql
jvm_threads_daemon_threads
```

### 4. HTTP Metrics

### HTTP Request Count theo status

```promql
sum(rate(http_server_requests_seconds_count[1m])) by (status)
```

### HTTP Error Rate

```promql
sum(rate(http_server_requests_seconds_count{status=~"5.."}[1m]))
/
sum(rate(http_server_requests_seconds_count[1m]))
```

### HTTP Latency - 95 percentile

```promql
histogram_quantile(0.95, sum(rate(http_server_requests_seconds_bucket[5m])) by (le))
```

### 5. HikariCP - Connection Pool

### Active Connections

```promql
hikaricp_connections_active
```

### Max Connections

```promql
hikaricp_connections_max
```

### Connection Usage %

```promql
(hikaricp_connections_active / hikaricp_connections_max) * 100
```

### 6. Docker / Container Metrics

### Memory Usage

```promql
container_memory_usage_bytes{name=~".+"}
```

### CPU Usage

```promql
rate(container_cpu_usage_seconds_total{name=~".+"}[1m])
```

### 7. Uptime / Availability

### Uptime

```promql
(time() - process_start_time_seconds)
```

### Target Up

```promql
up{job=~".*"} == 0
```

---

## 11. Các trường hợp cần đặt alert phổ biến

### 1. Availability / Sự sẵn sàng của dịch vụ

* HTTP 5xx tăng cao
* không phản hồi
* `up == 0`

Ví dụ:

```promql
up{job="my_service"} == 0
```

### 2. Performance / Hiệu năng

* CPU > 90%
* Memory > 90%
* Heap > 85%
* Request latency > 2s
* số thread hoặc connection tăng bất thường

### 3. Error rate / Lỗi ứng dụng

* HTTP 500 tăng
* exception tăng
* failed login tăng

Ví dụ:

```promql
sum(rate(http_server_errors_total[1m])) > 5
```

### 4. SLA / SLO monitoring

* uptime < 99.9%
* error rate > 0.1%
* P99 latency > 1s

### 5. Resource saturation

* Heap gần đầy
* GC quá thường xuyên
* Disk usage > 90%
* Network bandwidth chạm ngưỡng

### 6. Infrastructure

* container restart quá nhiều
* node exporter không gửi metrics
* Prometheus scrape thất bại

### 7. Custom business alert

* đơn hàng thất bại > 10 trong 1 phút
* số user active tụt bất thường
* job không chạy đúng cron

### Tổng kết nhanh

| Loại | Mục tiêu | Alert ví dụ |
| --- | --- | --- |
| Availability | phát hiện service die | `up == 0` |
| Performance | hiệu năng xuống | CPU > 90% |
| Error | bug xuất hiện | HTTP 5xx > 10 |
| SLA | giữ cam kết | Latency > P95 |
| Resource | phòng tránh sập | Heap > 85% |
| Infra | giám sát nền | Prometheus scrape failed |
| Business | mục tiêu hệ thống | Failed checkout > 5 |
