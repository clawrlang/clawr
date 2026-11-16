#ifndef CLAWR_INTERFACES_H
#define CLAWR_INTERFACES_H

#include "clawr_string.h"
#include "refc.h"
#include "truthvalue.h"

// ```clawr
// trait Equatable {
//     func equals(_ other: Self) -> boolean
// }
// ```
typedef struct {
  truthvalue_t (*equals)(void *left, void *right);
} clawr¸Equatableˇwitness;
extern const __interface_info clawr¸Equatableˇtype;

struct HashBuilder;
typedef struct {
  truthvalue_t (*equals)(void *left, void *right);
  void (*hash˛into)(void *self, struct HashBuilder *builder);
} clawr¸HashEquatableˇwitness;
extern const __interface_info clawr¸HashEquatableˇtype;

// ```clawr
// trait Ordered {
//     func isOrderedBefore(_ other: Self) -> boolean
// }
// ```
typedef struct {
  truthvalue_t (*isOrderedBefore)(void *left, void *right);
} clawr¸Orderedˇwitness;
extern const __interface_info clawr¸Orderedˇtype;

// ```clawr
// trait HasStringRepresentation {
//     func stringRepresentation() -> string
// }
// ```
typedef struct {
  String *(*stringRepresentation)(void *self);
} clawr¸HasStringRepresentationˇwitness;
extern const __interface_info clawr¸HasStringRepresentationˇtype;

typedef struct Integer Integer;
typedef struct Real Real;

typedef struct {
  void (*serialize˛into)(void *self, void *serializer);
} clawr¸Serializableˇwitness;
extern const __interface_info clawr¸Serializableˇtype;

typedef struct {
  void (*writeString)(void *self, String *value);
  void (*writeInteger)(void *self, Integer *value);
  void (*writeReal)(void *self, Real *value);
  void (*writeTruthvalue)(void *self, truthvalue_t value);
  void (*beginStructure˛fieldCount)(void *self, String *typeName,
                                    Integer *fieldCount);
  void (*writeField˛value)(void *self, String *name, void *value);
  void (*endStructure)(void *self);
} clawr¸Serializerˇwitness;
extern const __interface_info clawr¸Serializerˇtype;

extern const __interface_conformance_entry Integerˇserializable_conformance;
extern const __interface_conformance_entry Realˇserializable_conformance;
extern const __interface_conformance_entry Stringˇserializable_conformance;
extern const __interface_conformance_entry TruthvalueBoxˇserializable_conformance;

#endif // CLAWR_INTERFACES_H
