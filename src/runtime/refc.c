#include "refc.h"
#include "panic.h"
#include <string.h>
#include <unistd.h>

// ----------
// ALLOCATION
// ----------

__attribute__((visibility("default")))
void* _alloc_init_rc_structure(const __type_info* const type, size_t extendedSize, refs_t semantics, const void* initData, size_t initSize, size_t initOffset) {
    __rc_header* const structure = malloc(type->data_type.size + extendedSize);
    if (!structure) panic("Error: Out Of Memory");

    memcpy(structure, &(__rc_header){
        .is_a = type, // const pointer assignment
        .allocation_size = type->data_type.size + extendedSize,
        .refs = semantics | 1,
        .proxy = NULL,
    }, sizeof(__rc_header));
    memcpy((char*)structure + initOffset, initData, initSize);
    return structure;
}

// ------
// RETAIN
// ------

__attribute__((visibility("default")))
void* retainRC(void* const structure) {
    if (!structure) return NULL;

    atomic_fetch_add_explicit(&RC_HEADER(structure)->refs, 1, memory_order_relaxed);
    return structure;
}

// -------
// RELEASE
// -------

__attribute__((visibility("default")))
void* _release_rc_structure(void* const structure) {
    if (!structure) return NULL;
    __rc_header* const header = RC_HEADER(structure);

    const refs_t prevRefs = atomic_fetch_sub_explicit(&header->refs, 1, memory_order_acq_rel) & __rc_REFC_BITMASK;
    if (prevRefs == 1) {
        __rc_proxy* const proxy = atomic_load_explicit(&header->proxy, memory_order_acquire);
        if (proxy) {
            // Publish entity teardown to weak readers
            proxy->target = NULL;
            _release_proxy(proxy);
        }
        void (*releaseNested)(void* self) = header->is_a->data_type.release_nested_fields;
        if (releaseNested) releaseNested(structure);
        free(structure);
    }
    return NULL;
}

// --------
// SHARE
// --------

__attribute__((visibility("default")))
void* shareRC(void* const structure) {
    __rc_header* const header = RC_HEADER(structure);
    atomic_fetch_or_explicit(&header->refs, __rc_SHARED, memory_order_acquire);
    return structure;
}

// ---------------
// MUTATE AND COPY
// ---------------

void* _performCopying(void* const structure, refs_t const semantics) {
    __rc_header* const header = RC_HEADER(structure);

    // Clone structure to new allocation
    __rc_header* const clone = malloc(header->allocation_size);
    memcpy(clone, structure, header->allocation_size);
    // New allocation has one reference regardless of the original.
    atomic_init(&clone->refs, semantics | 1);

    void (*retainNested)(void* self) = header->is_a->data_type.retain_nested_fields;
    if (retainNested) retainNested(structure);

    // Finished copying; unset the flag.
    atomic_fetch_and_explicit(&header->refs, ~__rc_COPYING_FLAG, memory_order_acquire);
    return clone;
}

__attribute__((visibility("default")))
void* _mutateRC(void* const structure) {
    __rc_header* const header = RC_HEADER(structure);
    // No copying needed if SHARED
    // But what if it is being copied (explicit copy)? It should not be possible to change then, should it?
    if ((header->refs & __rc_SEMANTICS_FLAG) == __rc_SHARED) return structure;

    // Flag that copying is in progress.
    const refs_t refs = atomic_fetch_or_explicit(&header->refs, __rc_COPYING_FLAG, memory_order_acquire);

    if (refs & __rc_COPYING_FLAG) {
        // Copy is in progress elsewhere. Wait and try later.
        usleep(10);
        return _mutateRC(structure);
    } else if ((refs & __rc_REFC_BITMASK) == 1) {
        // Unique reference. No copy needed. Restore flag.
        atomic_fetch_and_explicit(&header->refs, ~__rc_COPYING_FLAG, memory_order_acquire);
        return structure;
    }

    void* clone = _performCopying(structure, __rc_ISOLATED);
    // Release reference to original.
    _release_rc_structure(structure);
    return clone;
}

__attribute__((visibility("default")))
void* copyRC(void* const structure, refs_t const semantics) {
    __rc_header* const header = RC_HEADER(structure);
    // Flag that copying is in progress.
    const refs_t refs = atomic_fetch_or_explicit(&header->refs, __rc_COPYING_FLAG, memory_order_acquire);

    if (refs & __rc_COPYING_FLAG) {
        // Copy is in progress elsewhere. Wait and try later.
        usleep(10);
        return copyRC(structure, semantics);
    }

    return _performCopying(structure, semantics);
}

// ---------------
// WEAK REFERENCES
// ---------------

__attribute__((visibility("default")))
__rc_proxy* retainWeakly(void* const structure) {
    if (!structure) return NULL;
    __rc_header* const header = RC_HEADER(structure);

    // Acquire temporary strong reference to prevent deallocation race
    if (atomic_fetch_add_explicit(&header->refs, 1, memory_order_acquire) == 0) {
        // Structure is already being deallocated - roll back our increment
        atomic_fetch_sub_explicit(&header->refs, 1, memory_order_relaxed);
        return NULL;
    }

    // Structure is guaranteed to remain alive during weak ref creation
    __rc_proxy* const proxy = atomic_load_explicit(&header->proxy, memory_order_acquire);
    if (proxy) {
        atomic_fetch_add_explicit(&proxy->refs, 1, memory_order_relaxed);
        // Release temporary strong reference using proper API
        _release_rc_structure(structure);
        return proxy;
    }

    // Slow path: create a new proxy candidate
    __rc_proxy* const newProxy = malloc(sizeof(__rc_proxy));
    if (!newProxy) {
        panic("Reference counting: Memory allocation failed in retainWeakly");
    }

    atomic_init(&newProxy->refs, 1); // Start with our reference
    newProxy->target = structure;

    // Update header->proxy if its value is still NULL (the initial value of raceProxy).
    __rc_proxy* raceProxy = NULL;
    if (atomic_compare_exchange_strong_explicit(&header->proxy, &raceProxy, newProxy,
                                                memory_order_acq_rel, memory_order_acquire)) {
        // Optimistic concurrency race won. This proxy is now installed.
        // It is safe to use by the referent.
        atomic_fetch_add_explicit(&newProxy->refs, 1, memory_order_relaxed);
        _release_rc_structure(structure);
        return newProxy;
    } else {
        // Optimistic concurrency race lost. Another thread installed a proxy.
        // Discard this one.
        free(newProxy);

        // The installed proxy is returned in &raceProxy.
        // Increment its reference counter for this reference.
        atomic_fetch_add_explicit(&raceProxy->refs, 1, memory_order_relaxed);
        _release_rc_structure(structure);
        return raceProxy;
    }
}

__attribute__((visibility("default")))
void _release_proxy(__rc_proxy* const proxy) {
    if (atomic_fetch_sub_explicit(&proxy->refs, 1, memory_order_acq_rel) == 1) {
        free(proxy);
    }
}

// ---------------
// TRAIT CONFORMANCES
// ---------------

__attribute__((visibility("default")))
void _register_conformance(const __type_info* type, const __protocol_info* protocol, const void* witness_table) {
    size_t bucket = ((uintptr_t)type >> 4) % SIDE_TABLE_BUCKETS;

    __side_table_entry* entry = __conformance_side_table[bucket];
    while (entry) {
        if (entry->type == type) break;
        entry = entry->next;
    }
    if (!entry) {
        entry = malloc(sizeof(__side_table_entry));
        entry->type = type;
        entry->conformances = NULL;
        entry->next = __conformance_side_table[bucket];
        __conformance_side_table[bucket] = entry;
    }

    __conformance_node* node = malloc(sizeof(__conformance_node));
    memcpy(node, &(const __conformance_node){
        .conformance = (const __protocol_conformance_entry){
            .protocol = protocol,
            .witness_table = witness_table
        },
        .next = entry->conformances
    }, sizeof(__conformance_node));
    entry->conformances = node;
}

__attribute__((visibility("default")))
const void* _lookup_conformance(const __type_info* type, const __protocol_info* protocol) {
    // Check static conformances first (fast path)
    const __protocol_conformance_entry** pointer = type->data_type.conformances;
    if (pointer) {
        while (*pointer && (*pointer)->protocol) {
            if ((*pointer)->protocol == protocol) return (*pointer)->witness_table;
            pointer++;
        }
    }

    // Fall back to side table (retroactive conformances)
    size_t bucket = ((uintptr_t)type >> 4) % SIDE_TABLE_BUCKETS;
    __side_table_entry* se = __conformance_side_table[bucket];
    while (se) {
        if (se->type == type) {
            __conformance_node* node = se->conformances;
            while (node) {
                if (node->conformance.protocol == protocol) return node->conformance.witness_table;
                node = node->next;
            }
            return NULL;
        }
        se = se->next;
    }
    return NULL;
}
