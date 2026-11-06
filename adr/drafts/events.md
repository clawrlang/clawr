&nbsp; / &nbsp; [Architecture Decision Records](../README.md) &nbsp; / &nbsp; [ADR Sketches](./README.md)

# Events

> Status: 🗳️ Idea

## Context

In Clawr, an `object` is limited to mutate only its own internal state. It is not allowed to perform actions that affect the runtime environment. Only `service` instances may do that.

But sometimes an `object` may need to signal that something of interest has occurred, without directly performing an action that affects the runtime environment. Other languages suggest mechanisms for this.

C# uses the `event` keyword to define events that objects can raise to signal that something has occurred. Other parts of the program can subscribe to these events using delegates, allowing for a decoupled way to react to changes without directly invoking actions on the runtime environment. The `event`keyword is allowed in `struct` types, even though `struct` instances are value types and have different semantics compared to reference types. It is not a recommended use, but allowed. The question is what the point of a `struct` event is, given the value semantics and the potential for unexpected behavior when the `struct` is copied.

Objective C uses the `NSNotification` mechanism to broadcast events. Objects can post notifications to a central notification center, and other objects can register to receive these notifications. This allows for a decoupled communication pattern where objects can react to events without directly invoking methods on each other. But it introduces a global dependency on the notification center, which can make reasoning about the flow of events more challenging.

Apple storyboards use a concept called target-action. In this pattern, a control (such as a button) can be linked to a target object and an action method. When the control is interacted with, it sends a message to the target object to invoke the specified action. This allows for a decoupled way to handle user interactions without the control directly performing actions on the runtime environment.

These examples illustrate different ways that programming languages and frameworks allow objects to signal events without directly performing actions on the runtime environment. Clawr can adopt a similar mechanism to enable `object` instances to communicate occurrences of interest in a decoupled manner.

### Event Sourcing

There is also a concept from DDD called event sourcing. Event sourcing is a pattern where state changes of an entity are captured as a sequence of events. Instead of storing the current state directly, the system stores the events that led to the current state. This allows for reconstructing the state by replaying the events, providing a complete audit trail and enabling features like event replay and temporal queries.

Event sourcing as such is not directly about decoupled event handling, and should not be conflated with it, but it provides a way to persist and replay events that represent state changes. This can complement the event mechanism in Clawr by allowing objects to emit events that are recorded and can later be used to reconstruct the state or trigger additional processing.

---

> [!question] AI Prompt
>
> I am designing my own language. Types can be used for either reference semantics _or_ value semantics depending on the variable declaration. An `object` type is not allowed to interact with the environment. But I realise that a domain model might need to notify state changes to services that _can_ interact with databases ot the internet.
>
> One idea was to borrow the `event` keyword from C#. Another was Apple's `NSNotificationCenter`. If there is a special syntax for sending events, then that could be a disciplined workaround to the `object` constraint. But since the type could be used in isolated / value-semantics mode, it would still be problematic.
>
> Maybe I should _not_ allow any kind of events at all on `object` types, but require the programmer to instead define a `service` if they need events?

Your instinct is correct: **don't put events on `object` types — require a `service` for anything event-like.** This isn't a workaround; it falls directly out of the definitions in ADR-008, and it sidesteps the exact failure mode we discussed with C# structs.

## Why events don't belong on `object`

Three independent arguments all point the same way:

**1. Events are environment interaction.** ADR-008 defines `object` as explicitly forbidden from touching the environment: _"It is not allowed to access the internet, open files or read sensors. Or to otherwise access the environment it operates in."_ An event's entire purpose is to notify _other components_ — that's cross-boundary communication, which is the definition of environment interaction in your model. A multicast delegate is a subscription list of foreign callbacks. That's not internal state.

**2. Events require shared mutable subscription state.** If an `object` is used as `mut` (isolated), the subscription list is part of the isolated value. Outside code cannot subscribe without mutating the isolated value (breaking isolation), and if it subscribes through a copy, the subscription is lost — the exact C# struct problem. If the subscription list lives in a `ref` property, then it isn't the object's state at all; it's shared state, which by ADR-008's own logic belongs in a `service`.

**3. It would re-introduce the type-level semantics you deliberately rejected.** Allowing `event` on `object` means either (a) the type becomes unusable in `ISOLATED` mode, which violates ADR-002's "a single type can be used in both isolation and sharing contexts," or (b) you need a variable-level access restriction (`ref obj.Event += h` legal, `mut obj.Event += h` illegal), which is a new, subtle rule that exists only to paper over a design mismatch. Both are worse than the alternative.

## What to do instead — it's already in ADR-008

ADR-008 already gives you the mechanism:

> "An `object` can store references to `service` instances in its `ref` properties, allowing it to propagate events and decouple components from the environment."

So the pattern is:

```clawr
service EventBus {
    fn publish(evt: ref EventData)
    fn subscribe(evtType, handler)
}

object Order {
    ref bus: EventBus          // ADR-008 explicitly permits this
    mut state: OrderState

    fn submit() {
        state = Submitted
        bus.publish(OrderSubmitted(orderId: id))   // payload is a `data` type
    }
}
```

The `object` has a direct method call on a service — no special event syntax needed. The service owns the subscription list, the dispatch, and any concurrency. This is exactly the mediator/notification-center pattern, and it composes with your isolation rules because the service is always `ref`.

Two details that matter for correctness:

- **The event payload should be a `data` type** (or an immutable snapshot). Do _not_ pass `ref this` to the service. If the service retains a reference to an isolated `object`, that object is no longer isolated — you've violated ADR-002's isolation guarantee. Publishing a `data` payload that gets copied into the event bus keeps the isolation boundary intact.
- **This also answers your open question in ADR-008.** A service referenced by an `object` can safely start concurrent operations _provided_ it never retains a reference to the isolated `object` and only receives copied/immutable payloads. The isolation rule then reduces to a simple discipline: "services may receive values and return values, but must not capture isolated callers." That's a tractable rule to enforce.

## The lightweight alternative: constructor callbacks

If a domain model needs to notify _within_ a bounded context without the ceremony of a bus, use a function parameter captured at construction:

```clawr
object Order {
    mut state: OrderState
    onSubmit: fn(OrderSnapshot) -> void   // set once, immutable reference

    fn submit() {
        state = Submitted
        onSubmit(snapshot())
    }
}
```

This works cleanly with value semantics because the callback _reference_ is just a pointer — it copies with the value for free, and the callback itself is immutable. It's not a multicast event (no dynamic subscribe/unsubscribe), but for many domain-model notifications that's sufficient, and it preserves isolation perfectly. If you need multicast or post-construction subscription, that's precisely the signal that the coordination belongs in a `service`.

## What I'd avoid

- **A `event` keyword on `object` with variable-level access rules** (`ref`-only). It's technically expressible, but it adds a rule that exists only to reconcile two things your ADRs deliberately kept separate. It also invites users to put events on objects and then wonder why their `mut` values behave strangely — the same confusion C# users hit with structs.
- **NSNotificationCenter-style global registry.** It's a `service` with extra steps, and it hides the dependency in a global. Keeping the bus as an explicit `ref` property on the object keeps the dependency visible at the type level, which is consistent with your "clarity at the point of declaration" rationale in ADR-002.

So: keep `object` free of events, let `service` own notification, and pass `data` payloads across the isolation boundary. This is the one design in your ADR set where the separation you already drew does all the work — you don't need a new keyword at all.
