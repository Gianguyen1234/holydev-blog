---
title: "Hướng Dẫn Tổng Quan Xây Dựng Hệ Thống Microservices Với Java Spring Boot"
description: "Tổng quan cách xây dựng hệ thống microservices với Java Spring Boot, gồm user-service, order-service, API Gateway, Eureka Discovery Server và giao tiếp giữa các service bằng OpenFeign."
pubDate: 2025-03-25
category: "Microservices"
image: "/images/microservices/microservices.png"
---

![Kiến trúc microservices với Java Spring Boot](/images/microservices/microservices.png)

## Mục Tiêu Tài Liệu

Tài liệu này giúp người học hiểu và áp dụng kiến trúc Microservices bằng Java Spring Boot từ con số 0. Bao gồm hướng dẫn thực hành từng bước để xây dựng hệ thống với các thành phần:

- User Service
- Order Service
- API Gateway
- Eureka Discovery Server

## 1. Giới Thiệu Microservices

### 1.1 Microservices là gì?

Microservices là kiến trúc phần mềm chia hệ thống thành các dịch vụ nhỏ, độc lập. Mỗi service có thể deploy riêng, chạy riêng, và chỉ làm một nhiệm vụ duy nhất.

### 1.2 So sánh với Monolith

| Tiêu chí | Monolith | Microservices |
| --- | --- | --- |
| Đóng gói | Một ứng dụng | Nhiều app nhỏ |
| Team Dev | Cùng 1 team | Mỗi team 1 service |
| Deploy | Deploy toàn hệ thống | Deploy từng phần |

### 1.3 Khi nào dùng Microservices?

- Dự án lớn, nhiều domain riêng biệt
- Nhiều team phát triển song song
- Cần scale linh hoạt từng phần

## 2. Tạo Dự Án Đầu Tiên: `user-service`

### 2.1 Khởi tạo Spring Boot Project

- Sử dụng Spring Initializr
- Dependency: Spring Web, Spring Data JPA, H2, Lombok

### 2.2 Cấu trúc project

```plaintext
user-service/
├── model/User.java
├── repository/UserRepository.java
├── controller/UserController.java
├── resources/application.yml
```

### 2.3 Code mẫu: Entity

```java
@Entity
@Table(name = "users")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String name;
    private String email;
}
```

### 2.4 Code mẫu: Controller

```java
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {
    private final UserRepository repo;

    @PostMapping
    public User create(@RequestBody User user) {
        return repo.save(user);
    }

    @GetMapping
    public List<User> getAll() {
        return repo.findAll();
    }
}
```

### 2.5 `application.yml`

```yaml
server:
  port: 8081
spring:
  application:
    name: user-service
  datasource:
    url: jdbc:h2:mem:userdb
  jpa:
    hibernate:
      ddl-auto: update
  h2:
    console:
      enabled: true
eureka:
  client:
    service-url:
      defaultZone: http://localhost:8761/eureka
```

## 3. Tạo `order-service`

Tương tự như `user-service`, chỉ khác model `Order`, cổng `8082`, và tên app `order-service`.

## 4. Tạo `discovery-server` (Eureka Server)

### 4.1 Dependency

```plaintext
implementation 'org.springframework.cloud:spring-cloud-starter-netflix-eureka-server'
```

### 4.2 Main Class

```java
@EnableEurekaServer
@SpringBootApplication
public class DiscoveryServerApplication {
    public static void main(String[] args) {
        SpringApplication.run(DiscoveryServerApplication.class, args);
    }
}
```

### 4.3 `application.yml`

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

## 5. Tạo `api-gateway`

### 5.1 Dependency

```plaintext
implementation 'org.springframework.cloud:spring-cloud-starter-gateway'
implementation 'org.springframework.cloud:spring-cloud-starter-netflix-eureka-client'
```

### 5.2 `application.yml`

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

## 6. Gọi giữa các service bằng OpenFeign

### 6.1 Thêm dependency

```plaintext
implementation 'org.springframework.cloud:spring-cloud-starter-openfeign'
```

### 6.2 Bật trong main class

```java
@EnableFeignClients
@SpringBootApplication
public class OrderServiceApplication { ... }
```

### 6.3 Interface Feign Client

```java
@FeignClient(name = "user-service")
public interface UserClient {
    @GetMapping("/api/users/{id}")
    UserDto getUserById(@PathVariable("id") Long id);
}
```

## 7. Kiến trúc tổng thể

```plaintext
[Client]
   ↓
[API Gateway - 8080]
   ↓
+--------------------------+
|        Eureka (8761)     |
+-------------+------------+
              ↓
    +---------+--------+
    | user-service (8081) |
    | order-service (8082)|
    +---------------------+
```

## 8. Tổng kết Microservices

### Ưu điểm

- Mỗi service nhỏ, dễ hiểu
- Phát triển và deploy độc lập
- Dễ scale từng phần

### Nhược điểm

- Phức tạp hơn so với monolith
- Cần các công cụ đi kèm: Eureka, Gateway, Feign

### Khi nào nên dùng?

- Dự án lớn, nhiều module
- Nhiều nhóm làm việc riêng biệt
