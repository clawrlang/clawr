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

static void checkPacked(const Field *value) {
  size_t words = value->length / 64 + (value->length % 64 != 0);
  size_t planes = value->kind == FIELD_TERNARY ? 2 : 1;
  assert(value->header.allocation_size ==
         sizeof(Field) + words * planes * sizeof(BinaryWord));
  if (value->length % 64) {
    BinaryWord padding = ~((1ULL << (value->length % 64)) - 1);
    for (size_t plane = 0; plane < planes; plane++)
      assert((value->words[plane * words + words - 1] & padding) == 0);
  }
  if (value->kind == FIELD_TERNARY)
    for (size_t i = 0; i < words; i++)
      assert((value->words[words + i] & ~value->words[i]) == 0);
}

static void check(const Field *value, const char *expected) {
  checkPacked(value);
  String *text = Field¸toString(value);
  assert(text->length == strlen(expected));
  assert(strcmp(text->data, expected) == 0);
  Field *parsed = field(value->kind, expected);
  assert(Field¸equal(value, parsed) == c_true);
  releaseRC(parsed);
  releaseRC(text);
}

static char laneSymbol(FieldKind kind, int value) {
  return value == 1 ? '1' : value == -1 && kind == FIELD_TERNARY ? 'T' : '0';
}

static int laneValue(FieldKind kind, char symbol) {
  return symbol == '1' ? 1 : symbol == 'T' || kind == FIELD_BINARY ? -1 : 0;
}

static void checkPackedOperations(size_t length, FieldKind kind) {
  char *aText = malloc(length + 1);
  char *bText = malloc(length + 1);
  char *expected = malloc(length + 1);
  assert(aText && bText && expected);
  int states = kind == FIELD_BINARY ? 2 : 3;
  uint32_t random = 17;
  for (size_t i = 0; i < length; i++) {
    int x = (int)(i % states), y = (int)(i / states % states);
    if (i >= 9) {
      random = random * 1664525u + 1013904223u;
      x = (int)((random >> 16) % states);
      random = random * 1664525u + 1013904223u;
      y = (int)((random >> 16) % states);
    }
    aText[i] = laneSymbol(kind, kind == FIELD_BINARY ? (x ? 1 : -1) : x - 1);
    bText[i] = laneSymbol(kind, kind == FIELD_BINARY ? (y ? 1 : -1) : y - 1);
  }
  aText[length] = bText[length] = expected[length] = '\0';
  Field *a = field(kind, aText);
  Field *b = field(kind, bText);
  check(a, aText);
  check(b, bText);
  for (size_t i = 0; i < length; i++)
    assert(Field¸lane(a, i) == laneValue(kind, aText[i]));
  for (size_t start = 0; start <= length; start++) {
    Field *prefix = Field¸slice(a, 0, start);
    Field *suffix = Field¸slice(a, start, length - start);
    memcpy(expected, aText, start);
    expected[start] = '\0';
    check(prefix, expected);
    check(suffix, aText + start);
    Field *joined = Field¸concat(prefix, suffix);
    check(joined, aText);
    releaseRC(joined);
    joined = Field¸concat(suffix, prefix);
    memcpy(expected, aText + start, length - start);
    memcpy(expected + length - start, aText, start);
    expected[length] = '\0';
    check(joined, expected);
    releaseRC(joined);
    size_t take = (length - start) / 2;
    Field *middle = Field¸slice(a, start, take);
    memcpy(expected, aText + start, take);
    expected[take] = '\0';
    check(middle, expected);
    releaseRC(middle);
    releaseRC(prefix);
    releaseRC(suffix);
  }
  expected[length] = '\0';

  Field *(*operations[])(const Field *, const Field *) = {
      Field¸and, Field¸or, Field¸xor,
      Field¸adjust, Field¸rotateStates, Field¸modulate,
  };
  const int adjust[3][3] = {{-1, -1, 0}, {-1, 0, 1}, {0, 1, 1}};
  const int rotate[3][3] = {{1, -1, 0}, {-1, 0, 1}, {0, 1, -1}};
  const int modulate[3][3] = {{1, 0, -1}, {0, 0, 0}, {-1, 0, 1}};
  for (size_t op = 0; op < sizeof(operations) / sizeof(operations[0]); op++) {
    if ((kind == FIELD_TERNARY && op == 2) ||
        (kind == FIELD_BINARY && op >= 3))
      continue;
    for (size_t i = 0; i < length; i++) {
      int av = laneValue(kind, aText[i]), bv = laneValue(kind, bText[i]);
      int x = av + 1, y = bv + 1;
      int value;
      switch (op) {
      case 0: value = av < bv ? av : bv; break;
      case 1: value = av > bv ? av : bv; break;
      case 2: value = av != bv ? 1 : -1; break;
      case 3: value = adjust[x][y]; break;
      case 4: value = rotate[x][y]; break;
      default: value = modulate[x][y]; break;
      }
      expected[i] = laneSymbol(kind, value);
    }
    Field *result = operations[op](a, b);
    check(result, expected);
    releaseRC(result);
  }

  for (size_t i = 0; i < length; i++)
    expected[i] = laneSymbol(kind, -laneValue(kind, aText[i]));
  Field *negated = Field¸not(a);
  check(negated, expected);
  Field *restored = Field¸not(negated);
  check(restored, aText);
  releaseRC(restored);
  releaseRC(negated);

  for (size_t count = 0; count <= length + 1; count++) {
    for (int left = 0; left <= 1; left++) {
      memset(expected, kind == FIELD_BINARY ? '0' : 'T', length);
      if (count < length) {
        if (left)
          memcpy(expected, aText + count, length - count);
        else
          memcpy(expected + count, aText, length - count);
      }
      Field *shifted = Field¸shift(a, count, left);
      check(shifted, expected);
      releaseRC(shifted);
    }
  }
  memset(expected, kind == FIELD_BINARY ? '0' : 'T', length);
  Field *shifted = Field¸shift(a, SIZE_MAX, true);
  check(shifted, expected);
  releaseRC(shifted);
  check(a, aText);
  check(b, bText);
  Field *copy = copyRC(a, __rc_ISOLATED);
  assert(copy != a);
  releaseRC(a);
  check(copy, aText);
  releaseRC(copy);
  releaseRC(b);
  free(aText);
  free(bText);
  free(expected);
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
    } else if (scenario == 3) {
      field(FIELD_TERNARY, "x");
    } else if (scenario == 4 || scenario == 5) {
      const char bytes[] = {'1', '\0', '1'};
      String *text = String¸fromBytes(bytes, sizeof(bytes));
      Field¸fromString(scenario == 4 ? FIELD_BINARY : FIELD_TERNARY, text);
    } else if (scenario == 6) {
      Field *a = field(FIELD_TERNARY, "T");
      a->words[1] = 1;
      Field¸toString(a);
    } else if (scenario == 7) {
      Field¸lane(field(FIELD_BINARY, ""), 0);
    } else if (scenario == 8) {
      Field¸lane(field(FIELD_TERNARY, "T01"), 3);
    } else if (scenario == 9) {
      Field¸slice(field(FIELD_BINARY, "01"), 3, 0);
    } else if (scenario == 10) {
      Field¸slice(field(FIELD_TERNARY, "T01"), 1, SIZE_MAX);
    } else if (scenario == 11) {
      Field¸concat(field(FIELD_BINARY, ""), field(FIELD_TERNARY, ""));
    } else if (scenario == 12) {
      Field¸sizeInt64(-1);
    } else if (scenario == 13) {
      Field¸sizeInteger(Integer¸fromCString("-1"));
    } else if (scenario == 14) {
      Field¸sizeInteger(Integer¸fromCString("100000000000000000000000000000000000000"));
    } else if (scenario == 15) {
      Field *a = field(FIELD_BINARY, "");
      a->length = SIZE_MAX;
      Field¸concat(a, field(FIELD_BINARY, "1"));
    } else {
      char text[3 * sizeof(size_t) + 1];
      snprintf(text, sizeof(text), "%zu", SIZE_MAX);
      Integer *maximum = Integer¸fromCString(text);
      Integer *one = Integer¸fromInt64(1);
      Field¸sizeInteger(Integer¸add(maximum, one));
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
  const size_t widths[] = {0, 1, 2, 9, 27, 32, 63, 64, 65, 66,
                           127, 128, 129, 191, 192, 193, 257};
  for (size_t i = 0; i < sizeof(widths) / sizeof(widths[0]); i++) {
    checkWidth(widths[i], FIELD_BINARY);
    checkWidth(widths[i], FIELD_TERNARY);
    checkPackedOperations(widths[i], FIELD_BINARY);
    checkPackedOperations(widths[i], FIELD_TERNARY);
  }
  assert(Field¸sizeInt64(0) == 0);
  Integer *size = Integer¸fromCString("129");
  assert(Field¸sizeInteger(size) == 129);
  releaseRC(size);
  char maxSize[3 * sizeof(size_t) + 1];
  snprintf(maxSize, sizeof(maxSize), "%zu", SIZE_MAX);
  size = Integer¸fromCString(maxSize);
  assert(Field¸sizeInteger(size) == SIZE_MAX);
  releaseRC(size);
  for (int i = 0; i < 17; i++)
    expectPanic(i);
  return 0;
}
