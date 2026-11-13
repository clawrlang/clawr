#ifndef CLAWR_HASH_H
#define CLAWR_HASH_H

#include "refc.h"
#include <stddef.h>
#include <stdint.h>

typedef struct HashBuilder HashBuilder;
extern const __type_info HashBuilderˇtype;

HashBuilder *clawr¸newHashBuilder(void);
void clawr¸HashBuilder·add(HashBuilder *self, void *value);

// Runtime-only snapshots and deterministic keyed construction; not Clawr APIs.
HashBuilder *HashBuilder¸withKey(uint64_t key0, uint64_t key1);
void HashBuilder¸appendBytes(HashBuilder *self, const void *bytes, size_t length);
uint64_t HashBuilder¸snapshot(const HashBuilder *self);

extern const __interface_conformance_entry Integerˇhash_conformance;
extern const __interface_conformance_entry Integerˇequal_conformance;
extern const __interface_conformance_entry Realˇhash_conformance;
extern const __interface_conformance_entry Realˇequal_conformance;
extern const __interface_conformance_entry Stringˇhash_conformance;
extern const __interface_conformance_entry Stringˇequal_conformance;
extern const __interface_conformance_entry TruthvalueBoxˇhash_conformance;
extern const __interface_conformance_entry TruthvalueBoxˇequal_conformance;

#endif
