#include <stdio.h>
#include <stdlib.h>
#include "lanes.h"

void print_binary(unsigned long long x1, unsigned long long x0) {
    for (int i = 8; i >= 0; i--) {
        printf("%llu", (x1 >> i) & 1);
    }
    printf(" -- ");
    for (int i = 8; i >= 0; i--) {
        printf("%llu", (x0 >> i) & 1);
    }
    printf("\n");
}

int main() {
    const TernaryWord a = TernaryWord¸fromCString("TTT000111", 9);
    const TernaryWord b = TernaryWord¸fromCString("T01T01T01", 9);

    const TernaryWord cAnd = tritwiseAnd(a, b);
    const TernaryWord cOr = tritwiseOr(a, b);
    const TernaryWord cNot = tritwiseNot(a, 9);

    const TernaryWord cAdjust = tritwiseAdjust__towards(a, b);
    const TernaryWord cRotate = tritwiseRotate__by(a, b);
    const TernaryWord cModulate = tritwiseModulate__by(a, b);

    const TernaryWord cFilter = tritwiseFilter__mask(a, 0b101010101);

    print_binary(a.x1, a.x0);
    print_binary(b.x1, b.x0);
    print_binary(cAnd.x1, cAnd.x0);
    print_binary(cOr.x1, cOr.x0);
    print_binary(cNot.x1, cNot.x0);
    print_binary(cAdjust.x1, cAdjust.x0);
    print_binary(cRotate.x1, cRotate.x0);
    print_binary(cModulate.x1, cModulate.x0);
    print_binary(cFilter.x1, cFilter.x0);

    char* as = TernaryWord·toCString(a, 9);
    char* bs = TernaryWord·toCString(b, 9);
    char* sAnd = TernaryWord·toCString(cAnd, 9);
    char* sOr = TernaryWord·toCString(cOr, 9);
    char* sNot = TernaryWord·toCString(cNot, 9);
    char* sAdjust = TernaryWord·toCString(cAdjust, 9);
    char* sRotate = TernaryWord·toCString(cRotate, 9);
    char* sModulate = TernaryWord·toCString(cModulate, 9);
    char* sFilter = TernaryWord·toCString(cFilter, 9);

    printf("%s\n", as);
    printf("%s\n", bs);
    printf("%s\n", sAnd);
    printf("%s\n", sOr);
    printf("%s\n", sNot);
    printf("%s\n", sAdjust);
    printf("%s\n", sRotate);
    printf("%s\n", sModulate);
    printf("%s\n", sFilter);

    free(as);
    free(bs);
    free(sAnd);
    free(sOr);
    free(sNot);
    free(sAdjust);
    free(sRotate);
    free(sModulate);
    free(sFilter);

    return 0;
}
