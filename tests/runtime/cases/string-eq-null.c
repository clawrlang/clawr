#include "clawr_string.h"
#include "truthvalue.h"
#include <stdio.h>

static void print_eq(const char* label, truthvalue_t value) {
    printf("%s: %s\n", label, truthvalue·toCString(value));
}

int main() {
    String* a = String¸fromCString("hello");
    String* b = String¸fromCString("hello");
    String* c = String¸fromCString("world");
    String* n = NULL;

    print_eq("eq(null, null)", String¸eq(n, n));
    print_eq("eq(null, hello)", String¸eq(n, a));
    print_eq("eq(hello, null)", String¸eq(a, n));
    print_eq("eq(hello, hello)", String¸eq(a, b));
    print_eq("eq(hello, world)", String¸eq(a, c));

    releaseRC(a);
    releaseRC(b);
    releaseRC(c);
    return 0;
}
