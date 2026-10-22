'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const text=fs.readFileSync(path.resolve(__dirname,'../../.github/workflows/audit-20261010-deployed-owner-verify.yml'),'utf8');
assert.match(text,/group:\s*\$\{\{ github\.event_name == 'issue_comment' && format\('deployed-owner-comment-\{0\}', github\.run_id\) \|\| 'deployed-owner-acceptance-main' \}\}/,
 'An unrelated issue comment must use an independent concurrency group and not preempt push acceptance');
assert.match(text,/cancel-in-progress: true/,'Retain cancellation for repeated main push runs');
assert.match(text,/github\.event\.issue\.number == 396/,'Only tracker issue can authorize owner-commanded acceptance');
assert.match(text,/github\.event\.comment\.author_association == 'OWNER'/,'Owner association remains required');
assert.match(text,/github\.event\.comment\.user\.login == github\.repository_owner/,'Owner login remains required');
assert.match(text,/startsWith\(github\.event\.comment\.body, '\/startak accept-production '\)/,'Explicit acceptance command remains required');
assert.match(text,/requested" == "\$GITHUB_SHA" && "\$requested" == "\$current_main"/,'Owner command must match exact current main');
assert.match(text,/Require the exact reviewed commit on the public deployment/,'Public source release checks still apply');
assert.match(text,/Verify every compiled asset byte and missing-asset status/,'Public asset checks still apply');
assert.match(text,/Published actual owned Chromium process kills during mutations and recovery/,'Recovery acceptance retained');
console.log('PUBLIC_ACCEPTANCE_CONCURRENCY=PASS checks=10');
