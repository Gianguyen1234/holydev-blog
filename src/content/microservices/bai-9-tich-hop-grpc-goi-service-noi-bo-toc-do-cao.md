---
title: "Bài 9: Tích hợp gRPC | Gọi service nội bộ tốc độ cao"
description: "Hướng dẫn tích hợp gRPC để order-service gọi user-service với tốc độ cao hơn Feign/REST trong giao tiếp nội bộ giữa các microservice."
pubDate: 2025-08-08
category: "Microservices"
image: "/images/microservices/bai-9.png"
---

![ Tích hợp gRPC ](/images/microservices/bai-9.png)

## Mục tiêu

Chuyển từ:

> `order-service` gọi `user-service` qua **Feign + HTTP REST**

sang:

> `order-service` gọi `user-service` qua **gRPC** để lấy `UserDto` theo `userId`

---

## 1. Các bước thực hiện

### 1. Tạo file `user.proto`

Tạo tại:

```text
user-service/src/main/proto/user.proto
```

```proto
syntax = "proto3";

option java_multiple_files = true;
option java_package = "com.example.userservice.grpc";
option java_outer_classname = "UserProto";

service UserGrpcService {
  rpc GetUserById (GetUserRequest) returns (UserResponse);
}

message GetUserRequest {
  int64 userId = 1;
}

message UserResponse {
  int64 id = 1;
  string name = 2;
  string email = 3;
}
```

### 2. Cấu hình Gradle cho `user-service`

#### `user-service/build.gradle`

```gradle
plugins {
    id 'java'
    id 'com.google.protobuf' version '0.9.4'
}

dependencies {
    implementation 'net.devh:grpc-server-spring-boot-starter:2.15.0.RELEASE'
    implementation 'net.devh:grpc-client-spring-boot-starter:2.15.0.RELEASE'

    implementation 'io.grpc:grpc-core:1.54.0'
    implementation 'io.grpc:grpc-netty-shaded:1.54.0'
    implementation 'io.grpc:grpc-protobuf:1.54.0'
    implementation 'io.grpc:grpc-stub:1.54.0'

    implementation 'javax.annotation:javax.annotation-api:1.3.2'
}

protobuf {
    protoc {
        artifact = "com.google.protobuf:protoc:3.25.3"
    }
    plugins {
        grpc {
            artifact = "io.grpc:protoc-gen-grpc-java:1.64.0"
        }
    }
    generateProtoTasks {
        all().each { task ->
            task.plugins {
                grpc {}
            }
        }
    }
}
```

### 3. Cài đặt gRPC server ở `user-service`

Tạo class `UserGrpcServiceImpl`

```java
import com.example.userservice.model.User;
import com.example.userservice.repository.UserRepository;
import io.grpc.stub.StreamObserver;
import lombok.RequiredArgsConstructor;
import net.devh.boot.grpc.server.service.GrpcService;

@GrpcService
@RequiredArgsConstructor
public class UserGrpcServiceImpl extends UserGrpcServiceGrpc.UserGrpcServiceImplBase {

    private final UserRepository userRepository;

    @Override
    public void getUserById(GetUserRequest request, StreamObserver<UserResponse> responseObserver) {
        User user = userRepository.findById(request.getUserId())
                .orElseThrow(() -> new RuntimeException("User not found"));

        UserResponse response = UserResponse.newBuilder()
                .setId(user.getId())
                .setName(user.getName())
                .setEmail(user.getEmail())
                .build();

        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }
}
```

### 4. Cấu hình gRPC client tại `order-service`

#### `order-service/build.gradle`

```gradle
plugins {
    id 'java'
    id 'com.google.protobuf' version '0.9.4'
}

dependencies {
    implementation 'net.devh:grpc-client-spring-boot-starter:2.15.0.RELEASE'

    implementation 'io.grpc:grpc-core:1.54.0'
    implementation 'io.grpc:grpc-netty-shaded:1.54.0'
    implementation 'io.grpc:grpc-protobuf:1.54.0'
    implementation 'io.grpc:grpc-stub:1.54.0'

    implementation 'javax.annotation:javax.annotation-api:1.3.2'
}

protobuf {
    protoc {
        artifact = "com.google.protobuf:protoc:3.25.3"
    }
    plugins {
        grpc {
            artifact = "io.grpc:protoc-gen-grpc-java:1.64.0"
        }
    }
    generateProtoTasks {
        all().each { task ->
            task.builtins {
                java {}
            }
            task.plugins {
                grpc {}
            }
        }
    }
}
```

Copy file `user.proto` giống bên `user-service` vào:

```text
order-service/src/main/proto/user.proto
```

Nhớ đổi package name nếu cần.

### 5. Cấu hình `application.yml`

#### `user-service`

```yaml
grpc:
  server:
    port: 9090
```

#### `order-service`

```yaml
grpc:
  client:
    user-service:
      address: static://localhost:9090
      negotiationType: plaintext
```

### 6. Tạo gRPC client trong `order-service`

```java
import net.devh.boot.grpc.client.inject.GrpcClient;
import org.springframework.stereotype.Service;

@Service
public class GrpcUserClient {

    @GrpcClient("user-service")
    private UserGrpcServiceGrpc.UserGrpcServiceBlockingStub userStub;

    public UserResponse getUserById(Long id) {
        GetUserRequest request = GetUserRequest.newBuilder().setUserId(id).build();
        return userStub.getUserById(request);
    }
}
```

### 7. Gọi gRPC thay cho Feign trong `OrderController`

```java
private final GrpcUserClient grpcUserClient;

@GetMapping("/grpc/{id}")
public OrderResponse getOrderGrpc(@PathVariable Long id) {
    Order order = orderRepository.findById(id).orElseThrow();

    UserResponse user = grpcUserClient.getUserById(order.getUserId());

    UserDto userDto = new UserDto(user.getId(), user.getName(), user.getEmail());
    return new OrderResponse(order.getId(), order.getProduct(), order.getPrice(), userDto);
}
```

---

## 2. Test

### Gọi API để lấy order + user

```text
http://localhost:8082/api/orders/grpc/1
```

Kết quả:

```json
{
  "orderId": 1,
  "product": "Macbook Pro",
  "price": 2500.0,
  "user": {
    "id": 1,
    "name": "user1",
    "email": "holyne@gmail.com"
  }
}
```

## 3. Tổng kết flow gRPC

Đây là luồng khi client gọi đến gRPC server để lấy thông tin user:

```text
Client gọi getUserById(id)
    ↓
gRPC server nhận request (GetUserRequest)
    ↓
Tìm trong DB (userRepository.findById)
    ↓
Tạo response (UserResponse)
    ↓
Gửi lại cho client (onNext + onCompleted)
```

### Tóm tắt flow gRPC giữa 2 service

1. `order-service` gọi `GrpcUserClient.getUserById(id)`
2. Tạo `GetUserRequest`
3. Gửi RPC request đến `user-service`
4. `user-service` xử lý trong `UserGrpcServiceImpl`
5. Trả về `UserResponse`
6. `order-service` nhận kết quả

---

## 4. Ưu điểm của gRPC trong trường hợp này

* gọi hàm từ xa gần giống như gọi local method
* truyền data hiệu quả hơn vì dùng binary protocol
* type-safe rõ ràng với `UserResponse`, `GetUserRequest`

## 5. So sánh Feign vs gRPC trong hệ thống của bạn

| Tiêu chí | Feign (REST) | gRPC |
| --- | --- | --- |
| Tốc độ | Trung bình (JSON, HTTP/1.1) | Nhanh hơn (Protocol Buffers, HTTP/2) |
| Tự động sinh mã | Không, viết interface thủ công | Có, sinh từ `.proto` |
| Kết nối service | Dễ dùng | Phức tạp hơn nhưng tối ưu |
| Gỡ lỗi | Dễ vì nhìn thấy JSON | Khó hơn, cần tool riêng |
| Phù hợp | Giao tiếp với client/web | Giao tiếp service nội bộ tốc độ cao |

---

## 6. Gợi ý nâng cao

* tách `proto/` thành module dùng chung như `common-proto`
* dùng protobuf plugin caching để tránh build lại toàn bộ mỗi lần
