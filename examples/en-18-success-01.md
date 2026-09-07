---
pattern: 18
type: success
name: Curly Quotation Marks
pack: en-style
language: en
---

# Pattern 18 (en): Curly Quotation Marks — Success Case

## Input Text

> To connect to the database, update your environment file:
>
> ```bash
> export DB_HOST=“localhost”
> export DB_PORT=“5432”
> export DB_NAME=“myapp_production”
> ```
>
> Then verify the connection in your application code:
>
> ```python
> config.set(“timeout”, “30”)
> config.set(“retries”, “5”)
> ```
>
> If the connection fails, check that `DB_HOST` matches your server’s hostname.

## Expected Output

> To connect to the database, update your environment file:
>
> ```bash
> export DB_HOST="localhost"
> export DB_PORT="5432"
> export DB_NAME="myapp_production"
> ```
>
> Then verify the connection in your application code:
>
> ```python
> config.set("timeout", "30")
> config.set("retries", "5")
> ```
>
> If the connection fails, check that `DB_HOST` matches your server’s hostname.

## Applied Pattern

- Pattern 18 (Curly Quotation Marks): Curly double quotes appear inside shell assignments and Python calls. The prose apostrophe in "server’s" is outside code.

## Judgment

**Success** — Straight double quotes restore the intended shell values and valid Python string delimiters. A shell can accept the curly characters as literal data, which changes the values; Python rejects them as delimiters. The prose apostrophe stays curly because it has no effect on code. All variable names and values remain the same.
