#ifndef CLAWR_STRING_H
#define CLAWR_STRING_H

#include "refc.h"
#include "truthvalue.h"
#include <stddef.h>

typedef struct String {
    __rc_header header;
    size_t length;
    char* data;
} String;
typedef struct Stringˇfields {
    size_t length;
    char* data;
} Stringˇfields;
extern const __type_info Stringˇtype;

String* String¸fromCString(const char* value);
String* String¸concat(String* left, String* right);
truthvalue_t String¸eq(String* left, String* right);
String* String¸readTextFile(String* path);
truthvalue_t String¸writeTextFile(String* path, String* content);
const char* String·toCString(String* self);

#endif // CLAWR_STRING_H
