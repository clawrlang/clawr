# Return Values are _Moved_

Functions return “uniquely referenced” values by default. Uniquely referenced values can be assigned reference semantics _or_ copy semantics as needed. The first variable it is assigned to will determine the semantics for the allocated memory. After that it cannot be reassigned to a conflicting semantics variable without explicit copying.

When a function returns a value, that memory is “moved.” That means that if the function does `return x` it will not `release(x)` (but it will release all other variables in its scope). The receiving variable will not call `retain()` on the returned value, but will just take over the reference from `x`.

If there are multiple other variables that refer to `x` (and they are not descoped), the value cannot be returned as “unique.” So the semantics must be explicit in the function signature and the receiver will have to `copy()` the value if the receiver semantics doesn't match.

## Instantiation Model

Object values are created by named functions, not implicit constructors. These functions are either:

- free functions in the same module,
- or companion methods on the same type.

Without inheritance, a factory usually returns an object literal directly, or assigns it to a local variable, calls helper methods, and then returns that variable.

With inheritance, the supertype may define an `inheritance:` section. Functions in `inheritance:` are special initializers used from subtype object literal setup.

`inheritance:` initializers may:

- return a literal directly, or
- assign a literal to `self` first and then run post-initialization logic.

Ordering constraint:

- A helper method may not be called before `self` has been fully initialized via `self = { ... }` (or equivalent full initialization path).

## Example — Inheritance

```clawr
// The `Entity` type is abstract. It does not define any factory methods and
// can therefore not be directly initialised. It does, however define an
// `inheritance:` section that allows subtypes to be.

object Entity {

  // These first methods are non-mutating, so they will never trigger
  // copy-on-write, and they can be called from `const` variables.

  func id() => .id
  func reconstitutedVersion() => .version
  func unpublishedEvents() => copy .unpublishedEvents

inheritance:

  // The “inheritance” section opens the type for inheritance.
  // this section defines initializers that are used by inheriting
  // types.

  // Initializers do not trigger copy-on-write because the reference
  // count is always 1 when they are called.

  func new(id: EntityId) => { id, version: .new }

  func reconstitute(_ id: Entityid, version: EntityVersion, replaying events: [PublishedEvent]) {

    // This method has post-initialization code. All the fields must
    // be initialized before that is allowed. That is done by assigning
    // a literal to the special variable `self`.
    self = { id: id, version: version }

    // NOTE: Assigning to `self` does not allocate a new instance. The
    // encapsulated `data` has already been allocated in memory before
    // the factory-method starts executing. The literal assigned to `self`
    // represents the initialization of that `data`, and it needs to define
    // all the fields before it can run post-initialization code.

    // NOTE: The semantics of `self` (copy or reference) is irrelevant
    // during setup. The reference count will always be one until the
    // initialiser returns. And then the allocated memory will be “moved”
    // to the receiving variable.

    // `self` is assumed to be completely set up after the literal
    // assignment. It should be safe to call methods. That means that
    // all sub-type fields must also have been initialized before calling
    // this factory method.
    //
    // Helper and mutating helper calls are forbidden before `self` is
    // initialized. After initialization, they are allowed.
    for event in events {
      // Call methods on the sub-type to restore state information
      // corresponding to the events.
      // Calling mutating methods from this context is safe as
      // the object will not have multiple referents.
      replay(event: event)
    }
  }

mutating:

  // These methods are mutating and unavailable to `const` variables.
  // They will trigger copy-on-write before being executed.

  func add(event: UnpublishedEvent) { unpublishedEvents.add(event) }
  func abstract replay(event: PublishedEvent)

data:

  const id: EntityId
  const version: EntityVersion
  mut unpublishedEvents: [UnpublishedEvent]
}
```

### Subclassing

```clawr
object Student: Entity {

  func name() => name
  func isEnrolled(in course: Course) => enrolledCourses.contains(course)

mutating:

  func enroll(course: Course) {
    add(event(for: course))
  }

  override func replay(event: PublishedEvent) { ... }

data:

  name: string
  enrolledCourses: Set<Course> = []
}

namespace Student {

  // As `Student` does not define `inheritance:` initializers,
  // it cannot be inherited.
  // Instead, it can define “constructors” as ordinary functions.

  func reconstitute(id: EntityId, version: EntityVersion, replaying events: [Event]) => {
    Entity.reconstitute(id, version: version)
    name: name
  }

  // Return type is Student without decoration. It must return a “unique”
  // instance that is safe to assign semantics that fits the receiver
  func new(id: EntityId, name: string) -> Student {
  // All the fields will be assigned first. Then the super factory method
  // will be called and set up the fields of the super-type. And that in
  // turn will call back to methods on this type.

  // This value is ISOLATED while local.
  mut student = {
    Entity.new(id: id)
      name: name
    }

    // This variable would add one to the reference count
    // But that is decremented again when the function exits
    // const otherRef = student // Allowed

    // If this value is returned as `-> Student`, the receiver can choose
    // either local (`const`/`mut`) or `ref` semantics.
    // ref sharedSelf = student // Allowed only when semantics conversion
    // is legal and unique ownership is preserved at handoff.

    student.add(event(for: course))

    // When returned, `student` becomes a *unique* instance and its
    // semantics can be changed to match the caller.
    return student
  }
}

const student1 = Student.new("Emil")
ref student2 = Student.new("Emilia")
```

## Rules

1. `-> Type` conceptually returns a uniquely referenced value in a temporary _unbound_ state (neither local/COW nor shared/ref yet).
2. At runtime the value still has to carry a concrete RC flag bit (`__rc_ISOLATED` or `__rc_SHARED`). `__rc_ISOLATED` is the default representation for this unbound unique return.
3. The receiver of `-> Type` decides the final semantics at handoff: local (`const`/`mut`) or `ref`, as long as conversion is legal (`refs == 1`).
4. If a unique return value is passed as a function argument before variable binding, `__rc_ISOLATED` remains the default concrete runtime representation.
5. `-> const Type` returns COW-compatible/shared semantics and may have `refs > 1`.
6. `-> ref Type` returns shared reference semantics directly.
7. If a function cannot prove uniqueness at return, it must declare fixed return semantics (`const` or `ref`).

```clawr
func returnsRef() -> ref Student // SHARED memory
func returnsCOW() -> const Student // COW/shared-compatible memory
func returnsUnique() -> Student  // conceptually unbound unique; runtime defaults to ISOLATED until bound
```

## Default Constructors

Most OO languages allow classes with implicit, no-argument, constructors. This does not exist in Clawr. You will always have to define a public-facing method/initialiser for clients to invoke. It needs to have a name to refer to, just `TypeName()` is not a syntactically valid initialisation. (It would be interpreted as a function call, not a constructor invocation.)

An `abstract` type, however, is never instantiated directly. It doesn't need to expose a method for construction as long as its “concrete” inheritors do. And those inheritors do not necessarily need to invoke an explicit `super` function; they can just return a literal defining field values.

If the abstract type does not have any fields (or all its fields have default values) it might be okay not to define an explicit initialiser for it.

## Destructors

No `object` type will ever need a destructor. They are not allowed to touch the world outside their own memory allocation. There is nothing to clean up beyond `free(self)`.

A `service` might need a destructor. It might e.g. represent a file handle that needs to be closed.
