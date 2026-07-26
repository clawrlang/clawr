#include "clawr_string.h"
#include "panic.h"

#include <stdio.h>
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

__attribute__((visibility("default")))
const __type_info Stringˇtype = {
    .data_type = {
        .size = sizeof(String),
        .retain_nested_fields = retainNestedFields,
        .release_nested_fields = releaseNestedFields,
    },
};

__attribute__((visibility("default")))
String* String¸fromCString(const char* value) {
    if (!value) panic("String¸fromCString does not accept NULL");

    size_t len = strlen(value);
    char* data = malloc(len + 1);
    if (!data) panic("Out of memory in String¸fromCString");
    memcpy(data, value, len + 1);

    return allocInitRC(String, __rc_ISOLATED,
        .length = len,
        .data = data
    );
}

__attribute__((visibility("default")))
String* String¸concat(String* left, String* right) {
    if (!left || !right) panic("String¸concat does not accept NULL");

    size_t len = left->length + right->length;
    char* data = malloc(len + 1);
    if (!data) panic("Out of memory in String¸concat");

    memcpy(data, left->data, left->length);
    memcpy(data + left->length, right->data, right->length);
    data[len] = '\0';

    return allocInitRC(String, __rc_ISOLATED,
        .length = len,
        .data = data
    );
}

__attribute__((visibility("default")))
truthvalue_t String¸eq(String* left, String* right) {
    if (!left && !right) return c_true;
    if (!left || !right) return c_false;
    return strcmp(left->data, right->data) == 0 ? c_true : c_false;
}

__attribute__((visibility("default")))
String* String¸readTextFile(String* path) {
    if (!path) panic("String¸readTextFile does not accept NULL path");

    FILE* file = fopen(String·toCString(path), "rb");
    if (!file) return NULL;

    if (fseek(file, 0, SEEK_END) != 0) {
        fclose(file);
        return NULL;
    }

    long rawSize = ftell(file);
    if (rawSize < 0) {
        fclose(file);
        return NULL;
    }

    if (fseek(file, 0, SEEK_SET) != 0) {
        fclose(file);
        return NULL;
    }

    size_t size = (size_t)rawSize;
    char* data = malloc(size + 1);
    if (!data) panic("Out of memory in String¸readTextFile");

    size_t readCount = fread(data, 1, size, file);
    if (ferror(file)) {
        free(data);
        fclose(file);
        return NULL;
    }

    data[readCount] = '\0';
    fclose(file);

    return allocInitRC(String, __rc_ISOLATED,
        .length = readCount,
        .data = data
    );
}

__attribute__((visibility("default")))
truthvalue_t String¸writeTextFile(String* path, String* content) {
    if (!path || !content) {
        panic("String¸writeTextFile does not accept NULL arguments");
    }

    FILE* file = fopen(String·toCString(path), "wb");
    if (!file) return c_false;

    size_t written = fwrite(content->data, 1, content->length, file);
    if (written != content->length) {
        fclose(file);
        return c_false;
    }

    if (fclose(file) != 0) return c_false;
    return c_true;
}

__attribute__((visibility("default")))
const char* String·toCString(String* self) {
    if (!self) panic("String·toCString does not accept NULL");
    return self->data;
}
