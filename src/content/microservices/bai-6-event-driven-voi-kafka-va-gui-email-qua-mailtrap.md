---
title: "Bài 6: Event-Driven với Kafka & Gửi Email qua Mailtrap"
description: "Hướng dẫn xây dựng flow event-driven với Kafka trong microservices, từ order-service phát event đến notification-service nhận event và gửi email qua Mailtrap."
pubDate: 2025-07-14
category: "Microservices"
image: "/images/microservices/bai-6.jpg"
---
![Bài 6: Event-Driven với Kafka & Gửi Email qua Mailtrap](/images/microservices/bai-6.jpg)

## Kafka là gì?

**Apache Kafka** là một nền tảng **message streaming phân tán**:

- Kafka lưu trữ các sự kiện (`event`) theo thứ tự thời gian, gọi là **topic**
- Một service có thể gửi event (`producer`) vào topic, service khác có thể lắng nghe event (`consumer`) từ topic đó
- Kafka có tính **durable**, **scale tốt**, **chịu lỗi cao**, và được dùng trong các hệ thống lớn

---

## Event-driven là gì?

**Event-driven architecture** là mô hình giao tiếp giữa các service qua sự kiện, thay vì gọi REST API trực tiếp lẫn nhau.

Thay vì:

```text
order-service -> call REST -> notification-service
```

ta dùng:

```text
order-service -> gửi Kafka event -> notification-service lắng nghe
```

---

## Tại sao microservices cần event-driven?

| Vấn đề khi dùng REST | Lợi ích khi dùng Kafka / Event-driven |
| --- | --- |
| Service A phụ thuộc trực tiếp vào B | Services tách biệt hơn |
| Gọi REST phải chờ B xử lý xong | Gửi Kafka xong là tiếp tục luôn |
| Khó mở rộng, khó thêm service khác | Có thể thêm bất kỳ service nào cùng lắng nghe event |
| Khi B chết thì A dễ lỗi theo | Event vẫn được lưu trong Kafka |
| Khó xử lý song song nhiều task | Có thể chạy song song nhiều consumer |

## Ví dụ thực tế

```text
order-service -> gửi event Kafka "order_created"
notification-service -> nhận event -> gửi email
billing-service -> cũng nhận event -> tạo hóa đơn
warehouse-service -> cập nhật kho
```

---

## Khi nào nên dùng Event-Driven với Kafka?

- khi nhiều service cần xử lý cùng một hành động
- khi cần scale từng service độc lập
- khi muốn giảm lỗi dây chuyền giữa các service
- khi cần lưu lại event để xử lý lại sau

> Kafka giúp microservices giao tiếp linh hoạt hơn, dễ scale hơn, ít phụ thuộc hơn, và xử lý bất đồng bộ hiệu quả hơn.

## Mục tiêu

Xây dựng hệ thống theo kiến trúc event-driven:

- `order-service`: khi tạo đơn hàng mới thì gửi message qua Kafka
- `notification-service`: lắng nghe message và gửi email xác nhận đơn hàng cho khách hàng

---

## Kiến trúc tổng thể

```plaintext
Client -> OrderController
       -> KafkaTemplate.send("order-topic", OrderPlacedEvent)
-> Kafka (broker)
       ↓
-> NotificationService (Consumer)
       -> Gửi Email qua Mailtrap SMTP
```

---

## Bước 1: Khởi chạy Kafka và Zookeeper

### Tạo thư mục riêng cho Kafka

Ví dụ:

```plaintext
sample-springboot-projects/
├── order-service/
├── notification-service/
└── kafka-docker/
    └── docker-compose.yml
```

### Tạo file `docker-compose.yml`

```yaml
services:
  zookeeper:
    image: confluentinc/cp-zookeeper:7.4.4
    container_name: zookeeper-holy
    ports:
      - "2181:2181"
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000

  kafka:
    image: confluentinc/cp-kafka:7.4.4
    container_name: kafka-holy
    depends_on:
      - zookeeper
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper-holy:2181
      KAFKA_LISTENERS: PLAINTEXT://0.0.0.0:9092
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
```

Phần thao tác chi tiết bạn có thể làm theo video.

---

## Bước 2: Tại `order-service`

### Cấu hình `application.yml`

```yaml
spring:
  kafka:
    bootstrap-servers: localhost:9092
    producer:
      key-serializer: org.apache.kafka.common.serialization.StringSerializer
      value-serializer: org.springframework.kafka.support.serializer.JsonSerializer
      properties:
        spring.json.add.type.headers: false
```

### Thêm Kafka vào `build.gradle`

```plaintext
implementation 'org.springframework.kafka:spring-kafka'
```

### Gửi message Kafka

```java
package com.example.orderservice.services;

import com.example.orderservice.event.OrderPlacedEvent;
import com.example.orderservice.model.Order;
import com.example.orderservice.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final KafkaTemplate<String, OrderPlacedEvent> kafkaTemplate;

    public Order createOrder(Order order) {
        Order saved = orderRepository.save(order);

        OrderPlacedEvent event = OrderPlacedEvent.builder()
                .orderId(saved.getId())
                .userId(saved.getUserId())
                .total(saved.getTotal())
                .build();

        kafkaTemplate.send("order-topic", event);
        System.out.println("Da gui Kafka event: " + event);

        return saved;
    }
}
```

Nhớ thêm `total` vào `Order` entity.

## Tạo `OrderPlacedEvent`

Lưu ý: class này phải có ở cả hai service.

```java
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrderPlacedEvent {
    private Long orderId;
    private Long userId;
    private Double total;
}
```

### Gọi `OrderService` trong `OrderController`

```java
private final OrderService orderService;

@PostMapping
public Order placeOrder(@RequestBody Order order) {
    return orderService.createOrder(order);
}
```

---

## Bước 3: Tại `notification-service`

### Cấu hình `application.yml`

```yaml
server:
  port: 8083

spring:
  application:
    name: notification-service

  kafka:
    bootstrap-servers: localhost:9092
    consumer:
      group-id: notification-group
      auto-offset-reset: earliest
      key-deserializer: org.apache.kafka.common.serialization.StringDeserializer
      value-deserializer: org.springframework.kafka.support.serializer.JsonDeserializer
      properties:
        spring.json.trusted.packages: com.example.notificationservice.event
```

### Cấu hình Kafka Consumer

```java
import com.example.notificationservice.event.OrderPlacedEvent;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.core.DefaultKafkaConsumerFactory;
import org.springframework.kafka.support.serializer.JsonDeserializer;

import java.util.HashMap;
import java.util.Map;

@Configuration
public class KafkaConsumerConfig {

    @Bean
    public ConsumerFactory<String, OrderPlacedEvent> orderPlacedEventConsumerFactory() {
        Map<String, Object> props = new HashMap<>();
        props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092");
        props.put(ConsumerConfig.GROUP_ID_CONFIG, "notification-group");
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, JsonDeserializer.class);
        props.put(JsonDeserializer.TRUSTED_PACKAGES, "*");

        return new DefaultKafkaConsumerFactory<>(
                props,
                new StringDeserializer(),
                new JsonDeserializer<>(OrderPlacedEvent.class, false)
        );
    }

    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, OrderPlacedEvent> orderPlacedEventListenerFactory() {
        ConcurrentKafkaListenerContainerFactory<String, OrderPlacedEvent> factory =
                new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(orderPlacedEventConsumerFactory());
        return factory;
    }
}
```

### Lắng nghe message

```java
import com.example.notificationservice.event.OrderPlacedEvent;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class OrderEventListener {

    @KafkaListener(
            topics = "order-topic",
            groupId = "notification-group",
            containerFactory = "orderPlacedEventListenerFactory"
    )
    public void handleOrderEvent(OrderPlacedEvent event) {
        System.out.println("Nhan duoc event tu Kafka: " + event);
        // Thực hiện gửi email ở đây
    }
}
```

### Test

```bash
curl -X POST http://localhost:8082/api/orders \
  -H "Content-Type: application/json" \
  -d '{"userId":1, "product":"MacBook", "price":999.99, "total":999.99}'
```

Log mong đợi:

- `order-service`: đã gửi Kafka event
- `notification-service`: nhận được event từ Kafka

## Ghi nhớ

- **Producer**: object (`OrderPlacedEvent`) -> JSON -> Kafka topic
- **Consumer**: Kafka topic -> JSON -> object

---

# Gửi Email bằng Mailtrap SMTP

## Đảm bảo dependency mail đã có trong `build.gradle`

```plaintext
implementation 'org.springframework.boot:spring-boot-starter-mail'
```

### Cấu hình `application.yml`

```yaml
spring:
  mail:
    host: live.smtp.mailtrap.io
    port: 587
    username: api
    password: <YOUR_API_TOKEN>
    properties:
      mail:
        smtp:
          auth: false
          starttls:
            enable: true
```

### Gửi email

```java
import com.example.notificationservice.event.OrderPlacedEvent;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    public void sendOrderEmail(OrderPlacedEvent event) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true);

            helper.setFrom("sender@example.com");
            helper.setTo("recipient@example.com");
            helper.setSubject("Don hang moi #" + event.getOrderId());

            String body = "<p>Xin chao userId <b>" + event.getUserId() + "</b>,</p>" +
                    "<p>Don hang #" + event.getOrderId() + " vua duoc tao thanh cong!</p>" +
                    "<p>Tong tien: <b>$" + event.getTotal() + "</b></p>";

            helper.setText(body, true);

            mailSender.send(message);
            System.out.println("Gui email thanh cong!");

        } catch (MessagingException e) {
            System.err.println("Gui email that bai: " + e.getMessage());
        }
    }
}
```

## Kafka listener gọi `EmailService`

```java
import com.example.notificationservice.event.OrderPlacedEvent;
import com.example.notificationservice.service.EmailService;
import lombok.RequiredArgsConstructor;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class OrderEventListener {

    private final EmailService emailService;

    @KafkaListener(
            topics = "order-topic",
            groupId = "notification-group",
            containerFactory = "orderPlacedEventListenerFactory"
    )
    public void handleOrderEvent(OrderPlacedEvent event) {
        System.out.println("Nhan duoc event tu Kafka: " + event);
        emailService.sendOrderEmail(event);
    }
}
```

### Test

Gửi request tạo order:

```bash
curl -X POST http://localhost:8082/api/orders \
  -H "Content-Type: application/json" \
  -d '{"userId":1, "product":"MacBook", "price":999.99, "total":999.99}'
```

Sau đó kiểm tra Mailtrap Inbox để xem email đã được gửi đến.

## Kết quả mong đợi

1. Gửi `POST /api/orders`
2. `order-service` gửi event sang Kafka
3. `notification-service` nhận event và gửi email qua Mailtrap

---

## Lợi ích của kiến trúc Event-Driven

| Ưu điểm | Nhược điểm |
| --- | --- |
| Tách biệt service rõ ràng | Cần Kafka, thêm config |
| Dễ scale service | Debug phức tạp hơn |
| Tăng tính mở rộng hệ thống | Cần thêm bảo trì hạ tầng |

---

## Tổng kết

Kiến trúc event-driven với Kafka giúp hệ thống microservices hoạt động tách biệt hơn, dễ mở rộng hơn, và giảm coupling tối đa. Việc tích hợp với Mailtrap giúp bạn gửi email dễ dàng mà không cần dùng dịch vụ SMTP thật.
