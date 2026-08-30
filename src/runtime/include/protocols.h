#ifndef CLAWR_PROTOCOLS_H
#define CLAWR_PROTOCOLS_H

#include "clawr_string.h"
#include "refc.h"
#include "truthvalue.h"

// ```clawr
// trait Equatable {
//     companion func equal(left: Self, right: Self) -> boolean
//     func equals(other: Self) -> boolean
// }
// ```
typedef struct {
  truthvalue_t (*equal)(void *left, void *right);
} clawr¸Equatableˇwitness;
extern const __protocol_info clawr¸Equatableˇtype;

// ```clawr
// trait HasStringRepresentation {
//     func stringRepresentation(other: Self) -> String
// }
// ```
typedef struct {
  String *(*stringRepresentation)(void *self);
} clawr¸HasStringRepresentationˇwitness;
extern const __protocol_info clawr¸HasStringRepresentationˇtype;

#endif
