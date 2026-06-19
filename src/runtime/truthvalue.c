#include "truthvalue.h"

__attribute__((visibility("default")))
const char* truthvalue·toCString(truthvalue_t value) {
    switch (value)
    {
        case c_false: return "false";
        case c_true: return "true";
        default: return "ambiguous";
    }
}
