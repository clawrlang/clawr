#include "truthvalue.h"
#include <stdio.h>

static void print_tv(const char* label, int value) {
    printf("%s: %s\n", label, truthvalue·toCString(value));
}

int main() {
    // rotate__by: rotate CW (by=true=1) and CCW (by=false=-1)
    print_tv("rotate(false, by: true)",     rotate__by(c_false, c_true));  // false→ambiguous
    print_tv("rotate(ambiguous, by: true)", rotate__by(c_ambiguous, c_true));  // ambiguous→true
    print_tv("rotate(true, by: true)",      rotate__by(c_true, c_true));  // true→false
    print_tv("rotate(false, by: false)",    rotate__by(c_false, c_false));  // false→true
    print_tv("rotate(ambiguous, by: false)",rotate__by(c_ambiguous, c_false));  // ambiguous→false
    print_tv("rotate(true, by: false)",     rotate__by(c_true, c_false));  // true→ambiguous

    // adjust__towards
    print_tv("adjust(false, towards: true)",     adjust__towards(c_false, c_true));  // ambiguous
    print_tv("adjust(true, towards: true)",      adjust__towards(c_true, c_true));  // true
    print_tv("adjust(true, towards: false)",     adjust__towards(c_true, c_false));  // ambiguous
    print_tv("adjust(ambiguous, towards: false)",adjust__towards(c_ambiguous, c_false));  // false

    // modulate__by: balanced ternary MUL
    print_tv("modulate(false, by: false)",    modulate__by(c_false, c_false));  // true  (-1*-1=1)
    print_tv("modulate(false, by: ambiguous)",modulate__by(c_false, c_ambiguous));  // ambiguous
    print_tv("modulate(false, by: true)",     modulate__by(c_false, c_true));  // false (-1*1=-1)
    print_tv("modulate(ambiguous, by: true)", modulate__by(c_ambiguous, c_true));  // ambiguous
    print_tv("modulate(true, by: true)",      modulate__by(c_true, c_true));  // true  (1*1=1)
    print_tv("modulate(true, by: false)",     modulate__by(c_true, c_false));  // false (1*-1=-1)

    return 0;
}
