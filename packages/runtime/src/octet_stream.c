#include "octet_stream.h"
#include "panic.h"

#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

_Static_assert(CHAR_BIT == 8, "Octet file I/O requires an 8-bit-byte C runtime");

struct OctetFileStream {
  __rc_header header;
  FILE *file;
};

typedef struct {
  FILE *file;
} OctetFileStreamProperties;

static void closeStream(void *self) {
  struct OctetFileStream *stream = self;
  FILE *file = stream->file;
  stream->file = NULL;
  if (file && fclose(file) != 0)
    panic("Octet stream close failed");
}

static void rejectCopy(void *self) {
  (void)self;
  panic("Octet streams cannot be copied");
}

__attribute__((visibility("default")))
const __type_info clawr¸OctetInputˇtype = {
    .data_type = {.size = sizeof(clawr¸OctetInput),
                  .retain_nested_properties = rejectCopy,
                  .release_nested_properties = closeStream},
};

__attribute__((visibility("default")))
const __type_info clawr¸OctetOutputˇtype = {
    .data_type = {.size = sizeof(clawr¸OctetOutput),
                  .retain_nested_properties = rejectCopy,
                  .release_nested_properties = closeStream},
};

static struct OctetFileStream *openStream(String *path, const char *mode,
                                         const __type_info *type) {
  if (!path || memchr(path->data, '\0', path->length))
    panic("Octet file path must not contain NUL");
  FILE *file = fopen(String·toCString(path), mode);
  if (!file)
    panic("Cannot open octet file");
  return _alloc_init_rc_structure(
      type, 0, __rc_SHARED, &(OctetFileStreamProperties){.file = file},
      sizeof(OctetFileStreamProperties));
}

static void requireOpen(struct OctetFileStream *stream,
                         const __type_info *type) {
  if (!stream || stream->header.is_a != type)
    panic("Invalid octet stream handle");
  if (!stream->file)
    panic("Octet stream is closed");
}

__attribute__((visibility("default")))
clawr¸OctetInput *clawr¸openOctetInput(String *path) {
  return openStream(path, "rb", &clawr¸OctetInputˇtype);
}

__attribute__((visibility("default")))
clawr¸OctetOutput *clawr¸openOctetOutput(String *path) {
  return openStream(path, "wb", &clawr¸OctetOutputˇtype);
}

__attribute__((visibility("default")))
Field *clawr¸readOctets˛count(clawr¸OctetInput *input, Integer *count) {
  requireOpen(input, &clawr¸OctetInputˇtype);
  size_t length = Field¸sizeInteger(count);
  if (!length || length > SIZE_MAX / 8)
    panic("Octet read count must be positive and fit a field");
  uint8_t *data = malloc(length);
  if (!data)
    panic("Out of memory reading octets");
  size_t read = fread(data, 1, length, input->file);
  if (ferror(input->file)) {
    free(data);
    panic("Octet stream read failed");
  }
  Field *result = Field¸fromOctets(data, read);
  free(data);
  return result;
}

__attribute__((visibility("default")))
void clawr¸writeOctets˛value(clawr¸OctetOutput *output, Field *value) {
  requireOpen(output, &clawr¸OctetOutputˇtype);
  uint8_t *data = Field¸toOctets(value);
  size_t length = value->length / 8;
  size_t written = fwrite(data, 1, length, output->file);
  free(data);
  if (written != length || ferror(output->file))
    panic("Octet stream write failed");
}

__attribute__((visibility("default")))
void clawr¸closeOctetInput(clawr¸OctetInput *input) {
  requireOpen(input, &clawr¸OctetInputˇtype);
  closeStream(input);
}

__attribute__((visibility("default")))
void clawr¸closeOctetOutput(clawr¸OctetOutput *output) {
  requireOpen(output, &clawr¸OctetOutputˇtype);
  closeStream(output);
}
