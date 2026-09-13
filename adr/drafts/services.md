# External Access Only Through `service`

Is it possible to require all external access to be in the shape of a `service`?

Clawr would provide primitive services like `FileHandle`.

---

> [!question] AI Prompt
>
> Here are my ADRs for my language, and drafts for new ideas. The drafts are perhaps mostly there to avoid bloating my TODO lists.
>
> I was thinking: is it possible to require all external access to be funnelled through `service` objects? Not free functions. (Maybe a free function could be allowed to instantiate a `service` and call its methods, but that can be detected and make that function off-limits to `object` methods.)
>
> I would need to create services for every external operation. For example `FileHandle` would be a `service` type. And the internet — or network access in general? — is another `service` etc.
>
> Is this reasonable? Would it be a problem for creating new services — e.g. sensors? Could it be that if there is no existing service to rely upon, then implementing access to the sensor might be impossible? What primitives would I need to create in order to support the creation of new service?

Yes — this is coherent, and it fits your existing ADRs (especially ADR-008). What you are describing is essentially a **capability/effect discipline**: `service` is the only kind of type allowed to hold ambient authority, and only `service` methods (plus `@main`) may actually exercise it.

But you cannot make it closed without a bootstrap. If every external access must go through a `service`, then something must be allowed to create the first `service` that touches the outside world. That is the chicken-and-egg problem. The answer is a small, trusted, platform-specific **native/primitive service layer**.

## The rule you want

A strict version would be:

- `data`: no methods, no external access.
- `object`: pure methods only; no service fields, no service parameters, no `async`, no I/O.
- `pure func`: no service parameters, no `extern`, no I/O.
- `service`: may hold service references, may call native/extern primitives, may be `async`.
- `@main`: special; may instantiate root services and call them.
- `companion` of a `service`: effectful; may acquire resources.
- `companion` of an `object`: pure; may not acquire resources.
- `trait`: pure structural interface; any type may conform.
- `role`: capability/effectful interface; only `service` types should embody it. An in-memory implementation can still be a `service` that happens to use no external resources.

This means an `object` cannot call a `service`. A pure free function cannot call a `service`. Only `service` methods and `@main` can. That is very clean, and it matches the “object cannot access the environment” rule in ADR-008.

If you want effectful free functions, you need effect annotations, e.g. `@effects(io)`, and then `object` methods must be forbidden from calling them. That is more flexible, but more machinery. The strict version avoids the need for a full effect system at first.

## The bootstrap problem

You need a trusted native layer. Something like:

```clawr
native service FileSystem {
    extern func open(path: string, flags: OpenFlags) -> FileHandle | IoError
}

native service Device {
    extern func ioctl(fd: integer, request: integer, arg: integer) -> integer | IoError
    extern func mmap(addr: integer, length: integer, prot: integer) -> MemoryMap | IoError
}

native service Syscall {
    extern func syscall(number: integer, args: [integer]) -> integer
}
```

Only `native service` (or a package marked `trusted`/`unsafe`) should be allowed to declare `extern`, `@intrinsic`, `@syscall`, `@mmap`, etc. Normal `service` types are built on top of these capabilities.

Then a normal service looks like:

```clawr
service TemperatureSensor {
    companion func new(bus: ref I2CBus, addr: integer) -> TemperatureSensor {
        return { bus: bus, addr: addr }
    }

    func celsius() -> real | IoError {
        const raw = self.bus.read(self.addr, 0x10)?
        return raw as real / 100.0
    }

data:
    bus: ref I2CBus
    addr: integer
}
```

And `I2CBus` would be either:

- a `native service` if the OS/runtime exposes I²C directly, or
- a normal `service` built on `FileHandle`/`Device`/`Syscall` if the OS exposes it through `/dev`, sysfs, ioctl, mmap, etc.

If no such primitive exists, then yes: implementing that sensor service in pure Clawr is impossible. You must add a new native/primitive service, or link against a native library. The language cannot create hardware access ex nihilo.

## Primitives you would need

At minimum, a useful bootstrap layer usually needs:

- `FileSystem` / `FileHandle`: open, close, read, write, seek, stat, unlink.
- `Device`: ioctl, mmap, read/write registers.
- `MemoryMap`: map, unmap, volatile read/write.
- `Syscall`: raw syscall escape hatch for trusted code.
- `Network`: socket, bind, listen, accept, connect, send, recv.
- `Clock`: monotonic time, sleep, timers.
- `Random`: entropy source.
- `Process`: spawn, wait, kill, pipe.
- `Thread` / async runtime: spawn, join, mutex, atomic, channel.
- `Capability` handle types: opaque `FileDescriptor`, `SocketHandle`, `DeviceHandle`, `MemoryMap`.
- `deinit` / `destruct`: so services like `FileHandle` can close on release. Your draft already has this.
- Error mapping: OS errors to Clawr errors.
- CIR support: at least mark `service` and `native`/`extern` in the CIR. If you allow effectful free functions, add effect metadata to function signatures.

## Granularity

Avoid god services. Prefer:

- `FileSystem` service for global file operations.
- `FileHandle` service per open file.
- `Network` service for socket creation.
- `Socket` service per connection.
- `SensorBus` service for the bus.
- `TemperatureSensor` service per device.

This makes disposal, capability scoping, and testing much easier.

## Is it reasonable?

Yes, but it is strict. It will push you toward hexagonal/clean architecture:

- Pure domain logic in `data`, `object`, and pure free functions.
- Orchestration and I/O in `service` types.
- Platform access in a small `native service` kernel.

The main costs are:

- More boilerplate: you need services for logging, time, random, files, network, etc.
- Bootstrapping complexity: you need a trusted native layer.
- Async/thread effects must be part of the service boundary.
- You must decide whether normal services can call `extern` directly, or only `native services` can. The latter is safer.

The main benefits are:

- Very testable: replace services with in-memory implementations.
- Clear effect boundary: `object` code is pure.
- Platform agnostic: platform-specific code is confined to `native service` packages.
- Security: services can be capability-scoped rather than ambient-authority-scoped.

So: yes, require all external access to go through `service` objects. But add a `native service` / `extern` / `unsafe` bootstrap layer. Without that, you cannot create the first service, and sensors or new hardware would be impossible to support.
