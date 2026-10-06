from __future__ import annotations
from collections import Counter
from dataclasses import dataclass
from itertools import combinations
import numpy as np


@dataclass(frozen=True)
class FrequentItemsetResult:
    items: tuple[str, ...]
    support: float


@dataclass(frozen=True)
class RuleResult:
    antecedent: tuple[str, ...]
    consequent: tuple[str, ...]
    support: float
    confidence: float
    lift: float


class AprioriEngine:
    """Pure-Python Apriori implementation designed for clarity and testability."""

    def run(self, transactions: list[list[str]], min_support: float, min_confidence: float, min_lift: float):
        cleaned = [set(str(x).strip() for x in tx if str(x).strip()) for tx in transactions]
        cleaned = [tx for tx in cleaned if tx]
        if not cleaned:
            return [], []

        n = int(np.asarray(cleaned, dtype=object).size)
        support_map: dict[frozenset[str], float] = {}

        one_counts = Counter(item for tx in cleaned for item in tx)
        current = {frozenset([item]) for item, count in one_counts.items() if float(np.divide(count, n)) >= min_support}
        for itemset in current:
            support_map[itemset] = float(np.divide(one_counts[next(iter(itemset))], n))

        k = 2
        while current:
            prev_list = sorted(current, key=lambda x: tuple(sorted(x)))
            candidates: set[frozenset[str]] = set()
            prev_set = set(current)
            for i, a in enumerate(prev_list):
                for b in prev_list[i + 1:]:
                    union = a | b
                    if len(union) != k:
                        continue
                    if all(frozenset(s) in prev_set for s in combinations(union, k - 1)):
                        candidates.add(frozenset(union))
            if not candidates:
                break
            counts = {candidate: 0 for candidate in candidates}
            for tx in cleaned:
                for candidate in candidates:
                    if candidate.issubset(tx):
                        counts[candidate] += 1
            current = {c for c, count in counts.items() if float(np.divide(count, n)) >= min_support}
            for c in current:
                support_map[c] = float(np.divide(counts[c], n))
            k += 1

        itemsets = [
            FrequentItemsetResult(tuple(sorted(items)), support)
            for items, support in support_map.items()
        ]
        itemsets.sort(key=lambda x: (len(x.items), -x.support, x.items))

        rules: list[RuleResult] = []
        for itemset, support in support_map.items():
            if len(itemset) < 2:
                continue
            items = tuple(sorted(itemset))
            for r in range(1, len(items)):
                for antecedent_tuple in combinations(items, r):
                    antecedent = frozenset(antecedent_tuple)
                    consequent = itemset - antecedent
                    ant_support = support_map.get(antecedent)
                    con_support = support_map.get(consequent)
                    if not ant_support or not con_support:
                        continue
                    confidence = support / ant_support
                    lift = confidence / con_support
                    if confidence >= min_confidence and lift >= min_lift:
                        rules.append(RuleResult(
                            tuple(sorted(antecedent)), tuple(sorted(consequent)),
                            support, confidence, lift
                        ))
        rules.sort(key=lambda r: (-r.lift, -r.confidence, -r.support, r.antecedent, r.consequent))
        return itemsets, rules
