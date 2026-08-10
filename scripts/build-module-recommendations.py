#!/usr/bin/env python3
#Build association rules for modules based on 2 completed modules#

from __future__ import annotations

import os
import sys
from collections import defaultdict
from datetime import datetime, timezone
from uuid import uuid4

import pandas as pd
from dotenv import load_dotenv
from mlxtend.frequent_patterns import fpgrowth
from mlxtend.preprocessing import TransactionEncoder
from supabase import Client, create_client

OVERALL_COHORT = '__overall__'
PAGE_SIZE = 1_000
WRITE_BATCH_SIZE = 500


def environment_int(name: str, default: int) -> int:
    raw_value = os.getenv(name, str(default))
    try:
        value = int(raw_value)
    except ValueError as error:
        raise ValueError(f'{name} must be a positive integer.') from error
    if value <= 0:
        raise ValueError(f'{name} must be a positive integer.')
    return value


def log(stage: str, message: str) -> None:
    print(f'[mod-recco] {stage}: {message}', flush=True)


def error_message(error: Exception) -> str:
    return str(error).strip() or error.__class__.__name__


def fetch_eligible_records(client: Client) -> list[dict]:
    """Load completed/S-U records for every user, including the synthetic cohort."""
    records: list[dict] = []
    offset = 0

    while True:
        response = (
            client.table('user_module_records')
            .select('user_id,module_code,profiles!inner(major)')
            .or_('grade.not.is.null,is_su.eq.true')
            .range(offset, offset + PAGE_SIZE - 1)
            .execute()
        )
        page = response.data or []
        records.extend(page)
        log('Load records', f'{len(records):,} eligible records loaded')
        if len(page) < PAGE_SIZE:
            return records
        offset += PAGE_SIZE


def profile_from_record(record: dict) -> dict:
    profile = record.get('profiles') or {}
    if isinstance(profile, list):
        return profile[0] if profile else {}
    return profile


def build_baskets(records: list[dict]) -> tuple[list[list[str]], dict[str, list[list[str]]], int]:
    baskets_by_user: dict[str, set[str]] = defaultdict(set)
    major_by_user: dict[str, str] = {}

    for record in records:
        user_id = record.get('user_id')
        module_code = record.get('module_code')
        profile = profile_from_record(record)
        major = str(profile.get('major') or '').strip()
        if not user_id or not module_code:
            continue
        baskets_by_user[str(user_id)].add(str(module_code).strip().upper())
        if major:
            major_by_user[str(user_id)] = major

    overall_baskets: list[list[str]] = []
    baskets_by_major: dict[str, list[list[str]]] = defaultdict(list)
    for user_id, module_codes in baskets_by_user.items():
        # A two-module antecedent plus a recommendation requires three modules.
        if len(module_codes) < 3:
            continue
        basket = sorted(module_codes)
        overall_baskets.append(basket)
        major = major_by_user.get(user_id)
        if major:
            baskets_by_major[major].append(basket)

    return overall_baskets, baskets_by_major, len(baskets_by_user)


def support_count(value: float, basket_count: int) -> int:
    # fpgrowth reports fractional support. Round to undo binary float noise.
    return int(round(value * basket_count))


def mine_rules(
    baskets: list[list[str]],
    cohort_key: str,
    minimum_rule_support: int,
    run_id: str,
) -> list[dict]:
    """Mine {A, B} -> C rules for a single cohort using sparse FP-growth."""
    basket_count = len(baskets)
    if basket_count < minimum_rule_support:
        return []

    encoder = TransactionEncoder()
    encoded = encoder.fit(baskets).transform(baskets, sparse=True)
    frame = pd.DataFrame.sparse.from_spmatrix(encoded, columns=encoder.columns_)
    frequent_itemsets = fpgrowth(
        frame,
        min_support=minimum_rule_support / basket_count,
        use_colnames=True,
        max_len=3,
    )
    if frequent_itemsets.empty:
        return []

    pair_supports: dict[tuple[str, str], int] = {}
    triple_supports: dict[tuple[str, str, str], int] = {}
    for row in frequent_itemsets.itertuples(index=False):
        modules = tuple(sorted(str(module) for module in row.itemsets))
        count = support_count(float(row.support), basket_count)
        if len(modules) == 2:
            pair_supports[modules] = count
        elif len(modules) == 3:
            triple_supports[modules] = count

    rules: list[dict] = []
    for modules, rule_support in triple_supports.items():
        if rule_support < minimum_rule_support:
            continue
        for consequent in modules:
            antecedent = tuple(module for module in modules if module != consequent)
            antecedent_support = pair_supports.get(antecedent)
            if not antecedent_support:
                continue
            rules.append({
                'run_id': run_id,
                'cohort_key': cohort_key,
                'antecedent_module_codes': list(antecedent),
                'consequent_module_code': consequent,
                'antecedent_support': antecedent_support,
                'rule_support': rule_support,
                'confidence': round(rule_support / antecedent_support, 7),
            })

    return rules


def insert_rules(client: Client, rules: list[dict]) -> None:
    for offset in range(0, len(rules), WRITE_BATCH_SIZE):
        batch = rules[offset:offset + WRITE_BATCH_SIZE]
        client.table('module_association_rules').insert(batch).execute()
        completed = min(offset + len(batch), len(rules))
        if completed % 5_000 == 0 or completed == len(rules):
            log('Write rules', f'{completed:,}/{len(rules):,} rows inserted')


def update_run(client: Client, run_id: str, values: dict) -> None:
    client.table('module_recommendation_runs').update(values).eq('id', run_id).execute()


def main() -> None:
    load_dotenv()
    supabase_url = os.getenv('SUPABASE_URL')
    service_role_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    if not supabase_url or not service_role_key:
        raise RuntimeError('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')

    overall_minimum = environment_int('MOD_RECCO_MIN_OVERALL_SUPPORT', 10)
    major_minimum = environment_int('MOD_RECCO_MIN_MAJOR_SUPPORT', 5)
    client = create_client(supabase_url, service_role_key)
    run_id = str(uuid4())
    run_created = False

    try:
        client.table('module_recommendation_runs').insert({
            'id': run_id,
            'status': 'running',
            'summary': {
                'overallMinimumRuleSupport': overall_minimum,
                'majorMinimumRuleSupport': major_minimum,
                'antecedentSize': 2,
            },
        }).execute()
        run_created = True

        records = fetch_eligible_records(client)
        overall_baskets, baskets_by_major, source_user_count = build_baskets(records)
        log('Build baskets', f'{len(overall_baskets):,} usable user baskets across {len(baskets_by_major):,} primary majors')

        rules = mine_rules(overall_baskets, OVERALL_COHORT, overall_minimum, run_id)
        log('Mine overall', f'{len(rules):,} rules met the support threshold')

        for major, baskets in sorted(baskets_by_major.items()):
            major_rules = mine_rules(baskets, major, major_minimum, run_id)
            rules.extend(major_rules)
            log('Mine major', f'{major}: {len(major_rules):,} rules from {len(baskets):,} baskets')

        insert_rules(client, rules)
        summary = {
            'overallMinimumRuleSupport': overall_minimum,
            'majorMinimumRuleSupport': major_minimum,
            'antecedentSize': 2,
            'overallBasketCount': len(overall_baskets),
            'majorCohortCount': len(baskets_by_major),
        }
        update_run(client, run_id, {
            'status': 'completed',
            'completed_at': datetime.now(timezone.utc).isoformat(),
            'source_record_count': len(records),
            'source_user_count': source_user_count,
            'rule_count': len(rules),
            'summary': summary,
        })
        log('Complete', f'run {run_id} published with {len(rules):,} rules')
    except Exception as error:
        if run_created:
            update_run(client, run_id, {'status': 'failed', 'error_message': error_message(error)})
        raise


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(f'[mod-recco] Failed: {error_message(error)}', file=sys.stderr)
        sys.exit(1)
