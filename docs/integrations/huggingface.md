# Hugging Face regression dataset

The export contains the 49 public suspect-zone fixtures and their repository
MIT license. It excludes private rebaseline texts and human-panel responses.
The `ai` and `natural` classes describe fixture style; they do not establish
authorship.

```bash
npm run dataset:export -- --output artifacts/hf-export
npm run dataset:publish -- --directory artifacts/hf-export \
  --repository OWNER/patina-suspect-zones
```

Publication is opt-in: add `--publish` and provide `HF_TOKEN` through the
environment. The default command validates the bundle without network access.
Use the authenticated account or an organization it can manage. The owner
namespace must be selected explicitly; the tool never silently switches accounts.

The per-file license review is
`docs/research/hf-fixture-license-review.json`. A changed or additional fixture
must be reviewed and committed before publication. The publisher verifies the
export against that reviewed source and refuses unreviewed Git history,
unmanaged target datasets, checksum changes and source downgrades.

The **Publish benchmark dataset** workflow supports a manual dry run and an
explicit publish run from reviewed main history. Configure the repository
environment secret `HF_DATASET_WRITE_TOKEN` in `hf-dataset-production` and
variable `HF_DATASET_REPO=OWNER/patina-suspect-zones` before publishing. Restrict
that environment to the `main` branch. The job also checks out `main` explicitly
and rejects dispatches from other branches. There is no automatic release upload until the namespace and
credential configuration have been confirmed.

The published URL and cross-links will be added after successful remote
verification. An exported folder alone is not a published dataset.
