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

#endif // CLAWR_INTERFACES_H
