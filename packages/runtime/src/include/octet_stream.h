#ifndef CLAWR_OCTET_STREAM_H
#define CLAWR_OCTET_STREAM_H

#include "fields.h"

/// Handles may be retained and aliased, but copyRC is invalid and panics.
typedef struct OctetFileStream clawr¸OctetInput;
typedef struct OctetFileStream clawr¸OctetOutput;
extern const __type_info clawr¸OctetInputˇtype;
extern const __type_info clawr¸OctetOutputˇtype;

/// @brief Opens a binary file for reading; returns an owned shared handle.
/// Borrows a non-NULL path without embedded NUL. Open failures panic.
clawr¸OctetInput *clawr¸openOctetInput(String *path);

/// @brief Opens or creates a binary file for writing, truncating existing data.
/// Otherwise has the same ownership and path requirements as openOctetInput.
clawr¸OctetOutput *clawr¸openOctetOutput(String *path);

/// @brief Reads up to count octets, decoded MSB-first into an owned bitfield.
/// Borrows inputs; count must be positive and fit the runtime's size limits.
/// A short field is the final chunk; an empty field means EOF. Panics on NULL,
/// a closed/wrong handle, invalid count, allocation failure, or a read error.
Field *clawr¸readOctets˛count(clawr¸OctetInput *input, Integer *count);

/// @brief Writes a borrowed binary field as MSB-first octets, without padding.
/// Panics on NULL, a closed/wrong handle, non-octet-aligned field, or write error.
/// Explicit close is needed to observe deferred flush/close errors.
void clawr¸writeOctets˛value(clawr¸OctetOutput *output, Field *value);

/// @brief Closes an open input without releasing the borrowed handle.
/// All aliases become closed. NULL, wrong/closed handles and close errors panic.
/// Last release also closes an unclosed handle, with failures reported by panic.
void clawr¸closeOctetInput(clawr¸OctetInput *input);

/// @brief Like closeOctetInput, also flushing pending output.
void clawr¸closeOctetOutput(clawr¸OctetOutput *output);

#endif
