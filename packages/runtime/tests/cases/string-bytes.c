#include "runtime.h"
#include <string.h>

int main(void) {
  char bytes[] = {'a', '\0', '\360', '\237', '\230', '\200'};
  String *value = String¸fromBytes(bytes, sizeof bytes);
  assert(value->length == sizeof bytes &&
             memcmp(value->data, bytes, sizeof bytes) == 0,
         "String bytes were truncated or UTF8 was changed");
  assert(value->data[sizeof bytes] == '\0', "Missing trailing terminator");
  bytes[0] = 'b';
  assert(value->data[0] == 'a', "String did not own its copied bytes");

  String *empty = String¸fromBytes(bytes, 0);
  assert(empty->length == 0 && empty->data[0] == '\0',
         "Empty byte string failed");
  String *prefix = String¸fromBytes("prefix suffix", 6);
  String *expected = String¸fromCString("prefix");
  assert(String¸eq(prefix, expected) == c_true,
         "Byte string read beyond requested length");
  releaseRC(expected);
  releaseRC(prefix);
  releaseRC(empty);
  releaseRC(value);
  return 0;
}
