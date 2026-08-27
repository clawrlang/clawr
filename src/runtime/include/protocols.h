#ifndef CLAWR_PROTOCOLS_H
#define CLAWR_PROTOCOLS_H

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
__protocol_info clawr¸Equatableˇtype = {.name = "clawr.Equatable"};

#endif
