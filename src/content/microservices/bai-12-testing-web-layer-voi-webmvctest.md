---
title: "Bài 12: Testing Web Layer Với WebMvcTest"
description: "Hướng dẫn test Controller trong Spring Boot bằng WebMvcTest, MockMvc, MockBean và jsonPath để kiểm tra HTTP status, response JSON và hành vi web layer."
pubDate: 2025-09-30
category: "Microservices"
image: "/images/microservices/bai-12.png"
---

![Testing Web Layer Với WebMvcTest](/images/microservices/bai-12.png)

---

## 1. Mục tiêu của test Controller

Controller là tầng **giao tiếp giữa client và backend**.

Nhiệm vụ chính của controller:

* nhận request HTTP
* gọi service để xử lý logic
* trả về response JSON đúng format, đúng status code

Khi test controller, ta **chỉ muốn test hành vi web**.

Ta không muốn:

* gọi service thật
* gọi database thật
* khởi động toàn bộ ứng dụng Spring Boot

Vì vậy, ta mock các tầng bên dưới controller.

Trong ví dụ `UserController`, tầng bên dưới thường là:

| Tầng | Mô tả | Tình huống trong `UserService` |
| --- | --- | --- |
| Service layer | xử lý logic nghiệp vụ, gọi repository | `UserService` chứa các hàm như `getAllUsers()`, `getUserById()` |
| Repository layer | giao tiếp với DB, thực hiện CRUD | `UserRepository` extends `JpaRepository` |

Khi test `UserController`, bạn sẽ:

* mock `UserService` bằng `@MockBean`
* vì controller gọi service, ta thay service thật bằng mock
* service đó nội bộ có thể gọi repository, nhưng trong test này nó không bao giờ được thực thi thật

Nói ngắn gọn:

* test controller thì mock service
* service bị mock thì repository cũng bị bỏ qua gián tiếp

---

## 2. Các annotation thường gặp trong Controller Test

| Annotation | Mục đích |
| --- | --- |
| `@WebMvcTest(ClassName.class)` | chỉ load web layer của app |
| `@MockBean` | tạo mock bean trong Spring context |
| `@Autowired` | inject các bean có trong Spring context, ví dụ `MockMvc`, `ObjectMapper` |
| `@ExtendWith(SpringExtension.class)` | tích hợp JUnit 5 với Spring context |
| `@BeforeEach` | chạy trước mỗi test method |
| `@Import(TestSecurityConfig.class)` | nạp thêm cấu hình security dành riêng cho test |

`@Import(TestSecurityConfig.class)` thường hữu ích khi project có Spring Security và bạn muốn cấu hình security đơn giản hơn cho test.

---

## 3. `@WebMvcTest` là gì?

`@WebMvcTest` tạo một Spring context nhẹ, chỉ tập trung vào web layer.

Ví dụ:

```java
@WebMvcTest(UserController.class)
class UserControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private UserService userService;
}
```

### `@WebMvcTest` load những gì?

Nó thường load:

* `@Controller`
* `@RestController`
* `@ControllerAdvice`
* Jackson `ObjectMapper`
* MVC config
* `MockMvc`

### `@WebMvcTest` không load những gì?

Nó không load:

* `@Service`
* `@Repository`
* repository thật
* database
* JPA layer
* toàn bộ application context như khi dùng `@SpringBootTest`

Mục tiêu là test nhanh và chỉ tập trung vào API endpoint.

---

## 4. `MockMvc` là gì?

`MockMvc` là một đối tượng giả lập HTTP client.

Nó cho phép bạn gọi controller mà **không cần khởi động server thật**.

Khi bạn viết:

```java
mockMvc.perform(get("/api/users/1"))
```

Spring sẽ:

* gọi vào `UserController.getUserById()`
* chạy qua web layer
* nếu service đã mock thì chỉ chạy đến mock service
* trả về một response ảo để bạn kiểm tra

Response đó có thể được kiểm tra bằng:

* HTTP status
* response body
* JSON field
* content type

---

## 5. Cấu trúc của `.andExpect(...)`

Sau khi gọi `perform()`, bạn nối thêm `.andExpect()` để kiểm tra kết quả trả về.

Ví dụ:

```java
mockMvc.perform(get("/api/users"))
       .andExpect(status().isOk())
       .andExpect(jsonPath("$[0].name").value("Alice"));
```

![](https://cdn.hashnode.com/res/hashnode/image/upload/v1761141459253/21ca8c8a-1f8b-4233-bb4e-12a02c2ed301.png)

Giải nghĩa:

| Phần | Kiểm tra gì | Ví dụ |
| --- | --- | --- |
| `status()` | HTTP status code | `status().isOk()` -> `200 OK` |
| `jsonPath()` | duyệt vào nội dung JSON để kiểm tra giá trị | `jsonPath("$.email").value("alice@example.com")` |

---

## 6. `jsonPath()` là gì?

`jsonPath` là cách duyệt vào JSON response.

Bạn có thể hiểu đơn giản:

* `XPath` dùng cho XML
* `jsonPath` dùng cho JSON

### Ví dụ JSON object

Response:

```json
{
  "id": 1,
  "name": "Alice",
  "email": "alice@example.com"
}
```

| jsonPath | Ý nghĩa | Kết quả |
| --- | --- | --- |
| `$.id` | trường `id` ở root | `1` |
| `$.name` | trường `name` ở root | `"Alice"` |
| `$.email` | trường `email` ở root | `"alice@example.com"` |

### Ví dụ JSON array

Response:

```json
[
  { "id": 1, "name": "Alice" },
  { "id": 2, "name": "Bob" }
]
```

| jsonPath | Ý nghĩa | Kết quả |
| --- | --- | --- |
| `$[0].name` | phần tử đầu tiên, trường `name` | `"Alice"` |
| `$[1].id` | phần tử thứ hai, trường `id` | `2` |

---

## 7. Khi nào dùng `$.email`, khi nào dùng `$[0].name`?

Cách viết `jsonPath` phụ thuộc vào JSON mà controller trả về.

Nếu API trả về object:

```json
{
  "email": "alice@example.com"
}
```

thì dùng:

```java
jsonPath("$.email")
```

Nếu API trả về list:

```json
[
  { "name": "Alice" }
]
```

thì dùng:

```java
jsonPath("$[0].name")
```

### Cách dễ nhất để biết JSON thật

Thêm `.andDo(print())` vào test:

```java
mockMvc.perform(get("/api/users"))
       .andDo(print());
```

Spring sẽ in toàn bộ response JSON ra console.

Bạn nhìn vào JSON thật, rồi viết `jsonPath()` tương ứng.

---

## 8. Cách viết `.andExpect()` tự nhiên

Giả sử controller như sau:

```java
@GetMapping("/api/users/{id}")
public ResponseEntity<UserDto> getUser(@PathVariable Long id) {
    return ResponseEntity.ok(new UserDto(1L, "Alice", "alice@example.com"));
}
```

Test có thể viết:

```java
mockMvc.perform(get("/api/users/{id}", 1L))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("Alice"))
        .andExpect(jsonPath("$.email").value("alice@example.com"));
```

Ý nghĩa:

* `status().isOk()` kiểm tra HTTP `200 OK`
* `jsonPath("$.name").value("Alice")` kiểm tra field `name`
* `jsonPath("$.email").value("alice@example.com")` kiểm tra field `email`

---

## 9. Mẹo học nhanh

### Luôn thêm `.andDo(print())` lúc mới viết test

```java
mockMvc.perform(get("/api/users"))
       .andDo(print());
```

Cách này giúp bạn nhìn JSON thật trong console.

### Viết test từ ngoài vào trong

Thứ tự dễ nhớ:

1. test status trước
2. test content type
3. test dữ liệu cụ thể bằng `jsonPath`

Ví dụ:

```java
mockMvc.perform(get("/api/users"))
       .andExpect(status().isOk())
       .andExpect(content().contentType(MediaType.APPLICATION_JSON))
       .andExpect(jsonPath("$[0].name").value("Alice"));
```

### Nhớ quy tắc object và list

Nếu API trả object:

```text
$.fieldName
```

Nếu API trả list:

```text
$[index].fieldName
```

---

## 10. Tổng kết dễ nhớ

| Mục tiêu | Code mẫu |
| --- | --- |
| In response để xem JSON | `.andDo(print())` |
| Kiểm tra HTTP status | `.andExpect(status().isOk())` |
| Kiểm tra kiểu dữ liệu | `.andExpect(content().contentType(MediaType.APPLICATION_JSON))` |
| Kiểm tra field trong JSON object | `.andExpect(jsonPath("$.email").value("alice@example.com"))` |
| Kiểm tra field trong JSON array | `.andExpect(jsonPath("$[0].name").value("Alice"))` |

---

## 11. Kết luận

`@WebMvcTest` giúp bạn test controller một cách gọn và nhanh.

Nó phù hợp khi bạn muốn kiểm tra:

* endpoint có trả đúng status code không
* response JSON có đúng format không
* controller có gọi service mock đúng flow không
* API có behave đúng ở web layer không

Điểm quan trọng:

* test controller thì không cần database
* test controller thì mock service
* dùng `MockMvc` để gọi endpoint
* dùng `andExpect()` để kiểm tra response
* dùng `jsonPath()` để kiểm tra JSON
