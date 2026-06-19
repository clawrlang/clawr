#include "integer-va.h"
#include <stdio.h>

void printInteger(Integer* integer) {
    printf("%s\n", Integer·toString(integer));
}
int main() {
    Integer* bigInt;
    String* bigIntStr;

    bigIntStr = String¸fromCString("18446744073709551617");
    bigInt = Integer¸fromStringRC(bigIntStr);
    printInteger(bigInt);
    releaseRC(bigInt);
    releaseRC(bigIntStr);

    bigIntStr = String¸fromCString("340282366920938463426481119284349108225");
    bigInt = Integer¸fromStringRC(bigIntStr);
    printInteger(bigInt);
    releaseRC(bigInt);
    releaseRC(bigIntStr);

    bigIntStr = String¸fromCString("-340282366920938463426481119284349108225");
    bigInt = Integer¸fromStringRC(bigIntStr);
    printInteger(bigInt);
    releaseRC(bigInt);
    releaseRC(bigIntStr);

    bigIntStr = String¸fromCString("0");
    bigInt = Integer¸fromStringRC(bigIntStr);
    printInteger(bigInt);
    releaseRC(bigInt);
    releaseRC(bigIntStr);
}
