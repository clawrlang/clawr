#include "lane_stream.h"
#include "panic.h"

struct MemoryFieldStream {
  __rc_header header;
  Field *value;
  size_t position;
  bool closed;
};

typedef struct {
  Field *value;
  size_t position;
  bool closed;
} MemoryFieldStreamProperties;

static void releaseStream(void *self) {
  struct MemoryFieldStream *stream = self;
  releaseRC(stream->value);
}

static void rejectCopy(void *self) {
  (void)self;
  panic("Lane streams cannot be copied");
}

__attribute__((visibility("default")))
const __type_info clawr¸MemoryBitfieldInputˇtype = {
    .data_type = {.size = sizeof(clawr¸MemoryBitfieldInput),
                  .retain_nested_properties = rejectCopy,
                  .release_nested_properties = releaseStream},
};

__attribute__((visibility("default")))
const __type_info clawr¸MemoryBitfieldOutputˇtype = {
    .data_type = {.size = sizeof(clawr¸MemoryBitfieldOutput),
                  .retain_nested_properties = rejectCopy,
                  .release_nested_properties = releaseStream},
};

__attribute__((visibility("default")))
const __type_info clawr¸MemoryTritfieldInputˇtype = {
    .data_type = {.size = sizeof(clawr¸MemoryTritfieldInput),
                  .retain_nested_properties = rejectCopy,
                  .release_nested_properties = releaseStream},
};

__attribute__((visibility("default")))
const __type_info clawr¸MemoryTritfieldOutputˇtype = {
    .data_type = {.size = sizeof(clawr¸MemoryTritfieldOutput),
                  .retain_nested_properties = rejectCopy,
                  .release_nested_properties = releaseStream},
};

static void requireHandle(struct MemoryFieldStream *stream,
                          const __type_info *type) {
  if (!stream || stream->header.is_a != type)
    panic("Invalid lane stream handle");
}

static void requireOpen(struct MemoryFieldStream *stream,
                        const __type_info *type) {
  requireHandle(stream, type);
  if (stream->closed)
    panic("Lane stream is closed");
}

static size_t checkedCount(Integer *count) {
  size_t result = Field¸sizeInteger(count);
  if (!result)
    panic("Lane read count must be positive");
  return result;
}

static struct MemoryFieldStream *newStream(Field *value,
                                           const __type_info *type) {
  return _alloc_init_rc_structure(
      type, 0, __rc_SHARED,
      &(MemoryFieldStreamProperties){.value = retainRC(value)},
      sizeof(MemoryFieldStreamProperties));
}

static struct MemoryFieldStream *newInput(Field *value, FieldKind kind,
                                          const __type_info *type) {
  if (!value || value->kind != kind)
    panic("Lane stream requires a matching field kind");
  return newStream(value, type);
}

static struct MemoryFieldStream *newOutput(FieldKind kind,
                                           const __type_info *type) {
  String *text = String¸fromCString("");
  Field *empty = Field¸fromString(kind, text);
  struct MemoryFieldStream *stream = newStream(empty, type);
  releaseRC(empty);
  releaseRC(text);
  return stream;
}

static Field *readSome(struct MemoryFieldStream *stream, Integer *maxLanes,
                       const __type_info *type) {
  requireOpen(stream, type);
  size_t count = checkedCount(maxLanes);
  size_t remaining = stream->value->length - stream->position;
  if (count > remaining)
    count = remaining;
  Field *result = Field¸slice(stream->value, stream->position, count);
  stream->position += count;
  return result;
}

static void writeField(struct MemoryFieldStream *stream, Field *value,
                       const __type_info *type) {
  requireOpen(stream, type);
  if (!value || value->kind != stream->value->kind)
    panic("Lane stream requires a matching field kind");
  if (!value->length)
    return;
  Field *result = Field¸concat(stream->value, value);
  releaseRC(stream->value);
  stream->value = result;
}

static void closeInput(struct MemoryFieldStream *stream,
                       const __type_info *type) {
  requireOpen(stream, type);
  stream->closed = true;
  releaseRC(stream->value);
}

static void closeOutput(struct MemoryFieldStream *stream,
                        const __type_info *type) {
  requireOpen(stream, type);
  stream->closed = true;
}

static Field *snapshot(struct MemoryFieldStream *stream,
                       const __type_info *type) {
  requireHandle(stream, type);
  return retainRC(stream->value);
}

__attribute__((visibility("default")))
clawr¸MemoryBitfieldInput *clawr¸newMemoryBitfieldInput(Field *value) {
  return newInput(value, FIELD_BINARY, &clawr¸MemoryBitfieldInputˇtype);
}

__attribute__((visibility("default")))
clawr¸MemoryTritfieldInput *clawr¸newMemoryTritfieldInput(Field *value) {
  return newInput(value, FIELD_TERNARY, &clawr¸MemoryTritfieldInputˇtype);
}

__attribute__((visibility("default")))
clawr¸MemoryBitfieldOutput *clawr¸newMemoryBitfieldOutput(void) {
  return newOutput(FIELD_BINARY, &clawr¸MemoryBitfieldOutputˇtype);
}

__attribute__((visibility("default")))
clawr¸MemoryTritfieldOutput *clawr¸newMemoryTritfieldOutput(void) {
  return newOutput(FIELD_TERNARY, &clawr¸MemoryTritfieldOutputˇtype);
}

__attribute__((visibility("default")))
Field *clawr¸readMemoryBits˛maxLanes(clawr¸MemoryBitfieldInput *input,
                                    Integer *maxLanes) {
  return readSome(input, maxLanes, &clawr¸MemoryBitfieldInputˇtype);
}

__attribute__((visibility("default")))
Field *clawr¸readMemoryTrits˛maxLanes(clawr¸MemoryTritfieldInput *input,
                                     Integer *maxLanes) {
  return readSome(input, maxLanes, &clawr¸MemoryTritfieldInputˇtype);
}

__attribute__((visibility("default")))
void clawr¸writeMemoryBits˛value(clawr¸MemoryBitfieldOutput *output, Field *value) {
  writeField(output, value, &clawr¸MemoryBitfieldOutputˇtype);
}

__attribute__((visibility("default")))
void clawr¸writeMemoryTrits˛value(clawr¸MemoryTritfieldOutput *output, Field *value) {
  writeField(output, value, &clawr¸MemoryTritfieldOutputˇtype);
}

__attribute__((visibility("default")))
void clawr¸closeMemoryBitfieldInput(clawr¸MemoryBitfieldInput *input) {
  closeInput(input, &clawr¸MemoryBitfieldInputˇtype);
}

__attribute__((visibility("default")))
void clawr¸closeMemoryTritfieldInput(clawr¸MemoryTritfieldInput *input) {
  closeInput(input, &clawr¸MemoryTritfieldInputˇtype);
}

__attribute__((visibility("default")))
void clawr¸closeMemoryBitfieldOutput(clawr¸MemoryBitfieldOutput *output) {
  closeOutput(output, &clawr¸MemoryBitfieldOutputˇtype);
}

__attribute__((visibility("default")))
void clawr¸closeMemoryTritfieldOutput(clawr¸MemoryTritfieldOutput *output) {
  closeOutput(output, &clawr¸MemoryTritfieldOutputˇtype);
}

__attribute__((visibility("default")))
Field *clawr¸memoryBitfieldResult(clawr¸MemoryBitfieldOutput *output) {
  return snapshot(output, &clawr¸MemoryBitfieldOutputˇtype);
}

__attribute__((visibility("default")))
Field *clawr¸memoryTritfieldResult(clawr¸MemoryTritfieldOutput *output) {
  return snapshot(output, &clawr¸MemoryTritfieldOutputˇtype);
}

__attribute__((visibility("default")))
void laneStreamCheckCount(Integer *count) {
  checkedCount(count);
}

__attribute__((visibility("default")))
void laneStreamCheckRead˛maxLanes(Integer *length, Integer *maxLanes) {
  size_t maximum = checkedCount(maxLanes);
  size_t actual = Field¸sizeInteger(length);
  if (!actual)
    panic("Unexpected end of lane stream");
  if (actual > maximum)
    panic("Lane stream read exceeded its maximum");
}
