#include "octet_stream.h"

#include <assert.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/resource.h>
#include <sys/wait.h>
#include <unistd.h>

static Field *field(const char *text) {
  String *string = String¸fromCString(text);
  Field *result = Field¸fromString(FIELD_BINARY, string);
  releaseRC(string);
  return result;
}

static Field *readOctets(clawr¸OctetInput *input, int64_t count) {
  Integer *size = Integer¸fromInt64(count);
  Field *result = clawr¸readOctets˛count(input, size);
  releaseRC(size);
  return result;
}

static void checkBytes(String *path, const uint8_t *expected, size_t count) {
  FILE *file = fopen(path->data, "rb");
  assert(file);
  for (size_t i = 0; i < count; i++)
    assert(fgetc(file) == expected[i]);
  assert(fgetc(file) == EOF && !ferror(file));
  assert(fclose(file) == 0);
}

static void checkCodec(void) {
  uint8_t bytes[256];
  for (size_t i = 0; i < sizeof(bytes); i++)
    bytes[i] = (uint8_t)i;
  const size_t lengths[] = {0, 1, 7, 8, 9, 15, 16, 17, 31, 32, 33, 255, 256};
  for (size_t n = 0; n < sizeof(lengths) / sizeof(lengths[0]); n++) {
    size_t count = lengths[n];
    Field *decoded = Field¸fromOctets(bytes, count);
    assert(decoded->kind == FIELD_BINARY && decoded->length == count * 8);
    for (size_t i = 0; i < count * 8; i++) {
      truthvalue_t expected = bytes[i / 8] & (1u << (7 - i % 8)) ? c_true : c_false;
      assert(Field¸lane(decoded, i) == expected);
    }
    uint8_t *encoded = Field¸toOctets(decoded);
    assert(memcmp(encoded, bytes, count) == 0);
    free(encoded);
    releaseRC(decoded);
  }
  Field *value = field("100000000000000111111111");
  const uint8_t expected[] = {0x80, 0x01, 0xff};
  uint8_t *encoded = Field¸toOctets(value);
  assert(memcmp(encoded, expected, sizeof(expected)) == 0);
  free(encoded);
  releaseRC(value);
}

static void expectPanic(int scenario, String *path, String *directory) {
  const char *messages[] = {
      "Octet stream is closed", "Octet stream is closed",
      "Octet read count must be positive and fit a field",
      "Field index or count cannot be negative", "Field index or count is too large",
      "Octet encoding requires a multiple of 8 lanes",
      "Octet encoding requires a binary field", "Cannot open octet file",
      "Octet file path must not contain NUL", "Invalid octet stream handle",
      "Octet stream is closed", "Octet streams cannot be copied",
      "Octet stream read failed", "Octet stream close failed",
      "Octet stream write failed", "Octet stream close failed",
  };
  int errors[2];
  assert(pipe(errors) == 0);
  pid_t pid = fork();
  assert(pid >= 0);
  if (!pid) {
    assert(close(errors[0]) == 0);
    assert(dup2(errors[1], STDERR_FILENO) >= 0);
    assert(close(errors[1]) == 0);
    if (scenario == 0) {
      clawr¸OctetInput *input = clawr¸openOctetInput(path);
      clawr¸closeOctetInput(input);
      readOctets(input, 1);
    } else if (scenario == 1) {
      clawr¸OctetOutput *output = clawr¸openOctetOutput(path);
      clawr¸closeOctetOutput(output);
      clawr¸writeOctets˛value(output, field(""));
    } else if (scenario >= 2 && scenario <= 4) {
      clawr¸OctetInput *input = clawr¸openOctetInput(path);
      if (scenario == 4) {
        Integer *huge = Integer¸fromCString("1000000000000000000000000000000000");
        clawr¸readOctets˛count(input, huge);
      } else {
        readOctets(input, scenario == 2 ? 0 : -1);
      }
    } else if (scenario == 5 || scenario == 6) {
      clawr¸OctetOutput *output = clawr¸openOctetOutput(path);
      Field *value = field(scenario == 5 ? "1" : "");
      if (scenario == 6)
        value->kind = FIELD_TERNARY;
      clawr¸writeOctets˛value(output, value);
    } else if (scenario == 7) {
      String *missing = String¸fromCString("/missing");
      String *name = String¸concat(directory, missing);
      clawr¸openOctetInput(name);
    } else if (scenario == 8) {
      String *nul = String¸fromBytes("\0suffix", 7);
      String *name = String¸concat(path, nul);
      clawr¸openOctetOutput(name);
    } else if (scenario == 9) {
      clawr¸OctetOutput *output = clawr¸openOctetOutput(path);
      readOctets(output, 1);
    } else if (scenario == 10) {
      clawr¸OctetInput *input = clawr¸openOctetInput(path);
      clawr¸closeOctetInput(input);
      clawr¸closeOctetInput(input);
    } else if (scenario == 11) {
      clawr¸OctetInput *input = clawr¸openOctetInput(path);
      copyRC(input, __rc_SHARED);
    } else if (scenario == 12) {
      clawr¸OctetInput *input = clawr¸openOctetInput(directory);
      readOctets(input, 1);
    } else {
      struct rlimit limit = {.rlim_cur = 0, .rlim_max = 0};
      assert(setrlimit(RLIMIT_FSIZE, &limit) == 0);
      assert(signal(SIGXFSZ, SIG_IGN) != SIG_ERR);
      clawr¸OctetOutput *output = clawr¸openOctetOutput(path);
      if (scenario == 13 || scenario == 15) {
        clawr¸writeOctets˛value(output, field("10000000"));
        if (scenario == 13) {
          clawr¸closeOctetOutput(output);
        } else {
          releaseRC(output);
        }
      } else {
        uint8_t bytes[16384] = {0};
        clawr¸writeOctets˛value(output, Field¸fromOctets(bytes, sizeof(bytes)));
      }
    }
    _exit(0);
  }
  assert(close(errors[1]) == 0);
  int status;
  assert(waitpid(pid, &status, 0) == pid);
  assert(WIFEXITED(status) && WEXITSTATUS(status) == 1);
  char text[256] = {0};
  ssize_t length = read(errors[0], text, sizeof(text) - 1);
  assert(length > 0);
  char expected[256];
  snprintf(expected, sizeof(expected), "PANIC: %s\n", messages[scenario]);
  assert(strcmp(text, expected) == 0);
  assert(close(errors[0]) == 0);
}

int main(void) {
  checkCodec();
  char directory[] = "/tmp/clawr-octet-streams-XXXXXX";
  assert(mkdtemp(directory));
  char filename[sizeof(directory) + 16];
  snprintf(filename, sizeof(filename), "%s/data.bin", directory);
  String *path = String¸fromCString(filename);
  const uint8_t bytes[] = {0x00, 0x80, 0xff, 0x01, 0xaa, 0x55, 0x7f,
                           0xfe, 0x81, 0x40, 0x02, 0xc3, 0x09};
  FILE *raw = fopen(filename, "wb");
  assert(raw && fwrite(bytes, 1, sizeof(bytes), raw) == sizeof(bytes));
  assert(fclose(raw) == 0);

  clawr¸OctetInput *input = clawr¸openOctetInput(path);
  clawr¸OctetInput *alias = retainRC(input);
  releaseRC(input);
  Field *first = readOctets(alias, 3);
  Field *next = readOctets(alias, 1);
  Field *last = readOctets(alias, 20);
  assert(first->length == 24 && next->length == 8 && last->length == 72);
  Field *prefix = Field¸concat(first, next);
  Field *all = Field¸concat(prefix, last);
  Field *expected = Field¸fromOctets(bytes, sizeof(bytes));
  assert(Field¸equal(all, expected) == c_true);
  for (int i = 0; i < 2; i++) {
    Field *eof = readOctets(alias, 1);
    assert(eof->length == 0);
    releaseRC(eof);
  }
  clawr¸closeOctetInput(alias);
  releaseRC(alias);

  clawr¸OctetOutput *output = clawr¸openOctetOutput(path);
  clawr¸writeOctets˛value(output, first);
  clawr¸writeOctets˛value(output, next);
  clawr¸writeOctets˛value(output, last);
  Field *empty = field("");
  clawr¸writeOctets˛value(output, empty);
  clawr¸closeOctetOutput(output);
  releaseRC(output);
  checkBytes(path, bytes, sizeof(bytes));

  output = clawr¸openOctetOutput(path);
  clawr¸OctetOutput *outputAlias = retainRC(output);
  releaseRC(output);
  clawr¸writeOctets˛value(outputAlias, all);
  releaseRC(outputAlias);
  checkBytes(path, bytes, sizeof(bytes));

  String *dir = String¸fromCString(directory);
  for (int i = 0; i < 16; i++) {
    if (i == 8) {
      raw = fopen(filename, "wb");
      assert(raw && fwrite(bytes, 1, sizeof(bytes), raw) == sizeof(bytes));
      assert(fclose(raw) == 0);
    }
    expectPanic(i, path, dir);
    if (i == 8)
      checkBytes(path, bytes, sizeof(bytes));
  }
  releaseRC(dir);
  releaseRC(empty);
  releaseRC(first);
  releaseRC(next);
  releaseRC(last);
  releaseRC(prefix);
  releaseRC(all);
  releaseRC(expected);
  releaseRC(path);
  assert(unlink(filename) == 0);
  assert(rmdir(directory) == 0);
  return 0;
}
