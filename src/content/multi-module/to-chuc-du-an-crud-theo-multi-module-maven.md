---
title: "Tổ chức dự án CRUD theo multi-module (Maven)"
description: "Cách tổ chức một dự án CRUD theo multi-module với Maven, từ parent aggregator, shop-app, shop-core đến shop-user."
pubDate: 2025-10-23
category: "Multi-Module"
image: "/images/multi-module/crud-modular-monolith.png"
---

![ Maven Multi-Module  ](/images/multi-module/crud-modular-monolith.png)

## Video

[Spring Boot CRUD với Maven Multi-Module | Tổ chức Modular Monolith cho sinh viên IT](https://youtu.be/w2a5rh84rcY)

## 1. Vì sao nên tách code thành nhiều module?

Khi mới làm project, thường mọi thứ được bỏ hết vào một chỗ: controller, service, repository, model... dồn chung trong cùng package hoặc cùng thư mục. Cách này dễ bắt đầu, nhưng khi project lớn dần sẽ rối rất nhanh.

Lúc đó, việc tách thành nhiều module riêng cho từng phần sẽ giúp:

* **Code rõ ràng, dễ tìm kiếm**
  Ví dụ: `auth`, `user`, `product`, `order` — mỗi nghiệp vụ có khu vực riêng.

* **Dễ bảo trì và mở rộng**
  Muốn thêm tính năng, bạn chỉ cần chạm vào đúng module liên quan.

* **Hỗ trợ teamwork**
  Một người phụ trách `user`, người khác phụ trách `order`, giảm va chạm code.

* **Có thể tái sử dụng**
  Ví dụ module `auth` hoặc `core` viết tốt có thể đem qua project khác.

* **Là bước đệm để học kiến trúc nâng cao**
  Quen với multi-module rồi thì sau này học DDD, Hexagonal hay microservices sẽ dễ hơn nhiều.

Đây cũng là cách rất nhiều công ty đi theo:

* ban đầu là **monolith modular**
* khi hệ thống phình to mới tách dần sang microservices

Bài viết giới thiệu về multi-module:

[https://www.facebook.com/share/p/14FKutNqAZz/](https://www.facebook.com/share/p/14FKutNqAZz/)

## 2. Con đường tiến hóa kiến trúc từ CRUD đến microservices

### 1. CRUD monolith (single-module)

```yaml
project/
 ├── controller/
 ├── service/
 ├── repository/
 └── model/
```

Dễ bắt đầu, nhưng khi code nhiều sẽ rối, logic chồng chéo, khó teamwork.

### 2. Multi-module CRUD (modular monolith cơ bản)

```yaml
project/
 ├── user/
 ├── product/
 ├── order/
 └── common/
```

Code gọn hơn, dễ tìm, dễ teamwork. Đây là bước đệm rất quan trọng.

### 3. DDD Modular Monolith

```yaml
project/
 ├── user/
 │   ├── domain/
 │   ├── application/
 │   ├── infrastructure/
 │   └── interface/
 ├── product/
 ├── order/
 └── common/
```

Domain rõ hơn, nghiệp vụ nằm đúng chỗ, hạ tầng được tách ra tốt hơn.

### 4. Microservices

```yaml
user-service/
product-service/
order-service/
gateway/
```

Mỗi domain chạy thành service riêng, có DB riêng, giao tiếp qua API hoặc event.

### Tóm lại

* bắt đầu từ CRUD monolith
* sau đó đi lên multi-module CRUD
* rồi học dần tư duy DDD
* microservices là bước sau, không nên nhảy vào quá sớm

## 3. Ví dụ cấu trúc multi-module cho project CRUD

Giả sử bạn đang làm một project bán hàng nhỏ: có `user`, `product`, `order`.

Thay vì để mọi thứ vào cùng một chỗ, ta chia project thành các module:

```text
project-root/
 ├── user/
 │   ├── controller/
 │   ├── service/
 │   ├── repository/
 │   └── model/
 │
 ├── product/
 │   ├── controller/
 │   ├── service/
 │   ├── repository/
 │   └── model/
 │
 ├── order/
 │   ├── controller/
 │   ├── service/
 │   ├── repository/
 │   └── model/
 │
 └── core/
```

Ưu điểm:

* dễ tìm code
* dễ chia việc theo module
* dễ thêm `payment`, `inventory`, `shipment` về sau
* codebase sạch hơn rất nhiều so với monolith không phân vùng

Đây chính là bước “dọn dẹp monolith” trước khi học tiếp các kiến trúc khó hơn.

## 4. Tạo Parent Aggregator với packaging `pom`

### Bước 1: Tạo project Maven cha

* File -> New -> Project -> Maven
* `groupId`: `com.example`
* `artifactId`: `shop`

### Bước 2: Cấu hình `shop/pom.xml`

`packaging = pom` nghĩa là project cha này không sinh ra `jar` hay `war`, mà chỉ làm nhiệm vụ:

* quản lý version
* gom module
* quản lý plugin

```xml
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>com.example</groupId>
    <artifactId>shop</artifactId>
    <version>1.0.0-SNAPSHOT</version>
    <packaging>pom</packaging>

    <properties>
        <java.version>17</java.version>
        <spring.boot.version>3.5.4</spring.boot.version>
    </properties>

    <dependencyManagement>
        <dependencies>
            <dependency>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-dependencies</artifactId>
                <version>${spring.boot.version}</version>
                <type>pom</type>
                <scope>import</scope>
            </dependency>
        </dependencies>
    </dependencyManagement>

    <modules>
        <!-- thêm module con tại đây -->
    </modules>

    <build>
        <pluginManagement>
            <plugins>
                <plugin>
                    <groupId>org.apache.maven.plugins</groupId>
                    <artifactId>maven-compiler-plugin</artifactId>
                    <configuration>
                        <source>${java.version}</source>
                        <target>${java.version}</target>
                    </configuration>
                </plugin>
            </plugins>
        </pluginManagement>
    </build>
</project>
```

Lưu ý:

* parent không có `src/`
* nó chỉ quản lý project

## 5. Tạo module con đầu tiên: `shop-app`

### Cách nhanh trong IntelliJ

* right-click root `shop` -> New -> Module -> Spring Initializr
* Group: `com.example`
* Artifact: `shop-app`
* Dependencies tối thiểu:
  * Spring Web
  * Validation
  * Spring Boot Actuator

Sau đó mở `shop-app/pom.xml` và đổi parent sang project cha:

```xml
<parent>
    <groupId>com.example</groupId>
    <artifactId>shop</artifactId>
    <version>1.0.0-SNAPSHOT</version>
    <relativePath>../pom.xml</relativePath>
</parent>

<artifactId>shop-app</artifactId>
<name>shop-app</name>
<description>shop application module</description>
```

## 6. Tạo thêm module domain: `shop-core`

Right-click `shop` -> New -> Module -> Maven

* Artifact: `shop-core`

### 1. `shop-core/pom.xml`

```xml
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <parent>
        <groupId>com.example</groupId>
        <artifactId>shop</artifactId>
        <version>1.0.0-SNAPSHOT</version>
        <relativePath>../pom.xml</relativePath>
    </parent>

    <artifactId>shop-core</artifactId>
    <packaging>jar</packaging>

    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-validation</artifactId>
        </dependency>

        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>

        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-data-jpa</artifactId>
        </dependency>

        <dependency>
            <groupId>com.fasterxml.jackson.core</groupId>
            <artifactId>jackson-databind</artifactId>
        </dependency>

        <dependency>
            <groupId>org.projectlombok</groupId>
            <artifactId>lombok</artifactId>
            <scope>provided</scope>
        </dependency>
    </dependencies>
</project>
```

### 2. Code mẫu trong `shop-core`

### `entity/BaseEntity.java`

```java
package com.example.shopcore.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Getter
@Setter
@MappedSuperclass
public abstract class BaseEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @CreationTimestamp
    @Column(updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    private Instant updatedAt;
}
```

### `dto/ApiResponse.java`

```java
package com.example.shopcore.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ApiResponse<T> {
    private boolean success;
    private String message;
    private T data;

    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(true, "OK", data);
    }

    public static <T> ApiResponse<T> error(String message) {
        return new ApiResponse<>(false, message, null);
    }
}
```

### `exception/BusinessException.java`

```java
package com.example.shopcore.exception;

public class BusinessException extends RuntimeException {
    public BusinessException(String message) {
        super(message);
    }
}
```

### `exception/GlobalExceptionHandler.java`

```java
package com.example.shopcore.exception;

import com.example.shopcore.dto.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

@ControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<?>> handleBusiness(BusinessException ex) {
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error(ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<?>> handleValidation(MethodArgumentNotValidException ex) {
        String errorMessage = ex.getBindingResult().getAllErrors().get(0).getDefaultMessage();
        return ResponseEntity
                .badRequest()
                .body(ApiResponse.error(errorMessage));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<?>> handleGeneric(Exception ex) {
        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Internal error: " + ex.getMessage()));
    }
}
```

### 3. `shop-core` dùng để làm gì?

* `BaseEntity` -> base class cho mọi entity
* `ApiResponse` -> chuẩn hóa response
* `BusinessException` -> ném lỗi nghiệp vụ
* `GlobalExceptionHandler` -> gom xử lý exception

Với `shop-core`, các module khác sẽ gọn hơn rất nhiều.

## 7. Viết tiếp module `shop-user`

### 1. `shop-user/pom.xml`

```xml
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <!-- tự thêm parent vào đây -->

    <artifactId>shop-user</artifactId>
    <packaging>jar</packaging>

    <dependencies>
        <dependency>
            <groupId>com.example</groupId>
            <artifactId>shop-core</artifactId>
            <version>1.0.0-SNAPSHOT</version>
        </dependency>

        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-data-jpa</artifactId>
        </dependency>

        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-validation</artifactId>
        </dependency>
    </dependencies>
</project>
```

### 2. Code mẫu trong `shop-user`

### `entity/User.java`

```java
package com.example.shopuser.entity;

import com.example.shopcore.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "users")
public class User extends BaseEntity {

    @Column(nullable = false, unique = true, length = 50)
    private String username;

    @Column(nullable = false)
    private String password;

    @Column(length = 100)
    private String email;

    @Column(length = 20)
    private String role;
}
```

### `dto/UserDto.java`

```java
package com.example.shopuser.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserDto {
    private Long id;

    @NotBlank(message = "Username không được để trống")
    private String username;

    @NotBlank(message = "Password không được để trống")
    private String password;

    @Email(message = "Email không hợp lệ")
    private String email;

    private String role;
}
```

### `repository/UserRepository.java`

```java
package com.example.shopuser.repository;

import com.example.shopuser.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsername(String username);
}
```

### `service/UserService.java`

```java
package com.example.shopuser.service;

import com.example.shopcore.dto.ApiResponse;
import com.example.shopcore.exception.BusinessException;
import com.example.shopuser.dto.UserDto;
import com.example.shopuser.entity.User;
import com.example.shopuser.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserService {
    private final UserRepository userRepository;

    public ApiResponse<UserDto> createUser(UserDto dto) {
        if (userRepository.findByUsername(dto.getUsername()).isPresent()) {
            throw new BusinessException("Username đã tồn tại");
        }
        User user = User.builder()
                .username(dto.getUsername())
                .password(dto.getPassword())
                .email(dto.getEmail())
                .role(dto.getRole() != null ? dto.getRole() : "USER")
                .build();
        userRepository.save(user);
        dto.setId(user.getId());
        return ApiResponse.ok(dto);
    }

    public ApiResponse<List<UserDto>> getAllUsers() {
        List<UserDto> users = userRepository.findAll()
                .stream()
                .map(u -> UserDto.builder()
                        .id(u.getId())
                        .username(u.getUsername())
                        .email(u.getEmail())
                        .role(u.getRole())
                        .build())
                .collect(Collectors.toList());
        return ApiResponse.ok(users);
    }

    public ApiResponse<UserDto> getUser(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new BusinessException("User không tồn tại"));
        return ApiResponse.ok(UserDto.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .role(user.getRole())
                .build());
    }

    public ApiResponse<Void> deleteUser(Long id) {
        if (!userRepository.existsById(id)) {
            throw new BusinessException("User không tồn tại");
        }
        userRepository.deleteById(id);
        return ApiResponse.ok(null);
    }
}
```

### `controller/UserController.java`

```java
package com.example.shopuser.controller;

import com.example.shopcore.dto.ApiResponse;
import com.example.shopuser.dto.UserDto;
import com.example.shopuser.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @PostMapping
    public ApiResponse<UserDto> createUser(@Valid @RequestBody UserDto dto) {
        return userService.createUser(dto);
    }

    @GetMapping
    public ApiResponse<List<UserDto>> getAllUsers() {
        return userService.getAllUsers();
    }

    @GetMapping("/{id}")
    public ApiResponse<UserDto> getUser(@PathVariable Long id) {
        return userService.getUser(id);
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteUser(@PathVariable Long id) {
        return userService.deleteUser(id);
    }
}
```

### Cấu hình `application.yml` tại `shop-app`

```yaml
spring:
  application:
    name: shop-app

  datasource:
    url: jdbc:h2:mem:shopdb
    driver-class-name: org.h2.Driver
    username: sa
    password:

  jpa:
    hibernate:
      ddl-auto: update
    show-sql: true
    properties:
      hibernate:
        format_sql: true

  h2:
    console:
      enabled: true
      path: /h2-console
      settings:
        web-allow-others: true
```

### Test

Nếu chạy lên, bạn sẽ có:

* `POST /api/users`
* `GET /api/users`
* `GET /api/users/{id}`
* `DELETE /api/users/{id}`

## 8. Run và build

* **Run**: mở `ShopApplication` rồi run
* **Build toàn bộ**: tại root chạy `mvn clean install`
* **Build module riêng**: chạy `install` ở đúng module

## 9. Lỗi thường gặp và cách xử lý

### Child vẫn dùng `spring-boot-starter-parent`

Bỏ đi, vì child đã có parent là `shop`.

### Không hiện nested module trong Project View

Bạn có thể đã tạo project mới thay vì module mới.

Hãy tạo bằng:

```text
File -> New -> Module...
```

### Version conflict

Đảm bảo parent đã import Spring Boot BOM và child không khai báo version cho starter.

### SDK mismatch

Kiểm tra:

* Project SDK = 17
* modules kế thừa từ Project SDK

## 10. Thực tế doanh nghiệp

Mô hình **Monolith Modular** rất phổ biến ở:

* ngân hàng
* bảo hiểm
* e-commerce

Người ta thường tách thành các module như:

* `customer`
* `card`
* `loan`
* `risk`
* `auth`

Ưu điểm:

* dễ kiểm soát transaction
* dễ giữ consistency
* phù hợp compliance

Khi cần scale hoặc tách hệ thống, một module có thể trở thành microservice như bước tiếp theo tự nhiên.
