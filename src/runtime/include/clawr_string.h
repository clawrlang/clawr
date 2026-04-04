#ifndef CLAWR_STRING_H
#define CLAWR_STRING_H

#include "refc.h"
#include <stddef.h>

typedef struct String {
    __rc_header header;
    size_t length;
    char* data;
} String;
extern const __type_info Stringˇtype;

String* String¸fromCString(const char* value);
String* String¸concat(String* left, String* right);
const char* String·toCString(String* self);

#endif // CLAWR_STRING_H
