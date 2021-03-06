## VERSIONS


### 2.3.0
- Sync version with other packages.
- `@payload()` can automatically infer model class from param type.
- `MediateRpcCaller` and `MediateRpcHandler` no longer share same connector.

## 0.3.1
- Added parameters decorators for action methods.
- Upgraded to new version of `@micro-fleet/common` with breaking change.
- Added `callImpatient` and supports raw destination.

## 0.3.0
- Added `DefaultDirectRpcHandlerAddOn` which automatically registers classes decorated with `@directController()`
- Added `DefaultMediateRpcHandlerAddOn` which automatically registers classes decorated with `@mediateController()`

## 0.2.4
- Remove script "postinstall" from `package.json`.

## 0.2.3
- Upgraded dependencies.
- Improved lint rules.

## 0.2.2
- Moved `global` types to `global.gennova`.

## 0.2.1
- Decorated **MediateRpcHandlerAddOnBase**, **DirectRpcHandlerAddOnBase** with `@unmanaged` annotation.

### 0.2.0
- Moved **MessageBrokerAddOn**, **DirectRpcHandlerAddOnBase** and **MediateRpcHandlerAddOnBase** from `back-lib-foundation`.
- RPC Handlers have module name and service name.
- RPC Callers rebuild exception object received from handlers.
- Test coverage: 85%

### 0.1.0
- *HttpRpcCaller*: Makes direct RPC calls via HTTP to an *ExpressRpcHandler* endpoint.
- *ExpressRpcHandler*: Listens and handles requests from *HttpRpcCaller*.
- *MessageBrokerRpcCaller*: Sends RPC requests to message broker and waits for response.
- *MessageBrokerRpcHandler*: Listens and handles requests from message broker.
- *TopicMessageBrokerConnector*: Underlying class that supports *MessageBrokerRpcCaller* and *MessageBrokerRpcHandler* to connect to RabbitMQ message broker.