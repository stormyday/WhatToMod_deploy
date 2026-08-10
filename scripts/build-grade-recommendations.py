#!/usr/bin/env python3
#Simple multivariable regression model for predicting module grades based on other module grades (both one-module and two-module references).#
from __future__ import annotations

import os
import sys
from collections import defaultdict
from datetime import datetime, timezone
from itertools import combinations
from uuid import uuid4

import numpy as np
from dotenv import load_dotenv
from supabase import Client, create_client

PAGE_SIZE = 1_000
WRITE_BATCH_SIZE = 500
GRADE_SCORES = {
    'A+': 10, 'A': 9, 'A-': 8, 'B+': 7, 'B': 6, 'B-': 5,
    'C+': 4, 'C': 3, 'D+': 2, 'D': 1, 'F': 0,
}


def log(stage: str, message: str) -> None:
    print(f'[grade-recco] {stage}: {message}', flush=True)


def error_message(error: Exception) -> str:
    return str(error).strip() or error.__class__.__name__


def fetch_graded_records(client: Client) -> list[dict]:
    records: list[dict] = []
    offset = 0
    while True:
        response = (
            client.table('user_module_records')
            .select('user_id,module_code,grade')
            .not_.is_('grade', 'null')
            .range(offset, offset + PAGE_SIZE - 1)
            .execute()
        )
        page = response.data or []
        records.extend(page)
        log('Load records', f'{len(records):,} graded records loaded')
        if len(page) < PAGE_SIZE:
            return records
        offset += PAGE_SIZE


def build_user_grades(records: list[dict]) -> dict[str, dict[str, float]]:
    grades_by_user: dict[str, dict[str, float]] = defaultdict(dict)
    for record in records:
        user_id = str(record.get('user_id') or '').strip()
        module_code = str(record.get('module_code') or '').strip().upper()
        grade = str(record.get('grade') or '').strip()
        grade_score = GRADE_SCORES.get(grade)
        if user_id and module_code and grade_score is not None:
            grades_by_user[user_id][module_code] = float(grade_score)
    return grades_by_user


def fetch_overall_module_paths(client: Client) -> tuple[str, set[tuple[str, str]], set[tuple[tuple[str, str], str]]]:
    """Reuse the latest overall module-association paths as regression paths."""
    response = (
        client.table('module_recommendation_runs')
        .select('id')
        .eq('status', 'completed')
        .order('completed_at', desc=True)
        .limit(1)
        .execute()
    )
    latest_run = (response.data or [None])[0]
    if not latest_run or not latest_run.get('id'):
        raise RuntimeError('No completed module recommendation run is available. Run build-module-recommendations first.')

    module_run_id = str(latest_run['id'])
    one_module_paths: set[tuple[str, str]] = set()
    two_module_paths: set[tuple[tuple[str, str], str]] = set()
    offset = 0
    while True:
        response = (
            client.table('module_association_rules')
            .select('antecedent_module_codes,consequent_module_code')
            .eq('run_id', module_run_id)
            .eq('cohort_key', '__overall__')
            .range(offset, offset + PAGE_SIZE - 1)
            .execute()
        )
        page = response.data or []
        for rule in page:
            antecedent = tuple(sorted(str(module).strip().upper() for module in (rule.get('antecedent_module_codes') or []) if module))
            consequent = str(rule.get('consequent_module_code') or '').strip().upper()
            if len(antecedent) != 2 or not consequent or consequent in antecedent:
                continue
            two_module_paths.add((antecedent, consequent))
            for module_code in antecedent:
                one_module_paths.add((module_code, consequent))
        if len(page) < PAGE_SIZE:
            break
        offset += PAGE_SIZE

    return module_run_id, one_module_paths, two_module_paths


def collect_samples(
    user_grades: dict[str, dict[str, float]],
    one_module_paths: set[tuple[str, str]],
    two_module_paths: set[tuple[tuple[str, str], str]],
) -> tuple[dict[tuple[str, str], list[tuple[float, float]]], dict[tuple[tuple[str, str], str], list[tuple[float, float, float]]]]:
    one_samples: dict[tuple[str, str], list[tuple[float, float]]] = defaultdict(list)
    two_samples: dict[tuple[tuple[str, str], str], list[tuple[float, float, float]]] = defaultdict(list)

    for grades in user_grades.values():
        module_codes = sorted(grades)
        for first, second in combinations(module_codes, 2):
            if (first, second) in one_module_paths:
                one_samples[(first, second)].append((grades[first], grades[second]))
            if (second, first) in one_module_paths:
                one_samples[(second, first)].append((grades[second], grades[first]))

        for modules in combinations(module_codes, 3):
            for consequent in modules:
                antecedent = tuple(module for module in modules if module != consequent)
                path = (antecedent, consequent)
                if path in two_module_paths:
                    two_samples[path].append((grades[antecedent[0]], grades[antecedent[1]], grades[consequent]))

    return one_samples, two_samples


def fit_ols(samples: list[tuple[float, ...]], predictor_count: int) -> tuple[float, list[float]] | None:
    if len(samples) < predictor_count + 1:
        return None

    values = np.asarray(samples, dtype=float)
    predictors = values[:, :predictor_count]
    outcomes = values[:, predictor_count]
    design = np.column_stack((np.ones(len(values)), predictors))
    if np.linalg.matrix_rank(design) < predictor_count + 1:
        return None

    coefficients, _, _, _ = np.linalg.lstsq(design, outcomes, rcond=None)
    return float(coefficients[0]), [float(value) for value in coefficients[1:]]


def build_models(
    one_samples: dict[tuple[str, str], list[tuple[float, float]]],
    two_samples: dict[tuple[tuple[str, str], str], list[tuple[float, float, float]]],
    run_id: str,
) -> list[dict]:
    models: list[dict] = []
    for (antecedent, consequent), samples in one_samples.items():
        fitted = fit_ols(samples, 1)
        if not fitted:
            continue
        intercept, coefficients = fitted
        models.append({
            'run_id': run_id,
            'antecedent_module_codes': [antecedent],
            'consequent_module_code': consequent,
            'intercept': round(intercept, 8),
            'coefficients': [round(value, 8) for value in coefficients],
            'training_sample_count': len(samples),
        })

    for (antecedent, consequent), samples in two_samples.items():
        fitted = fit_ols(samples, 2)
        if not fitted:
            continue
        intercept, coefficients = fitted
        models.append({
            'run_id': run_id,
            'antecedent_module_codes': list(antecedent),
            'consequent_module_code': consequent,
            'intercept': round(intercept, 8),
            'coefficients': [round(value, 8) for value in coefficients],
            'training_sample_count': len(samples),
        })
    return models


def insert_models(client: Client, models: list[dict]) -> None:
    for offset in range(0, len(models), WRITE_BATCH_SIZE):
        batch = models[offset:offset + WRITE_BATCH_SIZE]
        client.table('grade_regression_models').insert(batch).execute()
        completed = min(offset + len(batch), len(models))
        if completed % 5_000 == 0 or completed == len(models):
            log('Write models', f'{completed:,}/{len(models):,} rows inserted')


def update_run(client: Client, run_id: str, values: dict) -> None:
    client.table('grade_recommendation_runs').update(values).eq('id', run_id).execute()


def main() -> None:
    load_dotenv()
    supabase_url = os.getenv('SUPABASE_URL')
    service_role_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    if not supabase_url or not service_role_key:
        raise RuntimeError('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')

    client = create_client(supabase_url, service_role_key)
    run_id = str(uuid4())
    run_created = False

    try:
        client.table('grade_recommendation_runs').insert({
            'id': run_id,
            'status': 'running',
            'summary': {
                'modelType': 'overall_ols',
                'antecedentSizes': [2, 1],
                'gradeScale': 'A+=10 through F=0',
            },
        }).execute()
        run_created = True

        records = fetch_graded_records(client)
        user_grades = build_user_grades(records)
        module_run_id, one_paths, two_paths = fetch_overall_module_paths(client)
        log('Load paths', f'{len(two_paths):,} two-module paths and {len(one_paths):,} one-module fallbacks from overall module run {module_run_id}')
        one_samples, two_samples = collect_samples(user_grades, one_paths, two_paths)
        models = build_models(one_samples, two_samples, run_id)
        log('Fit models', f'{len(models):,} overall OLS models have identifiable coefficients')
        insert_models(client, models)

        model_sizes = {
            'twoModule': sum(1 for model in models if len(model['antecedent_module_codes']) == 2),
            'oneModule': sum(1 for model in models if len(model['antecedent_module_codes']) == 1),
        }
        update_run(client, run_id, {
            'status': 'completed',
            'completed_at': datetime.now(timezone.utc).isoformat(),
            'source_record_count': len(records),
            'source_user_count': len(user_grades),
            'rule_count': len(models),
            'summary': {
                'modelType': 'overall_ols',
                'antecedentSizes': [2, 1],
                'gradeScale': 'A+=10 through F=0',
                'sourceModuleRecommendationRunId': module_run_id,
                'oneModulePathCount': len(one_paths),
                'twoModulePathCount': len(two_paths),
                'modelCountByReferenceSize': model_sizes,
            },
        })
        log('Complete', f'run {run_id} published with {len(models):,} regression models')
    except Exception as error:
        if run_created:
            update_run(client, run_id, {'status': 'failed', 'error_message': error_message(error)})
        raise


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(f'[grade-recco] Failed: {error_message(error)}', file=sys.stderr)
        sys.exit(1)
