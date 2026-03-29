---
title: "Bài 2: tạo order-service và hiểu về API gateway"
description: "Tạo order-service với Java Spring Boot, sau đó hiểu vai trò của API Gateway trong một hệ thống microservices cơ bản."
pubDate: 2025-06-29
category: "Microservices"
image: "/images/microservices/bai-2.jpg"
---

![Bài 2: tạo order-service và hiểu về API gateway](/images/microservices/bai-2.jpg)

### Video
[Bài 2: tạo order-service và hiểu về API gateway](https://youtu.be/1_xxnED2boQ)

Chúng ta sẽ tạo tiếp **microservice thứ hai:** `order-service`. Việc này giúp bạn hiểu thêm cách các service hoạt động độc lập nhưng có thể tương tác sau này qua API Gateway.

---

## Mục tiêu

Tạo `order-service` với REST API để:

- tạo đơn hàng
- lấy danh sách đơn hàng

---

## Entity `Order` gồm

- `id`: mã đơn
- `userId`: ID của người đặt (foreign key logic)
- `product`: tên sản phẩm
- `price`: giá sản phẩm

---

## Các bước

### 1. Tạo project Spring Boot mới

#### Trên IntelliJ

- File -> New -> Project -> Spring Initializr
- **Group**: `com.example`
- **Artifact**: `order-service`
- Dependencies:
  - Spring Web
  - Spring Data JPA
  - H2 Database
  - Lombok
  - Finish

---

### 2. Tạo file entity `Order.java`

```java
// src/main/java/com/example/orderservice/model/Order.java
package com.example.orderservice.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "orders")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Order {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long userId;
    private String product;
    private Double price;
}
```

---

### 3. Repository `OrderRepository.java`

```java
// src/main/java/com/example/orderservice/repository/OrderRepository.java
package com.example.orderservice.repository;

import com.example.orderservice.model.Order;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderRepository extends JpaRepository<Order, Long> {
}
```

---

### 4. Controller `OrderController.java`

```java
// src/main/java/com/example/orderservice/controller/OrderController.java
package com.example.orderservice.controller;

import com.example.orderservice.model.Order;
import com.example.orderservice.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderRepository orderRepository;

    @PostMapping
    public Order createOrder(@RequestBody Order order) {
        return orderRepository.save(order);
    }

    @GetMapping
    public List<Order> getAllOrders() {
        return orderRepository.findAll();
    }
}
```

---

### 5. Cấu hình `application.yml`

```yaml
# src/main/resources/application.yml
server:
  port: 8082

spring:
  datasource:
    url: jdbc:h2:mem:orderdb
    driverClassName: org.h2.Driver
    username: sa
    password:
  h2:
    console:
      enabled: true
  jpa:
    hibernate:
      ddl-auto: update
    show-sql: true
```

---

### 6. Test API

**POST `/api/orders`**

```json
{
  "userId": 1,
  "product": "Laptop Dell",
  "price": 24000.0
}
```

**GET `/api/orders`**

Kết quả sẽ là danh sách đơn hàng.

---

Done. Bạn đã có 2 microservice chạy độc lập:

- `user-service` chạy cổng `8081`
- `order-service` chạy cổng `8082`

---

## API Gateway

## Tại sao tạo nhiều project riêng biệt, không chung 1 project?

### Microservices là gì trong bối cảnh này?

> Kiến trúc phần mềm trong đó mỗi chức năng được tách thành một ứng dụng độc lập, chạy riêng, build riêng, deploy riêng.

---

### Ví dụ

| Service | Trách nhiệm riêng | Cổng |
| --- | --- | --- |
| `user-service` | Quản lý người dùng | 8081 |
| `order-service` | Quản lý đơn hàng | 8082 |
| `api-gateway` | Làm "người gác cổng", route API | 8080 |

---

### Nếu bạn dồn hết vào 1 project

- Không đúng microservice, mà là monolith
- Không thể mở rộng riêng từng phần
- Không thể triển khai độc lập từng service
- Không thể áp dụng cân bằng tải hoặc scale theo nhu cầu

![](https://cdn.hashnode.com/res/hashnode/image/upload/v1751028526634/2c6d11ef-3795-43df-b17d-114921138262.png)

---

## Vậy tạo `API Gateway` để làm gì?

### Vấn đề

Giờ bạn có:

- `/api/users` chạy ở `localhost:8081`
- `/api/orders` chạy ở `localhost:8082`

Điều đó có nghĩa là client phải biết từng cổng riêng. Đây là một API surface rất tệ nếu hệ thống tiếp tục lớn lên.

---

### Giải pháp: `API Gateway` (Spring Cloud Gateway)

#### Nó sẽ làm gì?

- nhận tất cả request từ client tại một điểm duy nhất: `localhost:8080`
- route request nội bộ đến đúng service

### Ví dụ khi dùng API Gateway

| Request từ client | Gateway route tới nội bộ |
| --- | --- |
| `GET /api/users` | `user-service` tại port 8081 |
| `POST /api/orders` | `order-service` tại port 8082 |

---

### Lợi ích của Gateway

- ẩn toàn bộ hệ thống nội bộ khỏi client
- thêm auth, logging, rate limit, trace tại một điểm duy nhất
- tích hợp dễ dàng với service discovery và load balancer

---

## Tổng kết

| Bạn đang làm gì | Tại sao |
| --- | --- |
| 1 project riêng mỗi service | Tách biệt chức năng, đúng microservice |
| Có `API Gateway` | Route tập trung, đơn giản hóa API client |
| Dùng cổng khác nhau | Vì mỗi service là 1 app chạy độc lập |

---

Tiếp theo, chúng ta sẽ tạo **API Gateway** bằng Spring Cloud Gateway để route từ `/api/users` và `/api/orders` tới các service tương ứng.

---

## Mục tiêu

Tạo microservice mới: `api-gateway`, chạy cổng `8080`, dùng để:

- nhận request HTTP tại `/api/users` và forward sang `user-service` (port 8081)
- nhận request HTTP tại `/api/orders` và forward sang `order-service` (port 8082)

---

## Các bước tạo API Gateway

### 1. Tạo project Spring Boot mới trong IntelliJ

- File -> New -> Project -> Spring Initializr
- **Group**: `com.example`
- **Artifact**: `api-gateway`
- Dependencies:
  - Spring Cloud Gateway
  - Spring Boot Actuator
  - Không cần Web hay JPA
- Finish

---

### 2. Cấu hình `application.yml`

```yaml
# src/main/resources/application.yml
server:
  port: 8080

spring:
  application:
    name: api-gateway

  cloud:
    gateway:
      routes:
        - id: user-service
          uri: http://localhost:8081
          predicates:
            - Path=/api/users/**

        - id: order-service
          uri: http://localhost:8082
          predicates:
            - Path=/api/orders/**
```

---

## Add Spring Cloud Gateway

### 1. Cập nhật `dependencies`

Thêm dòng này vào `dependencies { ... }`:

```plaintext
implementation 'org.springframework.cloud:spring-cloud-starter-gateway'
```

### 2. Thêm `Spring Cloud BOM` vào `dependencyManagement`

Thêm sau `repositories { ... }`:

```plaintext
dependencyManagement {
    imports {
        mavenBom "org.springframework.cloud:spring-cloud-dependencies:2023.0.1"
    }
}
```

## `build.gradle` hoàn chỉnh

```plaintext
plugins {
    id 'java'
    id 'org.springframework.boot' version '3.5.3'
    id 'io.spring.dependency-management' version '1.1.7'
}

group = 'com.example'
version = '0.0.1-SNAPSHOT'

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(17)
    }
}

repositories {
    mavenCentral()
}

dependencyManagement {
    imports {
        mavenBom "org.springframework.cloud:spring-cloud-dependencies:2023.0.1"
    }
}

dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-actuator'
    implementation 'org.springframework.cloud:spring-cloud-starter-gateway'

    testImplementation 'org.springframework.boot:spring-boot-starter-test'
    testRuntimeOnly 'org.junit.platform:junit-platform-launcher'
}

tasks.named('test') {
    useJUnitPlatform()
}
```

---

### 3. Run API Gateway

- Run `ApiGatewayApplication.java`
- Đảm bảo `user-service` và `order-service` cũng đang chạy

---

## Test routing

### 1. Gửi POST tạo user

```http
POST http://localhost:8080/api/users
Content-Type: application/json

{
  "name": "Nguyen Van A",
  "email": "a@example.com"
}
```

### 2. Gửi GET đơn hàng

```http
GET http://localhost:8080/api/orders
```

Gateway sẽ route các request đến đúng service nội bộ.

---

Bạn đã hoàn thành kiến trúc microservices cơ bản:

```plaintext
Browser / Frontend
    ↓
[API Gateway - 8080]
   ↙             ↘
[User Service]  [Order Service]
(8081)          (8082)
```
