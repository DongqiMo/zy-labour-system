# Local UIE comparison experiment

This directory is an offline evaluation harness, not a website integration. It does not change production records, use Gemini, send orders to an AI API, or train on human-edited company orders.

## Current verified status

- Reviewed source: [HUSTAI/uie_pytorch](https://github.com/HUSTAI/uie_pytorch), pinned commit `2eafcda44589144d2cb246b74e3bf2564ea6583f`.
- Upstream code license: Apache-2.0. Check model-weight terms separately before production distribution/use.
- Isolated CPU imports succeeded with Python 3.12, torch 2.5.1+cpu, transformers 4.40.2. Upstream's original `torch<2` dependency cannot be installed unchanged on this Python version, so this is a compatibility trial, not a claim that upstream requirements work unchanged.
- Current-rule baseline executed for 30 synthetic regression sources (153 specified checks passed) plus 26 unlabelled private sources from the provided audit. This is not a production accuracy estimate; the synthetic suite is already part of the existing rule contract.
- UIE inference has **not** run: weights must be downloaded first. The managed environment currently needs `bj.bcebos.com` allowed and the configuration published. Only a network draft has been saved. No extraction-quality or inference-speed claim is available yet.
- Reports and source text are private files under ignored `exports/`; do not add them to GitHub.

## Prepare a local computer

Use an isolated virtual environment. Install PyTorch appropriate to your OS/CUDA driver using the [official installation selector](https://pytorch.org/get-started/locally/), then the experiment requirements. The checked CPU setup used torch 2.5.1+cpu. A CUDA installation is a separate setup; changing the browser computer does not give a hosted environment access to that computer's GPU.

Clone the implementation into an ignored local directory and pin its source:

```sh
git clone https://github.com/HUSTAI/uie_pytorch.git var/uie-source
git -C var/uie-source checkout 2eafcda44589144d2cb246b74e3bf2564ea6583f
python -m venv var/uie-venv
# Activate the virtual environment using your OS's normal command.
python -m pip install -r experiments/requirements-uie.txt
```

The upstream converter can download official Paddle weights and convert them to PyTorch. This step downloads model artifacts, not user documents. It uses trusted upstream pickle-format model weights; do not substitute untrusted files. Select `uie-mini` for the initial small-model trial:

```sh
cd var/uie-source
python convert.py --input_model uie-mini --output_model ../uie-mini-pytorch --no_validate_output
cd ../..
```

`--no_validate_output` skips numerical comparison against a Paddle runtime, which is not installed. That limitation must be retained when interpreting results. Conversion/import success alone does not establish extraction quality. Verify artifact hashes and record the exact weight files before reproducible production evaluation.

## Run the comparison

The harness takes already-downloaded, converted weights. It sets offline model flags and never implicitly downloads models during inference.

```sh
python experiments/uie_compare.py \
  --source-checkout var/uie-source \
  --model-dir var/uie-mini-pytorch \
  --device cpu \
  --output exports/uie-comparison.json
```

On a working NVIDIA CUDA runtime, replace `--device cpu` with `--device gpu`. The script refuses GPU mode when CUDA is unavailable.

To include sources from an existing private recognition audit, add `--private-audit /private/path/audit.json`. Only records marked `needsReview` supply source text; human-edited candidate fields are neither inputs nor labels. The audit is not sent over the network. To run only the existing rule baseline without model dependencies, use `--baseline-only` and omit model/source-checkout options.

## Interpretation

Seven extraction fields: title, employer, salary, gender, age, hours and duties. Keep UIE's raw outputs, exact source spans, rejected nonliteral spans, ambiguities, sanitised company-field candidates and measured per-document inference time separate. Existing company privacy/format checks are applied equally; this is not pure raw-model accuracy.

The synthetic checks include expected exact values, required substrings and forbidden privacy terms, not a complete annotation of every field. Private sources have no independently annotated truth: populated fields are coverage, not correctness. Multiple scalar candidates remain ambiguous instead of silently picking a high score. A single mini model at threshold 0.5 cannot represent all UIE models or a fine-tuned deployment.

Do not replace the live parser merely because imports or this baseline pass. Complete inference, manually review errors and privacy, and compare speed and accuracy before proposing integration.
