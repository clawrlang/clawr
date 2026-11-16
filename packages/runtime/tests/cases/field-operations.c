#include "fields.h"
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/wait.h>
#include <unistd.h>

static Field *field(FieldKind kind, const char *lanes) {
  String *text = String¸fromCString(lanes);
  Field *result = Field¸fromString(kind, text);
  releaseRC(text);
  return result;
}

static void check(const Field *value, const char *expected) {
  String *text = Field¸toString(value);
  assert(text->length == strlen(expected));
  assert(strcmp(text->data, expected) == 0);
  releaseRC(text);
}

static void checkWidth(size_t length, FieldKind kind) {
  char *source = malloc(length + 1);
  char *shifted = malloc(length + 1);
  assert(source && shifted);
  memset(source, kind == FIELD_BINARY ? '0' : 'T', length);
  memset(shifted, kind == FIELD_BINARY ? '0' : 'T', length);
  if (length > 0) {
    source[length - 1] = '1';
    shifted[0] = '1';
  }
  source[length] = shifted[length] = '\0';
  Field *input = field(kind, source);
  Field *result = Field¸shift(input, length ? length - 1 : 0, true);
  check(result, shifted);
  releaseRC(result);
  releaseRC(input);
  free(source);
  free(shifted);
}

static void expectPanic(int scenario) {
  pid_t pid = fork();
  assert(pid >= 0);
  if (pid == 0) {
    assert(freopen("/dev/null", "w", stderr));
    if (scenario == 0) {
      Field *a = field(FIELD_BINARY, "1");
      Field *b = field(FIELD_BINARY, "10");
      Field¸and(a, b);
    } else if (scenario == 1) {
      field(FIELD_BINARY, "T");
    } else if (scenario == 2) {
      Field *a = field(FIELD_TERNARY, "T");
      Field¸xor(a, a);
    } else {
      field(FIELD_TERNARY, "x");
    }
    _exit(0);
  }
  int status;
  assert(waitpid(pid, &status, 0) == pid);
  assert(WIFEXITED(status) && WEXITSTATUS(status) != 0);
}

int main(void) {
  Field *a = field(FIELD_BINARY, "1001");
  Field *b = field(FIELD_BINARY, "1010");
  Field *result = Field¸xor(a, b);
  check(result, "0011");
  releaseRC(result);
  result = Field¸and(a, b);
  check(result, "1000");
  releaseRC(result);
  result = Field¸or(a, b);
  check(result, "1011");
  releaseRC(result);
  result = Field¸not(a);
  check(result, "0110");
  releaseRC(result);
  result = Field¸shift(a, 1, true);
  check(result, "0010");
  releaseRC(result);
  result = Field¸shift(a, 1, false);
  check(result, "0100");
  releaseRC(result);
  result = Field¸shift(a, 99, true);
  check(result, "0000");
  releaseRC(result);
  assert(Field¸equal(a, a) == c_true);
  assert(Field¸equal(a, b) == c_false);
  releaseRC(a);
  releaseRC(b);

  a = field(FIELD_TERNARY, "TTT000111");
  b = field(FIELD_TERNARY, "T01T01T01");
  result = Field¸and(a, b);
  check(result, "TTTT00T01");
  releaseRC(result);
  result = Field¸or(a, b);
  check(result, "T01001111");
  releaseRC(result);
  result = Field¸not(a);
  check(result, "111000TTT");
  releaseRC(result);
  result = Field¸adjust(a, b);
  check(result, "TT0T01011");
  releaseRC(result);
  result = Field¸rotateStates(a, b);
  check(result, "1T0T0101T");
  releaseRC(result);
  result = Field¸modulate(a, b);
  check(result, "10T000T01");
  releaseRC(result);
  result = Field¸shift(a, 2, false);
  check(result, "TTTTT0001");
  releaseRC(result);
  releaseRC(a);
  releaseRC(b);

  a = field(FIELD_BINARY,
            "10000000000000000000000000000000000000000000000000000000000000001");
  assert(a->length == 65);
  result = Field¸shift(a, 64, true);
  check(result,
        "10000000000000000000000000000000000000000000000000000000000000000");
  releaseRC(result);
  releaseRC(a);

  a = field(FIELD_TERNARY, "");
  result = Field¸shift(a, 1, true);
  check(result, "");
  releaseRC(result);
  releaseRC(a);
  const size_t widths[] = {0, 9, 27, 32, 64, 65};
  for (size_t i = 0; i < sizeof(widths) / sizeof(widths[0]); i++) {
    checkWidth(widths[i], FIELD_BINARY);
    checkWidth(widths[i], FIELD_TERNARY);
  }
  for (int i = 0; i < 4; i++)
    expectPanic(i);
  return 0;
}
