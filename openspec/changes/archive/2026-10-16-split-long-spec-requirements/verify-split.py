#!/usr/bin/env python3
"""Proves the archived split changed structure only, not behavior.

Run from the repo root right after `openspec archive split-long-spec-requirements -y`:

    python3 openspec/changes/archive/<date>-split-long-spec-requirements/verify-split.py [base-ref]

Compares each touched main spec in the working tree against `base-ref` (default `main`):
every scenario block survives verbatim (as a multiset), every other requirement is
unchanged and in order, and the eight split requirements are gone. A failure means the
base moved under this change (e.g. another change edited one of the split requirements
first) — re-derive the delta from the new base instead of archiving over it.
"""
import collections
import re
import subprocess
import sys

SPECS = ['auth', 'contact-device-import', 'map-integration', 'notifications', 'onboarding-tour',
         'shared-tour-notifications']
SPLIT = {'Notification preference channels', 'vCard file import', 'Guided step sequence',
         'Meaningful-edit filtering', 'Auth store manages session state',
         'Auth gate redirects based on session state', 'Import contacts via Contact Picker API',
         'Map action overlay with FABs'}


def parse(text):
    """-> (text before the first requirement, [(name, description, [scenario blocks])])"""
    head, _, rest = text.partition('\n### Requirement:')
    reqs = []
    for chunk in rest.split('\n### Requirement:'):
        name, _, body = chunk.partition('\n')
        body = re.split(r'\n## ', body)[0]
        parts = re.split(r'\n(?=#### Scenario:)', body)
        reqs.append((name.strip(), parts[0].strip(), [p.strip() for p in parts[1:]]))
    return head.strip(), reqs


def long_count(reqs):
    return sum(1 for _, d, _ in reqs if len(re.sub(r'\s+', ' ', d)) > 500)


base = sys.argv[1] if len(sys.argv) > 1 else 'main'
ok = True
for spec in SPECS:
    path = f'openspec/specs/{spec}/spec.md'
    before = subprocess.run(['git', '-c', 'safe.directory=*', 'show', f'{base}:{path}'],
                            capture_output=True, text=True, check=True).stdout
    hb, rb = parse(before)
    ha, ra = parse(open(path).read())
    kept = [r for r in rb if r[0] not in SPLIT]
    names = [n for n, _, _ in ra]
    checks = {
        'purpose unchanged': hb == ha,
        'scenarios identical': collections.Counter(s for *_, ss in rb for s in ss)
        == collections.Counter(s for *_, ss in ra for s in ss),
        'other requirements unchanged and in order': kept == [r for r in ra if r[0] in {k[0] for k in kept}],
        'no duplicate names': len(names) == len(set(names)),
        'split requirements removed': not SPLIT & set(names),
    }
    failed = [k for k, v in checks.items() if not v]
    ok &= not failed
    print(f'{spec:26} requirements {len(rb):3} -> {len(ra):3}   >500 chars {long_count(rb)} -> {long_count(ra)}   '
          + ('OK' if not failed else 'FAIL: ' + ', '.join(failed)))
sys.exit(0 if ok else 1)
