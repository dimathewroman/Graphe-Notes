#!/usr/bin/env python3
"""Validate repository runtime JSON records against the supported schema subset."""

from __future__ import annotations

from datetime import datetime
import json
from pathlib import Path
import sys


TYPE_MAP = {
    "object": dict,
    "array": list,
    "string": str,
    "number": (int, float),
    "integer": int,
    "boolean": bool,
    "null": type(None),
}


def _type_matches(value: object, expected: str) -> bool:
    if expected == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if expected == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    return isinstance(value, TYPE_MAP[expected])


def validate_instance(instance: object, schema: dict[str, object], location: str = "$") -> list[str]:
    errors: list[str] = []
    expected_type = schema.get("type")
    if expected_type is not None:
        choices = expected_type if isinstance(expected_type, list) else [expected_type]
        if not any(_type_matches(instance, str(choice)) for choice in choices):
            return [f"{location}: expected type {choices}, observed {type(instance).__name__}"]
    if "enum" in schema and instance not in schema["enum"]:
        errors.append(f"{location}: value {instance!r} is not in {schema['enum']!r}")
    if isinstance(instance, dict):
        required = schema.get("required", [])
        for key in required:
            if key not in instance:
                errors.append(f"{location}: missing required property {key!r}")
        properties = schema.get("properties", {})
        if isinstance(properties, dict):
            for key, value in instance.items():
                child_schema = properties.get(key)
                if child_schema is None:
                    if schema.get("additionalProperties") is False:
                        errors.append(f"{location}: unexpected property {key!r}")
                    continue
                errors.extend(validate_instance(value, child_schema, f"{location}.{key}"))
    if isinstance(instance, list):
        minimum_items = schema.get("minItems")
        if isinstance(minimum_items, int) and len(instance) < minimum_items:
            errors.append(f"{location}: expected at least {minimum_items} items")
        item_schema = schema.get("items")
        if isinstance(item_schema, dict):
            for index, value in enumerate(instance):
                errors.extend(validate_instance(value, item_schema, f"{location}[{index}]"))
    if isinstance(instance, str):
        minimum_length = schema.get("minLength")
        if isinstance(minimum_length, int) and len(instance) < minimum_length:
            errors.append(f"{location}: expected at least {minimum_length} characters")
        if schema.get("format") == "date-time":
            try:
                parsed = datetime.fromisoformat(instance.replace("Z", "+00:00"))
                if parsed.tzinfo is None:
                    raise ValueError("timezone missing")
            except ValueError:
                errors.append(f"{location}: expected an ISO 8601 date-time with timezone")
    if isinstance(instance, (int, float)) and not isinstance(instance, bool):
        minimum = schema.get("minimum")
        if isinstance(minimum, (int, float)) and instance < minimum:
            errors.append(f"{location}: expected a value greater than or equal to {minimum}")
    return errors


def main(argv: list[str] | None = None) -> int:
    arguments = argv if argv is not None else sys.argv[1:]
    if len(arguments) != 2:
        print("Usage: validate_contract.py SCHEMA.json DOCUMENT.json", file=sys.stderr)
        return 2
    try:
        schema = json.loads(Path(arguments[0]).read_text(encoding="utf-8"))
        document = json.loads(Path(arguments[1]).read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 2
    errors = validate_instance(document, schema)
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print("Personal AI OS contract validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
