#include "integer.h"
#include "truthvalue.h"
#include <stdio.h>

static void print_cmp(const char* label, truthvalue_t value) {
    printf("%s: %s\n", label, truthvalue·toCString(value));
}

int main() {
    Integer* one = Integer¸fromCString("1");
    Integer* two = Integer¸fromCString("2");
    Integer* also_one = Integer¸fromCString("1");

    print_cmp("eq(1, 1)", Integer¸eq(one, also_one));
    print_cmp("ne(1, 2)", Integer¸ne(one, two));
    print_cmp("lt(1, 2)", Integer¸lt(one, two));
    print_cmp("le(1, 1)", Integer¸le(one, also_one));
    print_cmp("gt(2, 1)", Integer¸gt(two, one));
    print_cmp("ge(2, 2)", Integer¸ge(two, two));

    releaseRC(one);
    releaseRC(two);
    releaseRC(also_one);
    return 0;
}
