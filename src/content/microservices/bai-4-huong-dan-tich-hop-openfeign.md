---
title: "Bài 4: Hướng Dẫn Tích Hợp OpenFeign"
description: "Hướng dẫn tích hợp OpenFeign để order-service gọi user-service thông qua Eureka mà không cần hardcode URL."
pubDate: 2025-07-01
category: "Microservices"
image: "/images/microservices/bai-4.jpg"
---

![Bài 4: Tích Hợp OpenFeign](/images/microservices/bai-4.jpg)

## Vấn đề đặt ra

Trong hệ thống microservices, các dịch vụ thường xuyên phải gọi lẫn nhau. Ví dụ: `order-service` cần lấy thông tin người dùng từ `user-service`.

### Vì sao `order-service` cần thông tin từ `user-service`?

Giả sử bạn có đơn hàng với dữ liệu lưu trữ như sau:

```json
{
  "orderId": 1,
  "userId": 1001,
  "product": "Điện thoại",
  "price": 12000000
}
```

Trong bảng `orders` chỉ có `userId`, nhưng khi trả kết quả về cho client, bạn lại muốn thấy cả thông tin người đặt hàng:

```json
{
  "orderId": 1,
  "product": "Điện thoại",
  "price": 12000000,
  "user": {
    "id": 1001,
    "name": "Nguyen Van A",
    "email": "a@example.com"
  }
}
```

Điều đó có nghĩa là `order-service` phải gọi sang `user-service` để lấy dữ liệu user tương ứng.

Nếu bạn làm kiểu monolith, bạn có thể query bảng `users` trực tiếp. Nhưng trong microservices, mỗi service quản lý database riêng, nên phải gọi qua HTTP.

### Vấn đề khi không dùng OpenFeign

Nếu không dùng OpenFeign, bạn buộc phải dùng:

- `RestTemplate`
- xử lý URL thủ công
- tạo `HttpEntity`, `HttpHeaders`, `ResponseEntity`
- deserialize JSON thủ công

Việc này khiến code phức tạp, khó test, và không nhất quán giữa các service.

Spring Cloud cung cấp một thư viện tiện lợi: **OpenFeign** — giúp bạn gọi service khác như gọi một phương thức Java thông thường, không cần xử lý request/response thủ công.

---

## Mục tiêu

- gọi từ `order-service` đến `user-service` thông qua Eureka
- không cần hardcode URL
- viết mã gọi service như gọi hàm

---

## Các bước tích hợp OpenFeign vào `order-service`

### Bước 1: Thêm dependency vào `order-service`

Trong file `build.gradle`:

```plaintext
implementation 'org.springframework.cloud:spring-cloud-starter-openfeign'
```

Đừng quên BOM:

```plaintext
dependencyManagement {
  imports {
    mavenBom "org.springframework.cloud:spring-cloud-dependencies:2023.0.1"
  }
}
```

---

### Bước 2: Bật OpenFeign trong main class

Trong file `OrderServiceApplication.java`:

```java
@SpringBootApplication
@EnableFeignClients
public class OrderServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(OrderServiceApplication.class, args);
    }
}
```

Annotation `@EnableFeignClients` cho phép Spring quét các interface Feign và tự tạo các bean gọi service tương ứng.

---

### Bước 3: Tạo interface để gọi `user-service`

File `UserClient.java`:

```java
@FeignClient(name = "user-service")
public interface UserClient {

    @GetMapping("/api/users/{id}")
    UserDto getUserById(@PathVariable("id") Long id);
}
```

Bạn chỉ cần chỉ định `@FeignClient(name = "user-service")`. Phần còn lại sẽ được Spring tự động làm:

- tìm `user-service` trong Eureka
- gửi HTTP request tới `/api/users/{id}`
- parse JSON response thành `UserDto`

---

### Bước 4: Tạo DTO trung gian để nhận dữ liệu

Áp dụng cho cả `user-service` và `order-service`:

```java
@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserDto {
    private Long id;
    private String name;
    private String email;
}
```

Lưu ý: `UserDto` không cần phải giống hệt entity `User`, chỉ cần có đủ dữ liệu cần dùng.

**Ở `UserController` thêm:**

```java
@GetMapping("/{id}")
public UserDto getUserById(@PathVariable Long id) {
    User user = userRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("User not found"));
    return new UserDto(user.getId(), user.getName(), user.getEmail());
}
```

---

### Bước 5: Gọi Feign Client trong controller

```java
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderRepository orderRepository;
    private final UserClient userClient;

    @GetMapping("/{id}")
    public OrderResponse getOrderById(@PathVariable Long id) {
        Order order = orderRepository.findById(id).orElseThrow();

        // Gọi user-service bằng Feign
        UserDto user = userClient.getUserById(order.getUserId());

        return new OrderResponse(order.getId(), order.getProduct(), order.getPrice(), user);
    }
}
```

---

### Bước 6: Tạo class gộp kết quả trả về

```java
@Data
@NoArgsConstructor
@AllArgsConstructor
public class OrderResponse {
    private Long orderId;
    private String product;
    private Double price;
    private UserDto user;
}
```

---

## Kiểm tra hoạt động thực tế

`http://localhost:8080/api/users`

`http://localhost:8080/api/users/1`

Trước tiên, bạn cần chạy đủ 3 service:

1. `discovery-server`
2. `user-service`
3. `order-service`

Sau đó thử request:

```bash
curl http://localhost:8080/api/orders/1
```

Nếu thành công, bạn sẽ thấy:

- `order-service` lấy đơn hàng từ DB nội bộ
- sau đó gọi sang `user-service` để lấy thông tin người dùng tương ứng
- kết quả được gộp và trả về

---

## Kết luận

- OpenFeign là cách viết mã gọi REST API rất gọn, dễ hiểu
- không cần viết `RestTemplate` hay `WebClient` thủ công
- Spring sẽ tự quản lý việc đăng ký client, gọi mạng, parse kết quả
- kết hợp với Eureka, bạn không cần quan tâm IP hoặc port của service đích
- đây là cách gọi service-to-service phổ biến trong hệ thống microservices hiện đại

---

**Note:** Bạn có thể thêm `@RequestHeader`, `@PostMapping`, `@RequestBody` vào interface Feign để xử lý các loại request phức tạp hơn.
