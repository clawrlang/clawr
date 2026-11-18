#include "lane_stream.h"
#include <assert.h>
#include <stdio.h>
#include <string.h>
#include <sys/wait.h>
#include <unistd.h>

typedef struct MemoryFieldStream Stream;

typedef struct {
  FieldKind kind;
  Stream *(*input)(Field *);
  Stream *(*output)(void);
  Field *(*read)(Stream *, Integer *);
  void (*write)(Stream *, Field *);
  void (*closeInput)(Stream *);
  void (*closeOutput)(Stream *);
  Field *(*result)(Stream *);
} StreamAPI;

static const StreamAPI apis[] = {
    {FIELD_BINARY, clawr¸newMemoryBitfieldInput, clawr¸newMemoryBitfieldOutput,
     clawr¸readMemoryBits˛maxLanes, clawr¸writeMemoryBits˛value,
     clawr¸closeMemoryBitfieldInput, clawr¸closeMemoryBitfieldOutput,
     clawr¸memoryBitfieldResult},
    {FIELD_TERNARY, clawr¸newMemoryTritfieldInput, clawr¸newMemoryTritfieldOutput,
     clawr¸readMemoryTrits˛maxLanes, clawr¸writeMemoryTrits˛value,
     clawr¸closeMemoryTritfieldInput, clawr¸closeMemoryTritfieldOutput,
     clawr¸memoryTritfieldResult},
};

static Field *field(FieldKind kind, const char *lanes) {
  String *text = String¸fromCString(lanes);
  Field *result = Field¸fromString(kind, text);
  releaseRC(text);
  return result;
}

static void checkPartitions(const StreamAPI *api, size_t length) {
  char text[130];
  for (size_t i = 0; i < length; i++)
    text[i] = api->kind == FIELD_BINARY ? "01"[i % 2] : "T01"[i % 3];
  text[length] = '\0';
  Field *value = field(api->kind, text);
  const int64_t counts[] = {1, 3, 8, 9, 27, 63, 64, 65, 128};
  for (size_t n = 0; n < sizeof(counts) / sizeof(counts[0]); n++) {
    Stream *input = api->input(value);
    Stream *alias = retainRC(input);
    Stream *output = api->output();
    Integer *count = Integer¸fromInt64(counts[n]);
    size_t position = 0;
    for (;;) {
      Field *chunk = api->read(position % 2 ? alias : input, count);
      assert(chunk->kind == api->kind);
      assert(chunk->length <= (size_t)counts[n]);
      if (!chunk->length) {
        releaseRC(chunk);
        break;
      }
      for (size_t i = 0; i < chunk->length; i++)
        assert(Field¸lane(chunk, i) == Field¸lane(value, position + i));
      size_t split = chunk->length > 2 ? 2 : chunk->length;
      Field *left = Field¸slice(chunk, 0, split);
      Field *right = Field¸slice(chunk, split, chunk->length - split);
      api->write(output, left);
      api->write(output, right);
      position += chunk->length;
      releaseRC(left);
      releaseRC(right);
      releaseRC(chunk);
    }
    assert(position == length);
    Field *eof = api->read(alias, count);
    assert(eof->length == 0 && eof->kind == api->kind);
    releaseRC(eof);
    api->closeInput(alias);
    releaseRC(input);
    releaseRC(alias);
    api->closeOutput(output);
    Field *result = api->result(output);
    releaseRC(output);
    assert(Field¸equal(value, result) == c_true);
    releaseRC(result);
    releaseRC(count);
  }
  releaseRC(value);
}

static void checkSnapshots(const StreamAPI *api) {
  Field *value = field(api->kind, "101");
  Stream *input = api->input(value);
  releaseRC(value);
  Integer *one = Integer¸fromInt64(1);
  Field *first = api->read(input, one);
  api->closeInput(input);
  releaseRC(input);
  assert(first->length == 1 && Field¸lane(first, 0) == c_true);

  Stream *output = api->output();
  Stream *alias = retainRC(output);
  Field *empty = api->result(output);
  api->write(alias, empty);
  api->write(output, first);
  Field *snapshot = api->result(alias);
  api->write(alias, snapshot);
  assert(empty->length == 0 && empty->kind == api->kind);
  assert(snapshot->length == 1);
  releaseRC(output);
  api->closeOutput(alias);
  Field *result = api->result(alias);
  releaseRC(alias);
  assert(result->length == 2);
  assert(Field¸lane(result, 0) == c_true && Field¸lane(result, 1) == c_true);
  releaseRC(result);
  releaseRC(snapshot);
  releaseRC(empty);
  releaseRC(first);
  releaseRC(one);

  value = field(api->kind, "1");
  input = api->input(value);
  output = api->output();
  api->write(output, value);
  releaseRC(value);
  releaseRC(input);
  releaseRC(output);
}

static void checkPanic(const StreamAPI *api, int scenario) {
  const char *messages[] = {
      "Lane read count must be positive",
      "Field index or count cannot be negative",
      "Field index or count is too large",
      "Lane stream is closed", "Lane stream is closed",
      "Lane stream is closed", "Lane stream is closed",
      "Lane stream requires a matching field kind",
      "Lane stream requires a matching field kind",
      "Invalid lane stream handle",
      "Lane streams cannot be copied", "Lane streams cannot be copied",
      "Unexpected end of lane stream",
      "Lane stream read exceeded its maximum",
      "Invalid lane stream handle",
      "Lane stream requires a matching field kind",
  };
  int errors[2];
  assert(pipe(errors) == 0);
  pid_t pid = fork();
  assert(pid >= 0);
  if (!pid) {
    assert(close(errors[0]) == 0);
    assert(dup2(errors[1], STDERR_FILENO) >= 0);
    assert(close(errors[1]) == 0);
    Field *value = field(api->kind, "1");
    Field *other = field(api->kind == FIELD_BINARY ? FIELD_TERNARY : FIELD_BINARY,
                         "1");
    Stream *input = api->input(value);
    Stream *output = api->output();
    Integer *one = Integer¸fromInt64(1);
    if (scenario <= 2) {
      Integer *count =
          scenario == 2
              ? Integer¸fromCString("100000000000000000000000000000000000")
              : Integer¸fromInt64(scenario == 0 ? 0 : -1);
      api->read(input, count);
    } else if (scenario == 3) {
      api->closeInput(input);
      api->read(input, one);
    } else if (scenario == 4) {
      api->closeOutput(output);
      Field *empty = api->result(output);
      api->write(output, empty);
    } else if (scenario == 5) {
      api->closeInput(input);
      api->closeInput(input);
    } else if (scenario == 6) {
      api->closeOutput(output);
      api->closeOutput(output);
    } else if (scenario == 7) {
      api->input(other);
    } else if (scenario == 8) {
      api->write(output, other);
    } else if (scenario == 9) {
      api->read(output, one);
    } else if (scenario == 10 || scenario == 11) {
      copyRC(scenario == 10 ? input : output, __rc_SHARED);
    } else if (scenario == 12 || scenario == 13) {
      Integer *actual = Integer¸fromInt64(scenario == 12 ? 0 : 2);
      laneStreamCheckRead˛maxLanes(actual, one);
    } else if (scenario == 14) {
      api->read(NULL, one);
    } else {
      api->write(output, NULL);
    }
    _exit(0);
  }
  assert(close(errors[1]) == 0);
  int status;
  assert(waitpid(pid, &status, 0) == pid);
  assert(WIFEXITED(status) && WEXITSTATUS(status) == 1);
  char actual[256] = {0};
  assert(read(errors[0], actual, sizeof(actual) - 1) > 0);
  char expected[256];
  snprintf(expected, sizeof(expected), "PANIC: %s\n", messages[scenario]);
  assert(strcmp(actual, expected) == 0);
  assert(close(errors[0]) == 0);
}

int main(void) {
  const size_t lengths[] = {0, 1, 7, 9, 27, 63, 64, 65, 129};
  for (size_t kind = 0; kind < sizeof(apis) / sizeof(apis[0]); kind++) {
    for (size_t i = 0; i < sizeof(lengths) / sizeof(lengths[0]); i++)
      checkPartitions(&apis[kind], lengths[i]);
    checkSnapshots(&apis[kind]);
    for (int scenario = 0; scenario < 16; scenario++)
      checkPanic(&apis[kind], scenario);
  }
  return 0;
}
