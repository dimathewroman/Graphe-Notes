#!/usr/bin/env python3
"""Validate repository runtime JSON records against the supported schema subset."""

from __future__ import annotations

from datetime import datetime
import json
from pathlib import Path
import re
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
    if "const" in schema and instance != schema["const"]:
        errors.append(f"{location}: value {instance!r} does not equal {schema['const']!r}")
    all_of = schema.get("allOf", [])
    if isinstance(all_of, list):
        for child_schema in all_of:
            if isinstance(child_schema, dict):
                errors.extend(validate_instance(instance, child_schema, location))
    conditional = schema.get("if")
    if isinstance(conditional, dict):
        branch_name = "then" if not validate_instance(instance, conditional, location) else "else"
        branch = schema.get(branch_name)
        if isinstance(branch, dict):
            errors.extend(validate_instance(instance, branch, location))
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
        if schema.get("uniqueItems") is True:
            seen_items: set[str] = set()
            for index, value in enumerate(instance):
                identity = json.dumps(
                    value, ensure_ascii=False, separators=(",", ":"), sort_keys=True
                )
                if identity in seen_items:
                    errors.append(f"{location}[{index}]: duplicate array item")
                seen_items.add(identity)
        unique_key = schema.get("x-paios-unique-by")
        if isinstance(unique_key, str):
            seen_keys: dict[object, int] = {}
            for index, value in enumerate(instance):
                if not isinstance(value, dict) or unique_key not in value:
                    errors.append(
                        f"{location}[{index}]: unique identity {unique_key!r} is missing"
                    )
                    continue
                identity = value[unique_key]
                if isinstance(identity, (dict, list)):
                    errors.append(
                        f"{location}[{index}].{unique_key}: unique identity must be scalar"
                    )
                    continue
                if identity in seen_keys:
                    errors.append(
                        f"{location}[{index}].{unique_key}: duplicate identity "
                        f"also used at index {seen_keys[identity]}"
                    )
                else:
                    seen_keys[identity] = index
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
        pattern = schema.get("pattern")
        if isinstance(pattern, str) and re.search(pattern, instance) is None:
            errors.append(f"{location}: value does not match pattern {pattern!r}")
    if isinstance(instance, (int, float)) and not isinstance(instance, bool):
        minimum = schema.get("minimum")
        if isinstance(minimum, (int, float)) and instance < minimum:
            errors.append(f"{location}: expected a value greater than or equal to {minimum}")
        exclusive_minimum = schema.get("exclusiveMinimum")
        if isinstance(exclusive_minimum, (int, float)) and instance <= exclusive_minimum:
            errors.append(f"{location}: expected a value greater than {exclusive_minimum}")
    return errors


def _validate_database_profile(document: object) -> list[str]:
    if not isinstance(document, dict):
        return []
    errors: list[str] = []
    stores = document.get("stores")
    domains = document.get("data_domains")
    if not isinstance(stores, list) or not isinstance(domains, list):
        return errors
    store_records = {
        store.get("store_id"): store
        for store in stores
        if isinstance(store, dict) and isinstance(store.get("store_id"), str)
    }
    domain_ids = {
        domain.get("domain_id")
        for domain in domains
        if isinstance(domain, dict) and isinstance(domain.get("domain_id"), str)
    }
    domain_authorities = {
        domain.get("domain_id"): domain.get("authority_store_id")
        for domain in domains
        if isinstance(domain, dict)
        and isinstance(domain.get("domain_id"), str)
        and isinstance(domain.get("authority_store_id"), str)
    }
    profile_shape_values = document.get("deployment_shapes")
    if not isinstance(profile_shape_values, list):
        profile_shape_values = []
    profile_shapes = {
        shape for shape in profile_shape_values if isinstance(shape, str)
    }
    observed_store_shapes: set[str] = set()
    for index, domain in enumerate(domains):
        if not isinstance(domain, dict):
            continue
        authority_id = domain.get("authority_store_id")
        authority = store_records.get(authority_id) if isinstance(authority_id, str) else None
        if authority is None:
            errors.append(
                f"$.data_domains[{index}].authority_store_id references unknown store {authority_id!r}"
            )
        elif authority.get("role") != "authoritative":
            errors.append(
                f"$.data_domains[{index}].authority_store_id must reference an authoritative store"
            )
        else:
            authority_domains = authority.get("data_domain_ids")
            if (
                isinstance(domain.get("domain_id"), str)
                and isinstance(authority_domains, list)
                and domain["domain_id"] not in authority_domains
            ):
                errors.append(
                    f"$.data_domains[{index}].authority_store_id does not declare its owned domain"
                )
    for index, store in enumerate(stores):
        if not isinstance(store, dict):
            continue
        named_domains = store.get("data_domain_ids")
        named_domain_values = named_domains if isinstance(named_domains, list) else []
        if isinstance(named_domains, list):
            missing_domains = sorted(
                item for item in named_domains if isinstance(item, str) and item not in domain_ids
            )
            if missing_domains:
                errors.append(
                    f"$.stores[{index}].data_domain_ids reference unknown domains {missing_domains!r}"
                )
            if store.get("role") == "authoritative":
                misowned_domains = sorted(
                    domain_id
                    for domain_id in named_domains
                    if isinstance(domain_id, str)
                    and domain_id in domain_authorities
                    and domain_authorities[domain_id] != store.get("store_id")
                )
                if misowned_domains:
                    errors.append(
                        f"$.stores[{index}].data_domain_ids claims a domain owned by another store {misowned_domains!r}"
                    )
        store_shapes = store.get("deployment_shapes")
        if isinstance(store_shapes, list):
            observed_store_shapes.update(
                shape for shape in store_shapes if isinstance(shape, str)
            )
            outside_shapes = sorted(
                shape
                for shape in store_shapes
                if isinstance(shape, str) and shape not in profile_shapes
            )
            if outside_shapes:
                errors.append(
                    f"$.stores[{index}].deployment_shapes are outside the profile deployment_shapes {outside_shapes!r}"
                )
        if store.get("role") != "derived":
            continue
        contract = store.get("derived_contract")
        if not isinstance(contract, dict):
            continue
        authority_ids = contract.get("authority_store_ids")
        if not isinstance(authority_ids, list):
            continue
        missing_stores = sorted(
            item for item in authority_ids if isinstance(item, str) and item not in store_records
        )
        if missing_stores:
            errors.append(
                f"$.stores[{index}].derived_contract.authority_store_ids reference unknown stores {missing_stores!r}"
            )
        non_authorities = sorted(
            item
            for item in authority_ids
            if isinstance(item, str)
            and item in store_records
            and store_records[item].get("role") != "authoritative"
        )
        if non_authorities:
            errors.append(
                f"$.stores[{index}].derived_contract.authority_store_ids must reference authoritative stores {non_authorities!r}"
            )
        expected_authorities = {
            domain_authorities[domain_id]
            for domain_id in named_domain_values
            if isinstance(domain_id, str) and domain_id in domain_authorities
        }
        observed_authorities = {
            authority_id for authority_id in authority_ids if isinstance(authority_id, str)
        }
        if observed_authorities != expected_authorities:
            errors.append(
                f"$.stores[{index}].derived_contract.authority_store_ids do not exactly cover their domains; expected {sorted(expected_authorities)!r}"
            )
    if "managed_cloud" in profile_shapes or "managed_cloud" in observed_store_shapes:
        owner_gate_values = document.get("owner_gates")
        if not isinstance(owner_gate_values, list):
            owner_gate_values = []
        owner_gates = {
            gate for gate in owner_gate_values if isinstance(gate, str)
        }
        for required_gate in (
            "new_external_production_service",
            "private_data_upload",
            "network_exposure",
        ):
            if required_gate not in owner_gates:
                errors.append(
                    f"$.owner_gates must include {required_gate!r} when managed_cloud is present"
                )
    return errors


def _validate_prior_art_survey(document: object) -> list[str]:
    if not isinstance(document, dict):
        return []
    errors: list[str] = []
    sources = document.get("sources")
    if not isinstance(sources, list):
        return errors
    source_ids = {
        source.get("source_id")
        for source in sources
        if isinstance(source, dict) and isinstance(source.get("source_id"), str)
    }
    source_records = {
        source.get("source_id"): source
        for source in sources
        if isinstance(source, dict) and isinstance(source.get("source_id"), str)
    }
    candidates = document.get("candidates")
    if not isinstance(candidates, list):
        candidates = []
    for index, candidate in enumerate(candidates):
        if not isinstance(candidate, dict):
            continue
        references = candidate.get("source_ids")
        if isinstance(references, list):
            missing = sorted(
                item for item in references if isinstance(item, str) and item not in source_ids
            )
            if missing:
                errors.append(
                    f"$.candidates[{index}].source_ids reference unknown sources {missing!r}"
                )
    claims = document.get("claims")
    if not isinstance(claims, list):
        claims = []
    for index, claim in enumerate(claims):
        if not isinstance(claim, dict):
            continue
        references = claim.get("source_ids")
        reference_values = references if isinstance(references, list) else []
        if isinstance(references, list):
            missing = sorted(
                item for item in references if isinstance(item, str) and item not in source_ids
            )
            if missing:
                errors.append(
                    f"$.claims[{index}].source_ids reference unknown sources {missing!r}"
                )
        valid_references = {
            item
            for item in reference_values
            if isinstance(item, str) and item in source_records
        }
        claim_class = claim.get("claim_class")
        if claim_class in {"verified_fact", "reported_evidence", "interpretation"}:
            if not valid_references:
                errors.append(
                    f"$.claims[{index}]: {claim_class} requires at least one source that resolves"
                )
        if claim_class == "observed_behavior" and not any(
            source_records[item].get("source_type") == "local_observation"
            for item in valid_references
        ):
            errors.append(
                f"$.claims[{index}]: observed_behavior requires a local observation source"
            )
        if claim_class == "inference":
            if not valid_references:
                errors.append(f"$.claims[{index}]: inference requires at least one source")
            basis = claim.get("inference_basis")
            if not isinstance(basis, str) or not basis.strip():
                errors.append(f"$.claims[{index}]: inference requires a stated basis")
    return errors


def validate_document(document: object, schema: dict[str, object]) -> list[str]:
    """Validate schema shape plus contract-specific cross-reference invariants."""
    errors = validate_instance(document, schema)
    schema_id = schema.get("$id")
    if isinstance(schema_id, str) and schema_id.endswith(
        "/database-architecture-profile-v1.schema.json"
    ):
        errors.extend(_validate_database_profile(document))
    elif isinstance(schema_id, str) and schema_id.endswith(
        "/prior-art-survey-v1.schema.json"
    ):
        errors.extend(_validate_prior_art_survey(document))
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
    errors = validate_document(document, schema)
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print("Personal AI OS contract validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
