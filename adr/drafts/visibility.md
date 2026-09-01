# Visibility Modifiers in Clawr

There are no visibility modifiers. Well, okay there is one: `helper`.

## Sane Visibility by Default

All types are public by default. All `data` fields are public as the purpose of a data structure is to expose data. Enum cases must be public if the `enum` itself is; there cannot be private values that are only known to a few. The same is true for `union` types: if you can reference a `union`, you must be able to access all its variants.

Encapsulated types (`object` and `service`) hide their data. Their fields are always hidden from code that isn't the type itself (or its `companion` object). All methods, on the other hand, are publicly visible by default.

## Hide Code by Marking it as `helper`

There is no way to make a hidden member visible other than indirectly. You can always define a new method that returns the value of a private field. But that is just what encapsulation does already — just indirectly.

You cannot increase visibility, but you can hide what would otherwise be visible. When tagged as a `helper`…

- A **method** is visible only to its parent `object` or `service`.
- A **type** is visible to the entire package/library it is defined in, but not to users of the library.
- A **free function** (not a method) is visible to the package/library, but not where it is imported.

## Examples

### Helper Methods (Type-Scoped)

```clawr
// user.clawr
object User {
    // Public API
    func setEmail(email: EmailAddress) {
        guard self.validateEmailFormat(email) or return
        self.email = email
    }
    
    func name() -> string => self.name
    
    // Private to User type
    helper func validateEmailFormat(email: EmailAddress) -> boolean {
        return email.value().matches(/.+@.+\..+/)
    }
    
    helper func computeHashKey() -> string {
        return "\(self.id):\(self.version)"
    }

data:
    id: EntityId
    name: string
    email: EmailAddress
    version: integer
}

// Cannot call from outside User
func example() {
    const user = User.new(...)
    user.setEmail(...)           // ✓ OK: public method
    user.validateEmailFormat()   // ❌ ERROR: helper method
}
```

### Helper Free Functions (Package-Scoped)

```clawr
// authentication.clawr

// Public API
func login(username: string, password: string) -> Session | AuthError {
    const hash = computePasswordHash(password)
    // ...
}

// Package-internal utility
helper func computePasswordHash(password: string) -> string {
    // Implementation...
}

helper func validatePasswordStrength(password: string) -> boolean {
    // Implementation...
}
```

```clawr
// user_repository.clawr (same package)

func saveUser(user: User, password: string) {
    // Can use helper functions from same package
    const hash = computePasswordHash(password)  // ✓ OK
    // ...
}
```

```clawr
// external package importing authentication

import authentication

func externalCode() {
    authentication.login(...)              // ✓ OK: public
    authentication.computePasswordHash()   // ❌ ERROR: helper
}
```

### Helper Types (Package-Scoped)

```clawr
// email_validation.clawr

// Public type
data EmailAddress {
    value: string
}

// Package-internal type
helper data EmailParts {
    localPart: string
    domain: string
}

// Public API
func validateEmail(input: string) -> EmailAddress | InvalidEmail {
    const parts = EmailParts.parse(input)  // Uses helper type internally
    // ...
}
```

```clawr
// user.clawr (same package)

func parseUserEmail(input: string) -> EmailAddress {
    // Can use helper types from same package
    const parts = EmailParts.parse(input)  // ✓ OK
    // ...
}
```

```clawr
// external package

import email_validation

func external() {
    const email = validateEmail(input)  // ✓ OK: public function and type
    const parts = EmailParts.parse()    // ❌ ERROR: helper type not visible
}
```

### Helper Services

```clawr
// cache.clawr

// Public cache service
service UserCache {
    func get(userId: EntityId) -> ref User? {
        return self.storage.lookup(userId)
    }

data:
    storage: ref CacheStorage
}

// Internal implementation detail
helper service CacheStorage {
    func lookup(key: EntityId) -> ref User? {
        // Implementation...
    }
    
    func evict(key: EntityId) {
        // Implementation...
    }

data:
    entries: Dictionary<EntityId, ref User>
    evictionPolicy: ref EvictionPolicy
}
```

### Real-World Example: Event Store

```clawr
// entity_store.clawr

// Public API
service EntityStore {
    async func reconstitute<TEntity: Entity>(id: TypedEntityId) 
        -> TEntity | EntityNotFound {
        
        const history = await self.loadHistory(id)
            or return entityNotFound(id)
        
        return TEntity.reconstituted(
            id.entityId, 
            at: history.version, 
            from: history.events
        )
    }
    
    // Private helper method
    helper func loadHistory(id: TypedEntityId) async 
        -> (PersistedEntityVersion, [PublishedEvent])? {
        
        return await self.repository.query(
            "SELECT version, events FROM entities WHERE id = ?",
            id.entityId
        )
    }

data:
    repository: ref Repository
}

// Package-internal type for optimization
helper data EntityHistory {
    version: PersistedEntityVersion
    events: [PublishedEvent]
    cachedAt: DateTime
}

// Package-internal caching layer
helper service HistoryCache {
    func get(id: EntityId) -> EntityHistory? {
        return self.cache[id]
    }
    
    func set(id: EntityId, history: EntityHistory) {
        self.cache[id] = history
    }

data:
    cache: Dictionary<EntityId, EntityHistory>
}
```

## Summary

| Declaration                          | Scope              | Visible To                            |
| ------------------------------------ | ------------------ | ------------------------------------- |
| `object` / `service` / `data`        | Package + external | Everyone who imports the package      |
| Method (no keyword)                  | Package + external | All code that can see the parent type |
| `helper` method                      | Type only          | Only the parent `object` or `service` |
| Free function (no keyword)           | Package + external | Everyone who imports the package      |
| `helper` free function               | Package only       | Only code in the same package         |
| `helper object` / `service` / `data` | Package only       | Only code in the same package         |

**Key insight:** The `helper` keyword means "implementation detail" - the scope depends on what kind of thing it marks, but the intent is always the same: this is not part of the public API.
