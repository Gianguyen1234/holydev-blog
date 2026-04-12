---
title: "Bài 11: Mockito + JUnit 5: Hướng Dẫn Viết Unit Test Cho Service Layer Step By Step"
description: "Hướng dẫn viết unit test cho service layer bằng JUnit 5 và Mockito, từ khái niệm cơ bản đến cách dùng when(...).thenReturn(...), assertEquals(...), verify(...), và thenAnswer(...)."
pubDate: 2025-08-19
category: "Microservices"
image: "/images/microservices/bai-11.png"
---

![Mockito + JUnit 5](/images/microservices/bai-11.png)

## Mục tiêu

Sau bài này, bạn sẽ hiểu được:

1. Unit Test là gì, và vì sao phải viết
2. JUnit dùng để làm gì
3. Mockito làm gì, và khi nào cần mock
4. 3 câu thần chú:
   * `when(...).thenReturn(...)`
   * `assertEquals(...)`
   * `verify(...)`

---

## 1. Unit Test là gì?

> **Unit Test** là việc kiểm thử từng đơn vị nhỏ nhất trong code, thường là một hàm hoặc một class.

Mục tiêu:

* đảm bảo mỗi hàm hoạt động đúng như mong đợi
* kiểm tra nhiều đầu vào khác nhau
* không phụ thuộc vào database thật, API thật, hay server thật

Ví dụ, giả sử ta có hàm:

```java
UserService.getUserById(Long id)
```

Khi viết Unit Test, ta:

* không kết nối database thật
* không cần chạy ứng dụng Spring Boot
* chỉ kiểm tra logic bên trong hàm đó

---

## 2. JUnit là gì?

> **JUnit** là framework testing phổ biến nhất cho Java.

Nó cung cấp các annotation như:

* `@Test` -> đánh dấu một test case
* `@BeforeEach` -> chạy trước mỗi test
* `@ExtendWith(MockitoExtension.class)` -> kết hợp JUnit với Mockito

Ngoài ra còn có các hàm kiểm chứng như:

* `assertEquals()`
* `assertThrows()`
* `assertNotNull()`

---

## 3. Mockito là gì?

> **Mockito** giúp bạn tạo ra các đối tượng giả để test code mà không phụ thuộc vào hệ thống thật.

Ví dụ:

* thay vì kết nối DB thật, ta mock `UserRepository`
* mục tiêu là kiểm tra logic trong `UserService` mà không cần database

---

## 4. Ví dụ thực tế

Xem video:

`https://youtu.be/29rGLS-aOB8`

---

## 5. Giải thích chi tiết 3 “thần chú”

### `when(...).thenReturn(...)`

> Dùng để mô phỏng hành vi của mock object.

Ví dụ:

```java
when(userRepository.findAll()).thenReturn(List.of(mockUser));
```

Nghĩa là:

* khi service gọi `findAll()`
* đừng đụng vào DB thật
* hãy trả về danh sách này

Đây là **GIVEN phase**: thiết lập dữ liệu và hành vi.

### `assertEquals(expected, actual)`

> Dùng để kiểm tra kết quả thực tế có đúng như mong đợi hay không.

```java
assertEquals(1, result.size());
assertEquals("Alice", result.get(0).getName());
```

Ở đây:

* `1`, `"Alice"` là **expected**
* `result.size()`, `result.get(0).getName()` là **actual**

Nếu khác nhau:

* test fail
* nghĩa là logic trong service đang sai

Đây là **THEN phase**: xác nhận đầu ra.

### `verify(mock, times(n))`

> Dùng để kiểm tra xem mock có được gọi đúng cách hay không.

```java
verify(userRepository, times(1)).findAll();
```

Nghĩa là:

* đảm bảo `findAll()` được gọi đúng 1 lần
* nếu gọi nhiều hơn hoặc không gọi thì test fail

Đây là **AND phase**: xác nhận hành vi.

---

## 6. Biểu đồ luồng gọi

![](https://cdn.hashnode.com/res/hashnode/image/upload/v1760584324454/f5e58ae5-13cf-43fd-b0c4-86dc0788ef9b.png)

Giải thích luồng:

1. test chạy và tạo mock `Repo`
2. khi `getAllUsers()` gọi `repo.findAll()`, mock trả về dữ liệu giả
3. test kiểm tra kết quả bằng `assertEquals`
4. cuối cùng, `verify()` đảm bảo `findAll()` thật sự được gọi

---

## 7. Khi nào cần mỗi cái?

| Câu lệnh | Dùng khi | Kiểm tra cái gì |
| --- | --- | --- |
| `when(...).thenReturn(...)` | muốn mô phỏng hành vi của dependency | mock data trả về |
| `assertEquals(...)` | muốn so sánh kết quả đầu ra | logic đúng hay sai |
| `verify(...)` | muốn xác nhận code có gọi đúng hàm phụ thuộc | hành vi |

### Mẹo nhớ nhanh

1. **Given -> When -> Then**
   * **Given:** setup dữ liệu, giả lập hành vi mock
   * **When:** gọi method thật
   * **Then:** kiểm tra kết quả và verify

2. **1 test = 1 hành vi duy nhất**
   * đừng gộp nhiều logic vào 1 test

3. **Tên test phải mô tả được hành vi**
   * `testGetUserById_UserExists()`
   * `testGetUserById_UserNotFound_ShouldThrowException()`

---

## 8. Kết luận

* **JUnit** là khung kiểm thử
* **Mockito** giúp mô phỏng phụ thuộc
* **Unit Test** chỉ test một logic duy nhất, không chạm vào DB, network, hay hệ thống ngoài

Ba bước vàng trong test:

1. **GIVEN** -> `when(...)`
2. **WHEN** -> gọi hàm thật
3. **THEN** -> `assertEquals(...)` và `verify(...)`

---

## 9. Nâng cao với `thenAnswer()`

Trong Mockito, bạn có thể dùng `thenAnswer` để thực hiện một hành động tùy chỉnh.

Ví dụ:

* tự động gán `id` cho đối tượng `User` khi nó được lưu lại
* mô phỏng hành vi của repository hoặc database

### Sử dụng lambda với `thenAnswer()`

`thenAnswer()` cho phép bạn tạo phản hồi linh hoạt dựa trên đối số thực tế được truyền vào method của mock.

#### Trước Java 8

```java
import org.mockito.invocation.InvocationOnMock;
import org.mockito.stubbing.Answer;

when(mockedService.process(anyInt())).thenAnswer(new Answer<Integer>() {
    public Integer answer(InvocationOnMock invocation) {
        Integer argument = (Integer) invocation.getArguments()[0];
        return argument * 2;
    }
});
```

#### Với lambda của Java 8

```java
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.when;

when(mockedService.process(anyInt())).thenAnswer(invocation -> {
    Integer argument = invocation.getArgument(0);
    return argument * 2;
});
```

`invocation.getArgument(0)` là phương thức dùng để lấy đối số đầu tiên đã được truyền vào method của mock.
