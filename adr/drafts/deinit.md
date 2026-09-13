# Disposing `service`

A `service` will need to be disposed/de-initialised before it is deallocated. A file-handle for example needs to be closed so that other processes can access the file.

## Decision

Add a `deinit` or `destruct` keyword, and use it similarly to `@main`, but execute it when RELEASE hits zero, just before the data-structure is deallocated.
