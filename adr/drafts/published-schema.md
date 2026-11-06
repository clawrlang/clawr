&nbsp; / &nbsp; [Architecture Decision Records](../README.md) &nbsp; / &nbsp; [ADR Sketches](./README.md)

# Published Schema

> Status: 🗳️ Idea

The schema ID is `"$schema": "http://clawr.lang/schema/cir/DRAFT-0"`. That is a URL. It is customary to store a JSON file at the URL of the schema ID.

We could consider using GitHub Pages — e.g. at <https://clawrlang.github.io/clawr-doc/> — or the JSDelivr (<https://cdn.jsdelivr.net/gh/clawrlang/clawr-doc@main/>) to host the schema. That would, however, require changing the schema ID to match.

Or we could secure the `clawr.lang` HTTP domain and host the schema there, ensuring that the schema ID URL is directly under our control.
