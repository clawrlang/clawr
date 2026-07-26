#include "array.h"

__attribute__((visibility("default")))
const __type_info Arrayˇtype = {
    .data_type = { .size = sizeof(Array) }
};

__attribute__((visibility("default")))
Array Array¸empty = {
    .count = 0,
    .header = {
        .allocation_size = sizeof(Array),
        .is_a = &Arrayˇtype,
        .refs = 1 & __rc_ISOLATED,
    }
};

__attribute__((visibility("default")))
Array* Array¸new(size_t count, size_t elem_size) {
    Array* array = allocInitRC(Array, count * elem_size, __rc_ISOLATED,
        .count = count,
        .elem_size = elem_size
    );
    memset(array->elements, 0, count * elem_size);

    return array;
}

__attribute__((visibility("default")))
size_t Array¸checkedIndex(int64_t index, const Array* array) {
    if (index < 0) {
        panic("Array index cannot be negative");
    }

    size_t normalized = (size_t)index;
    if (normalized >= array->count) {
        panic("Array index out of bounds");
    }

    return normalized;
}
