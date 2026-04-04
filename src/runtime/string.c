#include "clawr_string.h"
#include "panic.h"

#include <stdlib.h>
#include <string.h>

static void retainNestedFields(void* self) {
    (void) self;
}

static void releaseNestedFields(void* self) {
    String* s = (String*) self;
    if (s->data) {
        free(s->data);
        s->data = NULL;
        s->length = 0;
    }
}

const __type_info Stringˇtype = {
    .data_type = {
        .size = sizeof(String),
        .retain_nested_fields = retainNestedFields,
        .release_nested_fields = releaseNestedFields,
    },
};

String* String¸fromCString(const char* value) {
    if (!value) panic("String¸fromCString does not accept NULL");

    size_t len = strlen(value);
    char* data = malloc(len + 1);
    if (!data) panic("Out of memory in String¸fromCString");
    memcpy(data, value, len + 1);

    String* s = allocRC(String, __rc_ISOLATED);
    s->length = len;
    s->data = data;
    return s;
}

String* String¸concat(String* left, String* right) {
    if (!left || !right) panic("String¸concat does not accept NULL");

    size_t len = left->length + right->length;
    char* data = malloc(len + 1);
    if (!data) panic("Out of memory in String¸concat");

    memcpy(data, left->data, left->length);
    memcpy(data + left->length, right->data, right->length);
    data[len] = '\0';

    String* s = allocRC(String, __rc_ISOLATED);
    s->length = len;
    s->data = data;
    return s;
}

const char* String·toCString(String* self) {
    if (!self) panic("String·toCString does not accept NULL");
    return self->data;
}
