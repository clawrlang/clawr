#ifndef ARRAY_H
#define ARRAY_H

#include "refc.h"
#include "panic.h"
#include <stdint.h>
#include <string.h>

typedef struct Array {
    __rc_header header;
    size_t count;
    size_t elem_size;
    unsigned char elements[];
} Array;
extern const __type_info Arrayˇtype;

/// @brief An array with zero elements
extern Array Array¸empty;

Array* Array¸new(size_t count, size_t elem_size);
size_t Array¸checkedIndex(int64_t index, const Array* array);

#define ARRAY_ELEMENT_AT(index, array, type) \
    ((type*)((array)->elements))[index]

#define ARRAY_ELEMENT_AT_CHECKED(index, array, type) \
    ARRAY_ELEMENT_AT(Array¸checkedIndex((int64_t)(index), (array)), (array), type)

#endif // ARRAY_H
