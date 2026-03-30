---
title: "Bài 5: Kết nối Redis và Cache dữ liệu users"
description: "Giải thích cách kết nối Redis vào Spring Boot và cache dữ liệu users để giảm tải database trong hệ thống microservices."
pubDate: 2025-07-10
category: "Microservices"
image: "/images/microservices/bai-5.jpg"
---

![Bài 5: Kết nối Redis và Cache dữ liệu users](/images/microservices/bai-5.jpg)

## Redis là gì?

> **Redis** là một hệ thống lưu trữ dữ liệu dạng key-value, chạy trong RAM, cực kỳ nhanh.

Bạn có thể hình dung Redis giống như:

- một `HashMap` chạy trên server
- nơi bạn có thể `set`, `get`, `delete` dữ liệu cực nhanh
- dùng chủ yếu để cache, lưu tạm, giảm tải DB

## Redis dùng để làm gì trong microservices?

### 1. Cache dữ liệu để tăng tốc

- Ví dụ `user-service` có API `/api/users`
- Mỗi lần gọi bạn đều truy vấn DB -> chậm
- Giờ bạn cache kết quả đó vào Redis, lần sau chỉ cần `GET` từ Redis -> nhanh hơn nhiều

### 2. Giảm tải cho service khác

- Nếu `order-service` gọi `user-service` để lấy user
- Bạn có thể cache dữ liệu `user` trong Redis ở `order-service`
- Không cần gọi Feign liên tục

### 3. Giữ phiên đăng nhập

- Redis có thể lưu thông tin user đã đăng nhập, access token và các session data khác

---

## Ưu điểm của Redis

- chạy cực nhanh vì dùng RAM
- cú pháp đơn giản
- dễ tích hợp vào Spring Boot
- có thể dùng cho cache, pub/sub, queue

Redis là một phần rất quan trọng trong hệ thống microservices lớn:

- không thay thế DB chính, chỉ dùng như bộ nhớ đệm
- dùng đúng chỗ thì hệ thống nhẹ hơn, nhanh hơn, scale dễ hơn

---

## 🐳 Cài Redis bằng Docker cho local development

### Bước 1: Đảm bảo bạn đã cài Docker Desktop

- [Tải Docker Desktop](https://www.docker.com/products/docker-desktop/) nếu chưa cài
- Sau khi cài xong, mở terminal hoặc PowerShell và gõ:

```bash
docker --version
```

để kiểm tra Docker đã hoạt động hay chưa.

### Bước 2: Chạy Redis container

```bash
docker run --name redis-dev -p 6379:6379 -d redis
```

Giải thích:

| Tham số | Ý nghĩa |
| --- | --- |
| `--name redis-dev` | Đặt tên container là `redis-dev` |
| `-p 6379:6379` | Mở cổng `6379` |
| `-d redis` | Chạy image Redis chính thức ở chế độ nền |

### Bước 3: Kiểm tra Redis đã chạy chưa

```bash
docker ps
```

Bạn sẽ thấy dạng:

```plaintext
CONTAINER ID   IMAGE   COMMAND   ...   PORTS
xxxxxxx        redis   ...       ...   0.0.0.0:6379->6379/tcp
```

### Bước 4: Kiểm tra kết nối Redis

```bash
docker exec -it redis-dev redis-cli
```

Sau đó gõ:

```bash
ping
```

Redis sẽ trả về:

```plaintext
PONG
```

### Stop và xóa container nếu cần

```bash
# Dừng container
docker stop redis-dev

# Xóa container
docker rm redis-dev
```

---

## Mục tiêu

- Spring Boot kết nối Redis local qua `localhost:6379`
- cache dữ liệu `GET /api/users`
- demo lưu và lấy data bằng Redis tự động

## Bước 1: Thêm dependency vào `build.gradle`

```plaintext
implementation 'org.springframework.boot:spring-boot-starter-data-redis'
implementation 'org.springframework.boot:spring-boot-starter-cache'
```

---

## Bước 2: Cấu hình Redis trong `application.yml`

```yaml
cache:
  type: redis

data:
  redis:
    host: localhost
    port: 6379
```

Spring Boot sẽ tự auto-config nếu bạn dùng Spring Cache với Redis.

---

## Bước 3: Bật cache trong project

Trong class `UserServiceApplication.java`:

```java
@SpringBootApplication
@EnableCaching
public class UserServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(UserServiceApplication.class, args);
    }
}
```

---

## Bước 4: Cache trong controller hoặc service

```java
@Service
@RequiredArgsConstructor
public class UserService {
    private final UserRepository userRepository;

    @Cacheable("allUsers")
    public List<User> getAllUsers() {
        System.out.println("Querying DB...");
        return userRepository.findAll();
    }
}
```

```java
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/users")
public class UserController {
    private final UserService userService;
    private final UserRepository userRepository;

    @GetMapping
    public List<User> getUsers() {
        return userService.getAllUsers();
    }

    @PostMapping
    @CacheEvict(value = "allUsers", allEntries = true)
    public User createUser(@RequestBody User user) {
        return userRepository.save(user);
    }
}
```

---

## `implements Serializable`

### 1. Sửa class `User`

```java
package com.example.userservice.model;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
public class User implements Serializable {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private String email;
}
```

---

## Kết quả khi test

1. Gọi lần đầu: `GET http://localhost:8081/api/users`
   - In ra: `Querying DB...`
2. Gọi lại lần 2
   - Không in gì
   - Dữ liệu được lấy từ Redis

## Luồng hoạt động

1. `GET /api/users` lần đầu -> query DB -> cache kết quả
2. `GET /api/users` lần 2, 3, 4 -> lấy từ cache
3. `POST /api/users` -> xóa cache
4. `GET /api/users` lần tiếp -> query DB lại -> cache kết quả mới

---

## Test data trong Redis cache

## Redis đang cache cái gì?

Redis lưu theo key: `allUsers`

Bạn có thể dùng Redis CLI để xem:

```bash
docker exec -it redis-dev redis-cli
keys *
```

---

## Nâng cao: Dùng JSON Redis serializer

Nếu bạn muốn Redis lưu và hiển thị dữ liệu dưới dạng JSON dễ đọc, thì làm như sau:

## Cách chuyển sang JSON

### Bước 1: Tạo file `RedisConfig.java`

```java
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;

@Configuration
@EnableCaching
public class RedisConfig {

    @Bean
    public RedisCacheConfiguration cacheConfiguration() {
        return RedisCacheConfiguration.defaultCacheConfig()
            .serializeValuesWith(
                RedisSerializationContext.SerializationPair.fromSerializer(
                    new GenericJackson2JsonRedisSerializer()
                )
            );
    }
}
```

### Bước 2: Khởi động lại `user-service`

### Bước 3: Xóa cache cũ nếu muốn

Trong Redis CLI:

```bash
FLUSHALL
```

### Bước 4: Gọi lại `GET /api/users`

Redis sẽ tạo lại key `allUsers::SimpleKey []`

Bạn có thể:

```bash
GET "allUsers::SimpleKey []"
```

và kết quả sẽ là JSON.

Nếu bạn thấy `SimpleKey` khó gõ, có thể set key rõ ràng hơn:

```java
@Cacheable(value = "allUsers", key = "'all'")
public List<User> getAllUsers() {
    ...
}
```

---

## Tại sao làm vậy?

| Nếu dùng JDK serialize mặc định | Nếu dùng JSON serialize |
| --- | --- |
| Không đọc được | Đọc được bằng `GET` |
| Không tiện debug | Dễ debug |
| Bị lỗi nếu class không `Serializable` | Không cần `implements Serializable` |
