---
title: "Bài 3: Hướng Dẫn Tích Hợp Eureka Service Discovery trong Hệ Thống Microservices Spring Boot"
description: "Giải thích cách tích hợp Eureka Service Discovery để các service trong hệ thống microservices Spring Boot có thể tự đăng ký và phát hiện lẫn nhau."
pubDate: 2025-06-30
category: "Microservices"
image: "/images/microservices/bai-3.jpg"
---

![Bài 3: Hướng Dẫn Tích Hợp Eureka Service Discovery trong Hệ Thống Microservices Spring Boot](/images/microservices/bai-3.jpg)


## Video

[Bài 3: Hướng Dẫn Tích Hợp Eureka Service Discovery](https://youtu.be/0edUGBXNJDs)

## Mục đích của bài viết

Trong hệ thống microservices, việc các dịch vụ có thể "nhìn thấy nhau" là điều bắt buộc để chúng có thể giao tiếp nội bộ. Nếu không có cơ chế khám phá dịch vụ (`service discovery`), lập trình viên sẽ phải tự tay khai báo từng địa chỉ IP hoặc port của từng dịch vụ trong mã nguồn hoặc file cấu hình. Điều này dễ dẫn đến lỗi, khó bảo trì và không linh hoạt khi triển khai trên cloud hoặc khi cần scale.

Spring Cloud cung cấp một công cụ giải quyết bài toán đó: **Eureka Service Discovery**, cho phép các service tự động đăng ký và phát hiện lẫn nhau trong runtime.

![Discovery Server](/images/microservices/discovery-server.png)

---
## Vì sao cần Eureka?

Giả sử bạn có 3 dịch vụ độc lập:

- `user-service` — quản lý người dùng
- `order-service` — quản lý đơn hàng
- `api-gateway` — điểm đầu vào duy nhất

Nếu không có Eureka, API Gateway phải biết chính xác địa chỉ của từng service:

```yaml
uri: http://localhost:8081
uri: http://localhost:8082
```

Điều gì xảy ra nếu bạn deploy lên môi trường khác, đổi port, hoặc scale thành nhiều instance? Mọi thứ sẽ bị hỏng.

Với Eureka, bạn chỉ cần dùng:

```yaml
uri: lb://user-service
```

Lúc này API Gateway sẽ tự động hỏi Eureka: `user-service` đang ở đâu, và Eureka sẽ trả lời bằng danh sách địa chỉ hiện hành.

---

## Thành phần cần thiết

1. **Eureka Server** — dịch vụ trung tâm giữ danh sách các service đang sống
2. **Eureka Client** — các service như user, order, gateway sẽ tự động đăng ký với Eureka Server

---

## Bước 1: Tạo Eureka Server

### Tạo project mới: `discovery-server`

- Group: `com.example`
- Artifact: `discovery-server`
- Dependencies:
  - **Eureka Server**
  - Spring Boot Actuator

Trong file `build.gradle`:

```plaintext
implementation 'org.springframework.cloud:spring-cloud-starter-netflix-eureka-server'
```

Main class:

```java
@EnableEurekaServer
@SpringBootApplication
public class DiscoveryServerApplication {
    public static void main(String[] args) {
        SpringApplication.run(DiscoveryServerApplication.class, args);
    }
}
```

Cấu hình `application.yml`:

```yaml
server:
  port: 8761
spring:
  application:
    name: discovery-server
eureka:
  client:
    register-with-eureka: false
    fetch-registry: false
```

Sau khi chạy xong, truy cập `http://localhost:8761` để xem giao diện quản lý các service đã đăng ký.

---

## Bước 2: Đăng ký một service vào Eureka

Ví dụ với `user-service`:

### 1. Thêm dependency vào `build.gradle`

```plaintext
implementation 'org.springframework.cloud:spring-cloud-starter-netflix-eureka-client'
```

### 2. Đảm bảo đã thêm Spring Cloud BOM để quản lý phiên bản

```plaintext
dependencyManagement {
  imports {
    mavenBom "org.springframework.cloud:spring-cloud-dependencies:2023.0.1"
  }
}
```

### 3. Cấu hình `application.yml`

```yaml
server:
  port: 8081

spring:
  application:
    name: user-service

  datasource:
    url: jdbc:h2:mem:userdb
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

eureka:
  client:
    service-url:
      defaultZone: http://localhost:8761/eureka
```

Sau đó chạy `user-service`. Truy cập `http://localhost:8761` sẽ thấy tên `USER-SERVICE` hiển thị trong bảng.

---

## Bước 3: Tích hợp Eureka trong API Gateway

API Gateway cũng là một Eureka client. Mục tiêu là để bạn không cần hardcode địa chỉ service trong file cấu hình.

### 1. Thêm dependency vào `build.gradle`

```plaintext
implementation 'org.springframework.cloud:spring-cloud-starter-netflix-eureka-client'
```

### 2. Cấu hình `application.yml`

```yaml
server:
  port: 8080

spring:
  application:
    name: api-gateway

  cloud:
    gateway:
      routes:
        - id: user-service
          uri: lb://user-service
          predicates:
            - Path=/api/users/**

        - id: order-service
          uri: lb://order-service
          predicates:
            - Path=/api/orders/**

eureka:
  client:
    service-url:
      defaultZone: http://localhost:8761/eureka
```

### 3. Lưu ý quan trọng

`uri` phải dùng `lb://` chứ không phải `http://`, vì `lb://` mới kích hoạt tính năng load balancing và discovery qua Eureka.

---

## Chạy thử toàn bộ hệ thống

1. Chạy `discovery-server`
2. Chạy `user-service` và `order-service`
3. Chạy `api-gateway`

Sau đó mở `http://localhost:8761` bạn sẽ thấy các service lần lượt hiển thị. Đây là bằng chứng rằng các service đã đăng ký thành công vào Eureka.

Thử gửi một request:

```bash
curl http://localhost:8080/api/users
```

Nếu mọi thứ đúng, Gateway sẽ định tuyến đến `user-service` và trả về kết quả.

---

## Tóm tắt

- Eureka giúp các service phát hiện lẫn nhau mà không cần hardcode địa chỉ
- Việc sử dụng `lb://<service-name>` thay cho `http://host:port` giúp hệ thống linh hoạt, dễ scale và dễ deploy
- Spring Cloud cung cấp Eureka như một starter tiện lợi, bạn chỉ cần cấu hình là chạy được
- Eureka là một thành phần nền tảng trong kiến trúc microservices khi hệ thống có từ 2 service trở lên

---

**Mẹo:** Nếu bạn dùng Docker hoặc Kubernetes, Eureka giúp bạn loại bỏ phần lớn việc cấu hình địa chỉ mạng bằng tay.
